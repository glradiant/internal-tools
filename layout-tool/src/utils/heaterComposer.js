/**
 * Heater Composer
 * Composes multiple builder parts into a single SVG for use as a heater model.
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
 * SVG coordinate system: Y increases downward.
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
 * Calculate the placement for each part in the assembly.
 * Returns an array of { part, worldX, worldY, rotation } objects.
 */
export function calculatePlacements(recipe, getPartFn) {
  if (!recipe || recipe.length === 0) return [];

  const placements = [];

  for (let i = 0; i < recipe.length; i++) {
    const part = getPartFn(recipe[i].partId);
    if (!part) continue;

    if (i === 0) {
      // First part (burner) placed at origin with no rotation
      placements.push({
        part,
        worldX: 0,
        worldY: 0,
        rotation: 0,
      });
      continue;
    }

    const prev = placements[placements.length - 1];
    if (!prev || !prev.part.outlet) continue;

    // Calculate world position of previous part's outlet
    const prevOutlet = rotatePoint(prev.part.outlet.x, prev.part.outlet.y, prev.rotation);
    const worldOutletX = prev.worldX + prevOutlet.x;
    const worldOutletY = prev.worldY + prevOutlet.y;

    // Calculate rotation for this part
    const prevWorldOutletAngle = (prev.part.outlet.angle + prev.rotation) % 360;
    const rotation = ((prevWorldOutletAngle + 180 - part.inlet.angle) % 360 + 360) % 360;

    // Calculate world position: place part so its inlet aligns with prev outlet
    const inletRotated = rotatePoint(part.inlet.x, part.inlet.y, rotation);
    const worldX = worldOutletX - inletRotated.x;
    const worldY = worldOutletY - inletRotated.y;

    placements.push({
      part,
      worldX,
      worldY,
      rotation,
    });
  }

  return placements;
}

/**
 * Compute the bounding box of all placed parts in world coordinates.
 */
export function computeBoundingBox(placements) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const { part, worldX, worldY, rotation } of placements) {
    const vb = part.dimensions.viewBox;
    // Transform all four corners of the part's viewBox
    const corners = [
      { x: vb.x, y: vb.y },
      { x: vb.x + vb.width, y: vb.y },
      { x: vb.x, y: vb.y + vb.height },
      { x: vb.x + vb.width, y: vb.y + vb.height },
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

  // Add 5% padding
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
  // Remove XML declaration
  let content = svgContent.replace(/<\?xml[^?]*\?>\s*/, '');
  // Extract inner content between <svg> and </svg>
  const match = content.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (match) return match[1];
  return content;
}

/**
 * Compose all parts into a single SVG string.
 * Returns { svgContent, dimensions } matching the heater model format.
 */
export function composeHeaterSvg(recipe, getPartFn) {
  const placements = calculatePlacements(recipe, getPartFn);
  if (placements.length === 0) return null;

  const bbox = computeBoundingBox(placements);

  // Build SVG groups for each part
  const groups = placements.map(({ part, worldX, worldY, rotation }, idx) => {
    const innerSvg = stripSvgWrapper(part.svgContent);
    // Rotation is around the part's origin (0,0) after translation
    const transform = `translate(${worldX}, ${worldY}) rotate(${rotation})`;
    return `<g transform="${transform}" data-part="${part.partId}" data-index="${idx}">${innerSvg}</g>`;
  });

  // Compute physical dimensions in mm based on aspect ratio
  // Use a reference scale: the 10ft tube is 121.5mm wide for 1000000 viewBox units
  const mmPerUnit = 121.5 / 1000000; // approximate
  const widthMm = bbox.width * mmPerUnit;
  const heightMm = bbox.height * mmPerUnit;

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

  const outletRotated = rotatePoint(last.part.outlet.x, last.part.outlet.y, last.rotation);
  return {
    x: last.worldX + outletRotated.x,
    y: last.worldY + outletRotated.y,
    angle: (last.part.outlet.angle + last.rotation) % 360,
  };
}
