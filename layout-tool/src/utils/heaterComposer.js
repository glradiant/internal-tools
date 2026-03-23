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
 * Returns an array of { part, worldX, worldY, rotation, scale, flipped } objects.
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
      placements.push({
        part,
        worldX: 0,
        worldY: 0,
        rotation: 0,
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
 * Compute the bounding box of all placed parts in world (mm) coordinates.
 */
export function computeBoundingBox(placements) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const { part, worldX, worldY, rotation, scale, flipped } of placements) {
    const vb = part.dimensions.viewBox;
    // Transform all four corners of the part's viewBox (converted to mm)
    // Flip doesn't change the bounding box corners, only internal content
    const corners = [
      { x: vb.x * scale, y: vb.y * scale },
      { x: (vb.x + vb.width) * scale, y: vb.y * scale },
      { x: vb.x * scale, y: (vb.y + vb.height) * scale },
      { x: (vb.x + vb.width) * scale, y: (vb.y + vb.height) * scale },
    ];

    for (const corner of corners) {
      const rotated = rotatePoint(corner.x, corner.y, rotation);
      const wx = worldX + rotated.x;
      const wy = worldY + rotated.y;
      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
    }
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
 * Color remapping per part type to match catalog heater conventions.
 * Catalog uses: yellow=centerline, red=first tube, white=second tube, purple=burner detail, green=burner outline
 * Builder parts use different CAD layer colors that need remapping.
 */
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
  // Subsequent tubes: keep white (HeaterGlyph will invert to navy)
  if (partType === 'turn90' || partType === 'turn180') {
    return {
      '#ff00ff': '#ff0000', // magenta → red (structure)
    };
  }
  return {};
}

/**
 * Strip the outer <svg> wrapper, namespace CSS classes, and remap colors
 * to match the catalog heater color conventions.
 * @param {boolean} isFirstTube - true if this is the first tube section in the assembly
 */
export function stripAndNamespace(svgContent, partIndex, partType, isFirstTube = false) {
  let content = svgContent.replace(/<\?xml[^?]*\?>\s*/, '');
  const match = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  let inner = match ? match[1] : content;

  // Remap colors to match catalog convention
  const remap = getColorRemap(partType, isFirstTube);
  for (const [from, to] of Object.entries(remap)) {
    inner = inner.replace(new RegExp(from.replace('#', '#'), 'gi'), to);
  }

  // Namespace CSS class names to avoid collisions between parts
  const prefix = `p${partIndex}_`;
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
  let tubeCount = 0;
  const groups = placements.map(({ part, worldX, worldY, rotation, scale, flipped }, idx) => {
    const isFirstTube = part.type === 'tube' && tubeCount === 0;
    if (part.type === 'tube') tubeCount++;

    const innerSvg = stripAndNamespace(part.svgContent, idx, part.type, isFirstTube);
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

  return {
    svgContent,
    dimensions: {
      viewBox: bbox,
      width: widthMm * 3.78, // mm to px approx
      height: heightMm * 3.78,
      aspectRatio: bbox.width / bbox.height,
    },
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
