/**
 * Heater Composer
 * Composes multiple builder parts into a single SVG for use as a heater model.
 *
 * Each part SVG has a different viewBox scale (viewBox units per mm).
 * We normalize all parts to mm coordinates before positioning.
 *
 * Connection algorithm:
 * - Each part has inlet/outlet points with position (x,y in viewBox coords) and angle (outward normal).
 * - To connect part B after part A: B's inlet faces A's outlet (180° apart in world space).
 * - B.rotation = (A.outletAngle + A.rotation + 180 - B.inletAngle) % 360
 * - B.position places B so its world inlet point coincides with A's world outlet point.
 */

const DEG_TO_RAD = Math.PI / 180;

/**
 * Rotate a point (x, y) by angleDeg degrees around origin.
 */
function rotatePoint(x, y, angleDeg) {
  const rad = angleDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

/**
 * Get the mm-per-viewBox-unit scale factor for a part.
 * Uses the SVG's declared width in mm and viewBox width.
 */
function getPartScale(part) {
  const vb = part.dimensions.viewBox;
  const widthMm = part.dimensions.widthMm;
  if (!widthMm || !vb.width) return 1;
  return widthMm / vb.width;
}

/**
 * Convert a point from viewBox coords to mm coords for a given part.
 */
function toMm(point, scale) {
  return { x: point.x * scale, y: point.y * scale };
}

/**
 * Get the effective inlet/outlet for a part, accounting for vertical flip.
 * When flipped, Y coordinates are mirrored around the viewBox vertical center,
 * and vertical angles are inverted (270° ↔ 90°).
 */
function getEffectiveConnections(part, flipped) {
  if (!flipped) return { inlet: part.inlet, outlet: part.outlet };

  const vb = part.dimensions.viewBox;
  const centerY = vb.y + vb.height / 2;

  const mirrorPoint = (pt) => {
    if (!pt) return pt;
    const mirroredY = 2 * centerY - pt.y;
    // Mirror the angle: 270° (up) becomes 90° (down) and vice versa
    let mirroredAngle = pt.angle;
    if (pt.angle === 270) mirroredAngle = 90;
    else if (pt.angle === 90) mirroredAngle = 270;
    return { x: pt.x, y: mirroredY, angle: mirroredAngle };
  };

  return {
    inlet: mirrorPoint(part.inlet),
    outlet: mirrorPoint(part.outlet),
  };
}

/**
 * Calculate the placement for each part in the assembly.
 * All coordinates are in mm (normalized from each part's viewBox scale).
 * Recipe entries: { partId, flipped? } where flipped mirrors turns vertically.
 * Returns an array of { part, worldX, worldY, rotation, scale, flipped, effectiveOutlet } objects.
 */
export function calculatePlacements(recipe, getPartFn) {
  if (!recipe || recipe.length === 0) return [];

  const placements = [];

  for (let i = 0; i < recipe.length; i++) {
    const part = getPartFn(recipe[i].partId);
    if (!part) continue;

    const scale = getPartScale(part);
    const flipped = !!recipe[i].flipped;
    const { inlet, outlet } = getEffectiveConnections(part, flipped);

    if (i === 0) {
      // Support initial rotation on burner (90° increments)
      const initialRotation = recipe[i].rotation || 0;
      placements.push({
        part,
        worldX: 0,
        worldY: 0,
        rotation: initialRotation,
        scale,
        flipped,
        effectiveOutlet: outlet,
      });
      continue;
    }

    const prev = placements[placements.length - 1];
    if (!prev || !prev.effectiveOutlet) continue;

    // Previous part's outlet in mm
    const prevOutletMm = toMm(prev.effectiveOutlet, prev.scale);
    const prevOutletRotated = rotatePoint(prevOutletMm.x, prevOutletMm.y, prev.rotation);
    const worldOutletX = prev.worldX + prevOutletRotated.x;
    const worldOutletY = prev.worldY + prevOutletRotated.y;

    // Calculate rotation for this part
    const prevWorldOutletAngle = (prev.effectiveOutlet.angle + prev.rotation) % 360;
    const rotation = ((prevWorldOutletAngle + 180 - inlet.angle) % 360 + 360) % 360;

    // This part's inlet in mm
    const inletMm = toMm(inlet, scale);
    const inletRotated = rotatePoint(inletMm.x, inletMm.y, rotation);
    const worldX = worldOutletX - inletRotated.x;
    const worldY = worldOutletY - inletRotated.y;

    placements.push({
      part,
      worldX,
      worldY,
      rotation,
      scale,
      flipped,
      effectiveOutlet: outlet,
    });
  }

  return placements;
}

/**
 * Compute the axis-aligned bounding box of a single placed part in world (mm) coordinates.
 */
function computePartAABB({ part, worldX, worldY, rotation, scale }) {
  const vb = part.dimensions.viewBox;
  const corners = [
    { x: vb.x * scale, y: vb.y * scale },
    { x: (vb.x + vb.width) * scale, y: vb.y * scale },
    { x: vb.x * scale, y: (vb.y + vb.height) * scale },
    { x: (vb.x + vb.width) * scale, y: (vb.y + vb.height) * scale },
  ];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const corner of corners) {
    const rotated = rotatePoint(corner.x, corner.y, rotation);
    const wx = worldX + rotated.x;
    const wy = worldY + rotated.y;
    minX = Math.min(minX, wx);
    minY = Math.min(minY, wy);
    maxX = Math.max(maxX, wx);
    maxY = Math.max(maxY, wy);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Compute the bounding box of all placed parts in world (mm) coordinates.
 */
export function computeBoundingBox(placements) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const placement of placements) {
    const aabb = computePartAABB(placement);
    minX = Math.min(minX, aabb.minX);
    minY = Math.min(minY, aabb.minY);
    maxX = Math.max(maxX, aabb.maxX);
    maxY = Math.max(maxY, aabb.maxY);
  }

  const w = maxX - minX;
  const h = maxY - minY;
  const padX = w * 0.05;
  const padY = h * 0.05;

  return {
    x: minX - padX,
    y: minY - padY,
    width: w + padX * 2,
    height: h + padY * 2,
  };
}

