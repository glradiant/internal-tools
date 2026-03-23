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
 * Calculate the placement for each part in the assembly.
 * All coordinates are in mm (normalized from each part's viewBox scale).
 * Returns an array of { part, worldX, worldY, rotation, scale } objects.
 */
export function calculatePlacements(recipe, getPartFn) {
  if (!recipe || recipe.length === 0) return [];

  const placements = [];

  for (let i = 0; i < recipe.length; i++) {
    const part = getPartFn(recipe[i].partId);
    if (!part) continue;

    const scale = getPartScale(part);

    if (i === 0) {
      placements.push({
        part,
        worldX: 0,
        worldY: 0,
        rotation: 0,
        scale,
      });
      continue;
    }

    const prev = placements[placements.length - 1];
    if (!prev || !prev.part.outlet) continue;

    // Previous part's outlet in mm
    const prevOutletMm = toMm(prev.part.outlet, prev.scale);
    const prevOutletRotated = rotatePoint(prevOutletMm.x, prevOutletMm.y, prev.rotation);
    const worldOutletX = prev.worldX + prevOutletRotated.x;
    const worldOutletY = prev.worldY + prevOutletRotated.y;

    // Calculate rotation for this part
    const prevWorldOutletAngle = (prev.part.outlet.angle + prev.rotation) % 360;
    const rotation = ((prevWorldOutletAngle + 180 - part.inlet.angle) % 360 + 360) % 360;

    // This part's inlet in mm
    const inletMm = toMm(part.inlet, scale);
    const inletRotated = rotatePoint(inletMm.x, inletMm.y, rotation);
    const worldX = worldOutletX - inletRotated.x;
    const worldY = worldOutletY - inletRotated.y;

    placements.push({
      part,
      worldX,
      worldY,
      rotation,
      scale,
    });
  }

  return placements;
}

/**
 * Compute the bounding box of all placed parts in world (mm) coordinates.
 */
export function computeBoundingBox(placements) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const { part, worldX, worldY, rotation, scale } of placements) {
    const vb = part.dimensions.viewBox;
    // Transform all four corners of the part's viewBox (converted to mm)
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
 * Strip the outer <svg> wrapper from SVG content, returning just the inner elements.
 */
function stripSvgWrapper(svgContent) {
  let content = svgContent.replace(/<\?xml[^?]*\?>\s*/, '');
  const match = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (match) return match[1];
  return content;
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
  const groups = placements.map(({ part, worldX, worldY, rotation, scale }, idx) => {
    const innerSvg = stripSvgWrapper(part.svgContent);
    // Transform order: translate -> rotate -> scale (applied right to left)
    // The scale converts the part's native viewBox coordinates to mm
    const transform = `translate(${worldX}, ${worldY}) rotate(${rotation}) scale(${scale})`;
    return `<g transform="${transform}" data-part="${part.partId}" data-index="${idx}">${innerSvg}</g>`;
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
  if (!last.part.outlet) return null;

  const outletMm = toMm(last.part.outlet, last.scale);
  const outletRotated = rotatePoint(outletMm.x, outletMm.y, last.rotation);
  return {
    x: last.worldX + outletRotated.x,
    y: last.worldY + outletRotated.y,
    angle: (last.part.outlet.angle + last.rotation) % 360,
  };
}