/**
 * Check if two AABBs overlap, with a shrink tolerance so parts that
 * touch at connection edges don't count as overlapping.
 */
function aabbsOverlap(a, b, tolerance = 0.5) {
  // Shrink both boxes by tolerance before checking
  const a2 = { minX: a.minX + tolerance, minY: a.minY + tolerance, maxX: a.maxX - tolerance, maxY: a.maxY - tolerance };
  const b2 = { minX: b.minX + tolerance, minY: b.minY + tolerance, maxX: b.maxX - tolerance, maxY: b.maxY - tolerance };

  if (a2.minX >= a2.maxX || a2.minY >= a2.maxY) return false;
  if (b2.minX >= b2.maxX || b2.minY >= b2.maxY) return false;

  return a2.minX < b2.maxX && a2.maxX > b2.minX && a2.minY < b2.maxY && a2.maxY > b2.minY;
}

const OVERLAP_MESSAGES = [
  "Uhh, are you sure about that? Your parts are running into each other.",
  "Houston, we have a problem. Those parts are crashing into each other.",
  "Dude, what are you doing? You've got parts stacked on top of each other.",
  "Hey, your heater is trying to eat itself. Parts are overlapping.",
  "That doesn't look right... you've got parts going through each other.",
  "I don't think that's gonna work. Some of those parts are colliding.",
];

const LENGTH_MESSAGES = [
  (ft) => `That's... a LOT of tube. ${ft} feet, are you heating an airport?`,
  (ft) => `Sir, this is a heater, not the Alaska Pipeline. ${ft} feet is wild.`,
  (ft) => `${ft} feet of tube?! Are you trying to heat the entire building from one end to the other?`,
  (ft) => `Bro, ${ft} feet... at this point you might need two heaters instead.`,
  (ft) => `${ft} feet of tube. That's longer than a blue whale. Just saying.`,
  (ft) => `${ft} feet?! I hope you've got a really long building for all that.`,
];

const UTURN_MESSAGES = [
  "Those two 90s make a U-turn. You could just use a 180 (RUP) instead.",
  "Pro tip: two 90s in a U = one 180. Just use a RUP, my dude.",
  "Two 90° turns doing a U-turn? There's literally a 180° part for that.",
  "That U-turn with two 90s is giving me anxiety. A RUP exists, you know.",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Detect overlapping parts and configuration warnings.
 * Returns an array of { type, key, messageFn/message } warning objects.
 * Each warning has a stable `key` so the UI can cache messages per key.
 */
export function detectWarnings(recipe, placements, getPartFn) {
  const warnings = [];

  // Check for overlapping parts (skip adjacent pairs, they touch at connections)
  const aabbs = placements.map(p => computePartAABB(p));
  for (let i = 0; i < aabbs.length; i++) {
    for (let j = i + 2; j < aabbs.length; j++) {
      if (aabbsOverlap(aabbs[i], aabbs[j])) {
        warnings.push({ type: 'overlap', key: 'overlap', messages: OVERLAP_MESSAGES, indices: [i, j] });
        break;
      }
    }
    if (warnings.some(w => w.type === 'overlap')) break;
  }

  // Check for tube length >= 85'
  const totalLengthFt = recipe.reduce((sum, r) => sum + (getPartFn(r.partId)?.lengthFt || 0), 0);
  if (totalLengthFt >= 85) {
    warnings.push({
      type: 'length',
      key: 'length',
      messages: LENGTH_MESSAGES,
      lengthFt: totalLengthFt,
    });
  }

  // Check for consecutive 90° turns forming a U-turn (both same flip state = U, different = S)
  for (let i = 1; i < recipe.length; i++) {
    const currPart = getPartFn(recipe[i].partId);
    const prevPart = getPartFn(recipe[i - 1].partId);
    if (currPart?.type === 'turn90' && prevPart?.type === 'turn90') {
      const currFlipped = !!recipe[i].flipped;
      const prevFlipped = !!recipe[i - 1].flipped;
      if (currFlipped === prevFlipped) {
        warnings.push({ type: 'u-turn', key: `u-turn-${i}`, messages: UTURN_MESSAGES, indices: [i - 1, i] });
      }
    }
  }

  return warnings;
}

/**
 * Resolve warnings into stable display messages.
 * Uses a cache (Map) to keep the same message for a given warning key
 * until that warning disappears, then picks a new one if it comes back.
 */
export function resolveWarningMessages(warnings, cache) {
  const activeKeys = new Set(warnings.map(w => w.key));

  // Remove cached messages for warnings that are no longer active
  for (const key of cache.keys()) {
    if (!activeKeys.has(key)) cache.delete(key);
  }

  return warnings.map(w => {
    if (!cache.has(w.key)) {
      // Pick a new random message for this warning
      const pick = pickRandom(w.messages);
      cache.set(w.key, typeof pick === 'function' ? pick : pick);
    }
    let msg = cache.get(w.key);
    // For length warnings, update the footage in the cached template
    if (w.type === 'length' && typeof msg === 'function') {
      // Cache stores the template function, render with current footage
      return { type: w.type, message: msg(w.lengthFt) };
    }
    if (w.type === 'length') {
      // Re-pick if footage changed (message has old number baked in)
      // Check if the cached string still has the right number
      if (!msg.includes(String(w.lengthFt))) {
        const pick = pickRandom(w.messages);
        cache.set(w.key, pick);
        msg = typeof pick === 'function' ? pick(w.lengthFt) : pick;
      }
    }
    return { type: w.type, message: typeof msg === 'function' ? msg(w.lengthFt) : msg };
  });
}

/**
 * Color remapping per part type to match catalog heater conventions.
 * Catalog: yellow=centerline, red=first tube, white=subsequent tubes,
 * purple=burner/reflector detail, green=burner outline.
 */
function getColorRemap(partType, isFirstTube) {
  if (partType === 'burner') {
    return {
      '#999999': '#bf7fff', // grey → purple (reflector detail)
      '#00ffff': '#bf7fff', // cyan → purple (burner detail)
    };
  }
  if (partType === 'tube' && isFirstTube) {
    return {
      '#ffffff': '#ff0000', // white → red (first tube body)
    };
  }
  // Turns and subsequent tubes: no color remap, keep original colors
  return {};
}

/**
 * Strip the outer <svg> wrapper, namespace CSS classes, and remap colors
 * to match the catalog heater color conventions.
 * @param {boolean} isFirstTube - true if this is the first tube section in the assembly
 */
export function stripAndNamespace(svgContent, partIndex, partType, isFirstTube = false, heaterPrefix = '') {
  let content = svgContent.replace(/<\?xml[^?]*\?>\s*/, '');
  const match = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  let inner = match ? match[1] : content;

  // Remap colors to match catalog convention
  const remap = getColorRemap(partType, isFirstTube);
  for (const [from, to] of Object.entries(remap)) {
    inner = inner.replace(new RegExp(from.replace('#', '#'), 'gi'), to);
  }

  // Namespace CSS class names to avoid collisions between parts AND between heaters
  const prefix = `${heaterPrefix}p${partIndex}_`;
  inner = inner.replace(/\.C(\d+)\s*\{/g, `.${prefix}C$1 {`);
  inner = inner.replace(/class="C(\d+)"/g, `class="${prefix}C$1"`);

  return inner;
}

/**
 * Compose all parts into a single SVG string.
 * Returns { svgContent, dimensions } matching the heater model format.
 *
 * Each part is placed in mm world coordinates with a scale() transform
 * to convert its native viewBox units to mm.
 */
export function composeHeaterSvg(recipe, getPartFn) {
  const placements = calculatePlacements(recipe, getPartFn);
  if (placements.length === 0) return null;

  const bbox = computeBoundingBox(placements);

  // Build SVG groups for each part
  // Each part needs: translate to world position, rotate, then scale from viewBox units to mm
  // Generate a unique prefix per heater to avoid CSS class collisions when multiple custom heaters are on canvas
  const heaterPrefix = `h${Math.random().toString(36).slice(2, 7)}_`;
  let tubeCount = 0;
  const groups = placements.map(({ part, worldX, worldY, rotation, scale, flipped }, idx) => {
    const isFirstTube = part.type === 'tube' && tubeCount === 0;
    if (part.type === 'tube') tubeCount++;

    const innerSvg = stripAndNamespace(part.svgContent, idx, part.type, isFirstTube, heaterPrefix);
    const vb = part.dimensions.viewBox;
    const outerTransform = `translate(${worldX}, ${worldY}) rotate(${rotation}) scale(${scale})`;

    // For flipped parts, wrap content in an inner group that mirrors Y
    if (flipped) {
      const h = vb.height;
      return `<g transform="${outerTransform}" data-part="${part.partId}" data-index="${idx}"><g transform="translate(0,${vb.y * 2 + h}) scale(1,-1)">${innerSvg}</g></g>`;
    }
    return `<g transform="${outerTransform}" data-part="${part.partId}" data-index="${idx}">${innerSvg}</g>`;
  });

  // bbox is already in mm, so width/height are in mm directly
  const widthMm = bbox.width;
  const heightMm = bbox.height;

  const svgContent = `<?xml version='1.0' encoding='utf-8'?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(1)}mm" height="${heightMm.toFixed(1)}mm" viewBox="${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}">
${groups.join('\n')}
</svg>`;

  // Calculate label anchor: center of the first straight run (all consecutive tubes before the first turn)
  // Falls back to center of overall bbox if no tubes found
  let labelAnchor = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  {
    // Find all consecutive tube placements before the first turn
    let runMinX = Infinity, runMinY = Infinity, runMaxX = -Infinity, runMaxY = -Infinity;
    let foundTube = false;
    for (const p of placements) {
      if (p.part.type === 'tube') {
        foundTube = true;
        const aabb = computePartAABB(p);
        runMinX = Math.min(runMinX, aabb.minX);
        runMinY = Math.min(runMinY, aabb.minY);
        runMaxX = Math.max(runMaxX, aabb.maxX);
        runMaxY = Math.max(runMaxY, aabb.maxY);
      } else if (foundTube) {
        // Hit a non-tube after tubes — end of first straight run
        break;
      }
    }
    if (foundTube) {
      // Use a fixed padding in mm (roughly 2mm in world coords)
      const pad = 2.0;
      const labelHeight = 3.0; // approximate label height in mm
      const belowY = runMaxY + pad + labelHeight;

      // Check if there's room below: is anything else in the assembly occupying that space?
      // Compare against the bounding boxes of all parts NOT in the first run
      let roomBelow = true;
      let pastFirstRun = false;
      let checkedTube = false;
      for (const p of placements) {
        if (p.part.type === 'tube' && !checkedTube) {
          checkedTube = true;
          continue;
        }
        if (p.part.type === 'tube' && !pastFirstRun) continue;
        pastFirstRun = true;
        const aabb = computePartAABB(p);
        // If any non-first-run part overlaps the label's X range and is below the run
        if (aabb.minX < runMaxX && aabb.maxX > runMinX && aabb.minY < belowY + labelHeight) {
          roomBelow = false;
          break;
        }
      }

      if (roomBelow) {
        labelAnchor = {
          x: (runMinX + runMaxX) / 2,
          y: runMaxY + pad + labelHeight, // below the first run
        };
      } else {
        labelAnchor = {
          x: (runMinX + runMaxX) / 2,
          y: runMinY - pad - labelHeight, // above the first run
        };
      }
    }
  }

  return {
    svgContent,
    dimensions: {
      viewBox: bbox,
      width: widthMm * 3.78, // mm to px approx
      height: heightMm * 3.78,
      aspectRatio: bbox.width / bbox.height,
    },
    labelAnchor,
  };
}

/**
 * Get the world outlet point and angle of the last part in a recipe.
 * Used by the builder UI to show where the next part would connect.
 */
export function getLastOutlet(recipe, getPartFn) {
  const placements = calculatePlacements(recipe, getPartFn);
  if (placements.length === 0) return null;

  const last = placements[placements.length - 1];
  if (!last.effectiveOutlet) return null;

  const outletMm = toMm(last.effectiveOutlet, last.scale);
  const outletRotated = rotatePoint(outletMm.x, outletMm.y, last.rotation);
  return {
    x: last.worldX + outletRotated.x,
    y: last.worldY + outletRotated.y,
    angle: (last.effectiveOutlet.angle + last.rotation) % 360,
  };
}
