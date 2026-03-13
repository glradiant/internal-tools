import { useRef, useState, useCallback, useEffect, forwardRef } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import { snap, GRID, COLORS, HEATER_MODELS, getHeaterModel, HEATER_SCALE } from '../../utils/constants';
import { findNearestWallSegment, closestOnSegment } from '../../utils/geometry';
import GridLayer from './GridLayer';
import NorthArrow from './NorthArrow';
// ScaleBar is now rendered inline as a HUD element
import HeaterGlyph from './HeaterGlyph';
import DoorGlyph from './DoorGlyph';
import DimensionLabel from './DimensionLabel';
import ManualDimension from './ManualDimension';
import WallInputOverlay from '../modals/WallInputOverlay';
import DoorInputOverlay from '../modals/DoorInputOverlay';
import RectangleInputOverlay from '../modals/RectangleInputOverlay';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 6;
const INITIAL_ZOOM = 1; // 1 SVG unit = 1 screen pixel at zoom=1

/**
 * Compute wall stroke segments with door gaps.
 * Returns array of { x1, y1, x2, y2 } line segments.
 */
function getWallSegmentsWithDoorGaps(wall, doors) {
  const pts = wall.points;
  const segments = [];
  const wallDoors = doors.filter(d => d.wallId === wall.id);

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen === 0) continue;

    // Find all doors on this segment
    const segDoors = wallDoors
      .filter(d => d.segmentIndex === i)
      .map(d => ({
        tStart: d.tStart,
        tEnd: d.tStart + d.widthPx / segLen
      }))
      .sort((x, y) => x.tStart - y.tStart);

    if (segDoors.length === 0) {
      // No doors on this segment - draw full line
      segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    } else {
      // Draw segments between doors
      let t = 0;
      for (const door of segDoors) {
        if (door.tStart > t) {
          // Draw segment from current position to door start
          segments.push({
            x1: a.x + t * (b.x - a.x),
            y1: a.y + t * (b.y - a.y),
            x2: a.x + door.tStart * (b.x - a.x),
            y2: a.y + door.tStart * (b.y - a.y)
          });
        }
        t = Math.min(1, door.tEnd);
      }
      // Draw remaining segment after last door
      if (t < 1) {
        segments.push({
          x1: a.x + t * (b.x - a.x),
          y1: a.y + t * (b.y - a.y),
          x2: b.x,
          y2: b.y
        });
      }
    }
  }
  return segments;
}

const DrawingCanvas = forwardRef(function DrawingCanvas({ onHoverPos }, ref) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Callback ref to set both internal svgRef and forwarded ref
  const setSvgRef = useCallback((node) => {
    svgRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  // Store state
  const walls = useLayoutStore((s) => s.walls);
  const doors = useLayoutStore((s) => s.doors);
  const heaters = useLayoutStore((s) => s.heaters);
  const dimensions = useLayoutStore((s) => s.dimensions);
  const activeTool = useLayoutStore((s) => s.activeTool);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const showDimensions = useLayoutStore((s) => s.showDimensions);
  const showGrid = useLayoutStore((s) => s.showGrid);
  const gridDivisionFt = useLayoutStore((s) => s.gridDivisionFt);
  const selectedModelId = useLayoutStore((s) => s.selectedModelId);
  const heaterAngle = useLayoutStore((s) => s.heaterAngle);
  const heaterFlipH = useLayoutStore((s) => s.heaterFlipH);
  const heaterFlipV = useLayoutStore((s) => s.heaterFlipV);
  const manDoorFlipH = useLayoutStore((s) => s.manDoorFlipH);
  const manDoorFlipV = useLayoutStore((s) => s.manDoorFlipV);
  const orthoMode = useLayoutStore((s) => s.orthoMode);
  const toggleOrthoMode = useLayoutStore((s) => s.toggleOrthoMode);
  const addWall = useLayoutStore((s) => s.addWall);
  const addDoor = useLayoutStore((s) => s.addDoor);
  const addHeater = useLayoutStore((s) => s.addHeater);
  const addDimension = useLayoutStore((s) => s.addDimension);
  const removeWall = useLayoutStore((s) => s.removeWall);
  const removeDoor = useLayoutStore((s) => s.removeDoor);
  const removeHeater = useLayoutStore((s) => s.removeHeater);
  const removeDimension = useLayoutStore((s) => s.removeDimension);
  const setSelected = useLayoutStore((s) => s.setSelected);
  const toggleSelection = useLayoutStore((s) => s.toggleSelection);
  const clearSelection = useLayoutStore((s) => s.clearSelection);
  const setActiveTool = useLayoutStore((s) => s.setActiveTool);
  const wallOffsetMode = useLayoutStore((s) => s.wallOffsetMode);
  const clearWallOffsetMode = useLayoutStore((s) => s.clearWallOffsetMode);
  const updateHeaterPosition = useLayoutStore((s) => s.updateHeaterPosition);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const copySelected = useLayoutStore((s) => s.copySelected);
  const startPaste = useLayoutStore((s) => s.startPaste);
  const confirmPaste = useLayoutStore((s) => s.confirmPaste);
  const cancelPaste = useLayoutStore((s) => s.cancelPaste);
  const pasteMode = useLayoutStore((s) => s.pasteMode);
  const updateHeatersPositions = useLayoutStore((s) => s.updateHeatersPositions);
  const pushHistory = useLayoutStore((s) => s.pushHistory);
  const getLabelScale = useLayoutStore((s) => s.getLabelScale);
  const labelScale = getLabelScale();

  // Local ephemeral state
  const [hoverPos, setHoverPos] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [hoverWall, setHoverWall] = useState(null);
  // Door two-click state: null | { wallId, segmentIndex, startT, startPoint, currentT, currentWidthPx, effectiveTStart }
  const [doorPlacement, setDoorPlacement] = useState(null);
  // Dimension two-click state: null | { x, y } (first point)
  const [dimensionStart, setDimensionStart] = useState(null);
  // Current snap point when hovering in dimension mode
  const [hoverSnapPoint, setHoverSnapPoint] = useState(null);
  // Rectangle tool state: null | { x, y } (first corner)
  const [rectangleStart, setRectangleStart] = useState(null);

  // Drag state for moving selected elements
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, entities: [] });

  // Pan/zoom state — viewBox model
  // The viewBox origin (top-left corner of visible area in SVG coords)
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [viewOrigin, setViewOrigin] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Wall input overlay lock ref
  const wallInputLocks = useRef({ length: null, angle: null });
  // Door lock refs (from typed input)
  const doorWidthLock = useRef(null);
  const doorHeightRef = useRef(null);
  // Rectangle dimension locks
  const rectangleLocks = useRef({ width: null, height: null });

  const selectedModel = getHeaterModel(selectedModelId) || HEATER_MODELS[0];

  // Get heater display width from SVG dimensions (uses actual drawn size, not tube length)
  const getHeaterDisplayWidth = useCallback((model) => {
    // Use SVG's actual width if available, otherwise fall back to lengthFt * GRID
    if (model?.dimensions?.width) {
      return model.dimensions.width * HEATER_SCALE;
    }
    return (model?.lengthFt || 10) * GRID;
  }, []);

  // Get snap points for heaters - just the centerline points (left end, center, right end)
  // The SVG viewBox includes lots of annotation, so we only snap to the heater centerline
  const getHeaterSnapPoints = useCallback((heater) => {
    const halfLen = getHeaterDisplayWidth(heater.model) / 2;
    const angleRad = (heater.angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const points = [];

    // Left end (center of left end)
    points.push({ x: heater.x - halfLen * cos, y: heater.y - halfLen * sin, label: 'left' });

    // Right end (center of right end)
    points.push({ x: heater.x + halfLen * cos, y: heater.y + halfLen * sin, label: 'right' });

    // Center point
    points.push({ x: heater.x, y: heater.y, label: 'center' });

    // Quarter points along length for more options
    points.push({ x: heater.x - halfLen * cos * 0.5, y: heater.y - halfLen * sin * 0.5, label: 'quarter-left' });
    points.push({ x: heater.x + halfLen * cos * 0.5, y: heater.y + halfLen * sin * 0.5, label: 'quarter-right' });

    return points;
  }, [getHeaterDisplayWidth]);

  // Find nearest snap point to cursor when in dimension mode
  const findNearestSnapPoint = useCallback((cursorX, cursorY) => {
    const snapPoints = [];
    const snapRadius = 20;

    // Heater snap points
    heaters.forEach((h) => {
      getHeaterSnapPoints(h).forEach((pt) => {
        snapPoints.push({ ...pt, type: 'heater', heaterId: h.id });
      });
    });

    // Wall corner snap points
    walls.forEach((w) => {
      w.points.forEach((pt, i) => {
        snapPoints.push({ x: pt.x, y: pt.y, label: `corner${i}`, type: 'wall', wallId: w.id });
      });
    });

    // Find nearest
    let nearest = null;
    let minDist = snapRadius;
    snapPoints.forEach((pt) => {
      const d = Math.hypot(cursorX - pt.x, cursorY - pt.y);
      if (d < minDist) {
        minDist = d;
        nearest = pt;
      }
    });

    return nearest;
  }, [heaters, walls, getHeaterSnapPoints]);

  // Visible area dimensions in SVG coords
  const viewW = containerSize.w / zoom;
  const viewH = containerSize.h / zoom;

  // Track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // viewBox string
  const viewBox = `${viewOrigin.x} ${viewOrigin.y} ${viewW} ${viewH}`;

  // Convert screen (client) coords to SVG coords
  const getCoords = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const svgX = viewOrigin.x + screenX / zoom;
    const svgY = viewOrigin.y + screenY / zoom;
    // Only snap when grid is visible, snap to grid division size
    if (showGrid) {
      const snapStep = GRID * gridDivisionFt;
      return {
        x: Math.round(svgX / snapStep) * snapStep,
        y: Math.round(svgY / snapStep) * snapStep,
      };
    }
    return { x: svgX, y: svgY };
  }, [zoom, viewOrigin, showGrid, gridDivisionFt]);

  // Convert SVG coords to screen coords relative to container
  const svgToScreen = useCallback((svgX, svgY) => {
    return {
      x: (svgX - viewOrigin.x) * zoom,
      y: (svgY - viewOrigin.y) * zoom,
    };
  }, [zoom, viewOrigin]);

  // Apply wall input locks to constrain cursor
  const applyLocks = useCallback((anchor, cursor) => {
    const locks = wallInputLocks.current;
    const dx = cursor.x - anchor.x;
    const dy = cursor.y - anchor.y;
    let dist = Math.hypot(dx, dy);
    let angle = Math.atan2(-dy, dx);

    if (locks.length !== null) dist = locks.length * GRID;
    if (locks.angle !== null) angle = (locks.angle * Math.PI) / 180;

    // Apply ortho mode: snap angle to nearest 90 degrees if no explicit angle lock
    if (orthoMode && locks.angle === null) {
      angle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    }

    if (locks.length !== null || locks.angle !== null || orthoMode) {
      return {
        x: snap(anchor.x + dist * Math.cos(angle)),
        y: snap(anchor.y - dist * Math.sin(angle)),
      };
    }
    return cursor;
  }, [orthoMode]);

  // Mouse move handler
  const handleMouseMove = useCallback((e) => {
    // Handle panning
    if (isPanning) {
      const dx = (e.clientX - panStart.current.x) / zoom;
      const dy = (e.clientY - panStart.current.y) / zoom;
      setViewOrigin({
        x: panStart.current.originX - dx,
        y: panStart.current.originY - dy,
      });
      return;
    }

    // Handle dragging selected elements
    if (isDragging && dragStart.current.entities.length > 0) {
      const raw = getCoords(e);
      const dx = raw.x - dragStart.current.x;
      const dy = raw.y - dragStart.current.y;

      // Update heater positions in real-time
      const heaterUpdates = dragStart.current.entities
        .filter(ent => ent.type === 'heater')
        .map(ent => ({
          id: ent.id,
          x: ent.origX + dx,
          y: ent.origY + dy,
        }));

      if (heaterUpdates.length > 0) {
        // Direct state update without pushing history (we'll push on drag end)
        useLayoutStore.setState((s) => ({
          heaters: s.heaters.map((h) => {
            const update = heaterUpdates.find((u) => u.id === h.id);
            return update ? { ...h, x: update.x, y: update.y } : h;
          })
        }));
      }
      return;
    }

    const raw = getCoords(e);
    let pos = raw;

    if (activeTool === 'draw' && currentPath.length > 0) {
      const anchor = currentPath[currentPath.length - 1];
      pos = applyLocks(anchor, raw);
    }

    setHoverPos(pos);
    if (onHoverPos) onHoverPos(pos);

    if ((activeTool === 'overhead-door' || activeTool === 'man-door') && !doorPlacement) {
      const nearest = findNearestWallSegment(raw.x, raw.y, walls);
      setHoverWall(nearest.dist < 24 ? nearest : null);
    }

    // Find snap points when in dimension mode
    if (activeTool === 'dimension') {
      const snap = findNearestSnapPoint(raw.x, raw.y);
      setHoverSnapPoint(snap);
    } else {
      setHoverSnapPoint(null);
    }

    // Door placement preview
    if (doorPlacement) {
      const wall = walls.find((w) => w.id === doorPlacement.wallId);
      if (wall) {
        const pts = wall.points;
        const a = pts[doorPlacement.segmentIndex];
        const b = pts[(doorPlacement.segmentIndex + 1) % pts.length];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);

        if (doorPlacement.phase === 'width' || !doorPlacement.phase) {
          // Width phase: project cursor along the wall segment
          const proj = closestOnSegment(raw.x, raw.y, a.x, a.y, b.x, b.y);

          // If width is locked from typed input, use that instead of cursor projection
          const lockedW = doorWidthLock.current;
          let widthPx, effectiveTStart;
          if (lockedW !== null) {
            widthPx = lockedW * GRID;
            effectiveTStart = doorPlacement.startT;
          } else {
            widthPx = Math.abs(proj.t - doorPlacement.startT) * segLen;
            effectiveTStart = Math.min(proj.t, doorPlacement.startT);
          }

          setDoorPlacement((prev) => ({
            ...prev,
            currentT: proj.t,
            currentWidthPx: widthPx,
            effectiveTStart,
          }));
        } else if (doorPlacement.phase === 'height') {
          // Height phase: track perpendicular distance from wall
          const dx = (b.x - a.x) / segLen;
          const dy = (b.y - a.y) / segLen;
          // Perpendicular direction (inward)
          const perpX = -dy;
          const perpY = dx;

          // Door center position
          const centerT = doorPlacement.lockedTStart + (doorPlacement.lockedWidthPx / 2) / segLen;
          const centerX = a.x + centerT * (b.x - a.x);
          const centerY = a.y + centerT * (b.y - a.y);

          // Calculate perpendicular distance from cursor to wall center
          const toCursorX = raw.x - centerX;
          const toCursorY = raw.y - centerY;
          const perpDist = Math.abs(toCursorX * perpX + toCursorY * perpY);
          const heightFt = Math.round(perpDist / GRID);

          setDoorPlacement((prev) => ({
            ...prev,
            currentHeightFt: heightFt,
          }));
        }
      }
    }
  }, [activeTool, currentPath, walls, doorPlacement, getCoords, applyLocks, onHoverPos, isPanning, zoom]);

  // Track if we just finished dragging (to prevent click from firing)
  const justDragged = useRef(false);

  // Click handler
  const handleClick = useCallback((e) => {
    if (isPanning) return;

    // Skip click if we just finished dragging
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }

    const pos = hoverPos || getCoords(e);

    // Handle paste mode - click to place
    if (pasteMode) {
      confirmPaste(pos.x, pos.y);
      return;
    }

    if (activeTool === 'draw') {
      if (currentPath.length >= 3) {
        const first = currentPath[0];
        if (Math.hypot(pos.x - first.x, pos.y - first.y) < GRID * 1.5) {
          addWall([...currentPath]);
          setCurrentPath([]);
          wallInputLocks.current = { length: null, angle: null };
          setActiveTool('select');
          return;
        }
      }
      setCurrentPath((prev) => [...prev, { x: pos.x, y: pos.y }]);
      wallInputLocks.current = { length: null, angle: null };
    } else if (activeTool === 'rectangle') {
      if (!rectangleStart) {
        // First click — set first corner
        setRectangleStart({ x: pos.x, y: pos.y });
        rectangleLocks.current = { width: null, height: null };
      } else {
        // Second click — create rectangle wall
        const p1 = rectangleStart;
        // Use locked dimensions if set, otherwise use cursor position
        const locks = rectangleLocks.current;
        let p3;
        if (locks.width !== null && locks.height !== null) {
          const dirX = pos.x >= p1.x ? 1 : -1;
          const dirY = pos.y >= p1.y ? 1 : -1;
          p3 = {
            x: p1.x + locks.width * GRID * dirX,
            y: p1.y + locks.height * GRID * dirY,
          };
        } else if (locks.width !== null) {
          const dirX = pos.x >= p1.x ? 1 : -1;
          p3 = { x: p1.x + locks.width * GRID * dirX, y: pos.y };
        } else if (locks.height !== null) {
          const dirY = pos.y >= p1.y ? 1 : -1;
          p3 = { x: pos.x, y: p1.y + locks.height * GRID * dirY };
        } else {
          p3 = { x: pos.x, y: pos.y };
        }
        // Skip if too small
        if (Math.abs(p3.x - p1.x) >= GRID && Math.abs(p3.y - p1.y) >= GRID) {
          const p2 = { x: p3.x, y: p1.y };
          const p4 = { x: p1.x, y: p3.y };
          addWall([p1, p2, p3, p4]);
        }
        setRectangleStart(null);
        rectangleLocks.current = { width: null, height: null };
      }
    } else if (activeTool === 'overhead-door') {
      if (!doorPlacement) {
        // First click — start door placement on nearest wall
        const raw = getCoords(e);
        const nearest = findNearestWallSegment(raw.x, raw.y, walls);
        if (nearest.dist < 24 && nearest.wallId) {
          setDoorPlacement({
            wallId: nearest.wallId,
            segmentIndex: nearest.segmentIndex,
            startT: nearest.point.t,
            startPoint: { x: nearest.point.x, y: nearest.point.y },
            currentT: nearest.point.t,
            currentWidthPx: 0,
            effectiveTStart: nearest.point.t,
            doorType: 'overhead',
            phase: 'width', // NEW: track phase
          });
          doorWidthLock.current = null;
          doorHeightRef.current = null;
          setHoverWall(null);
        }
      } else if (doorPlacement.phase === 'width') {
        // Second click — finalize width, transition to height phase
        const widthFt = doorPlacement.currentWidthPx / GRID;
        if (widthFt >= 2) {
          setDoorPlacement((prev) => ({
            ...prev,
            phase: 'height',
            lockedWidthPx: prev.currentWidthPx,
            lockedTStart: prev.effectiveTStart,
            currentHeightFt: 0,
          }));
        }
      } else if (doorPlacement.phase === 'height') {
        // Third click — set height and place door
        addDoor(
          doorPlacement.wallId,
          doorPlacement.segmentIndex,
          doorPlacement.lockedTStart,
          doorPlacement.lockedWidthPx,
          doorPlacement.currentHeightFt || null,
          'overhead'
        );
        setDoorPlacement(null);
        doorWidthLock.current = null;
        doorHeightRef.current = null;
      }
    } else if (activeTool === 'man-door') {
      // Single click — place 3' man door centered on click point
      const raw = getCoords(e);
      const nearest = findNearestWallSegment(raw.x, raw.y, walls);
      if (nearest.dist < 24 && nearest.wallId) {
        const wall = walls.find(w => w.id === nearest.wallId);
        if (wall) {
          const pts = wall.points;
          const a = pts[nearest.segmentIndex];
          const b = pts[(nearest.segmentIndex + 1) % pts.length];
          const segLen = Math.hypot(b.x - a.x, b.y - a.y);
          const doorWidthPx = 3 * GRID; // 3 feet
          const doorWidthT = doorWidthPx / segLen;
          // Center door on click point
          const tStart = Math.max(0, Math.min(1 - doorWidthT, nearest.point.t - doorWidthT / 2));
          addDoor(
            nearest.wallId,
            nearest.segmentIndex,
            tStart,
            doorWidthPx,
            null,
            'man',
            'left',  // default hinge side
            true,    // default swing in
            manDoorFlipH,
            manDoorFlipV
          );
        }
      }
    } else if (activeTool === 'heater') {
      addHeater(pos.x, pos.y, heaterAngle, { ...selectedModel }, heaterFlipH, heaterFlipV);
    } else if (activeTool === 'dimension') {
      // Get snap point or use raw position
      const raw = getCoords(e);
      const snapPt = findNearestSnapPoint(raw.x, raw.y);
      const clickPt = snapPt ? { x: snapPt.x, y: snapPt.y } : pos;

      if (!dimensionStart) {
        // First click - set start point
        setDimensionStart(clickPt);
      } else {
        // Second click - create dimension
        if (Math.hypot(clickPt.x - dimensionStart.x, clickPt.y - dimensionStart.y) > GRID) {
          addDimension(dimensionStart.x, dimensionStart.y, clickPt.x, clickPt.y);
        }
        setDimensionStart(null);
      }
    } else if (activeTool === 'select') {
      // Check if we're in wall offset mode
      if (wallOffsetMode) {
        const entityEl = e.target.closest('[data-entity-id]');
        if (entityEl && entityEl.dataset.entityType === 'wall') {
          // Clicked on a wall - apply the offset
          const wallId = entityEl.dataset.entityId;
          const wall = walls.find(w => w.id === wallId);
          const heater = heaters.find(h => h.id === wallOffsetMode.heaterId);

          if (wall && heater) {
            const offsetPx = wallOffsetMode.offsetFt * GRID;
            const rawPos = getCoords(e);

            // Find the nearest wall segment to the click
            const nearest = findNearestWallSegment(rawPos.x, rawPos.y, [wall]);
            if (nearest.wallId) {
              const pts = wall.points;
              const a = pts[nearest.segmentIndex];
              const b = pts[(nearest.segmentIndex + 1) % pts.length];

              // Calculate wall direction and perpendicular
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy);

              // Perpendicular direction (unit vector)
              const perpX = -dy / len;
              const perpY = dx / len;

              // Project heater position onto the wall line to find closest point on wall
              // This keeps the heater's position along the wall unchanged
              const hx = heater.x - a.x;
              const hy = heater.y - a.y;
              const proj = (hx * dx + hy * dy) / (len * len);
              const closestOnWallX = a.x + proj * dx;
              const closestOnWallY = a.y + proj * dy;

              // Determine which side of the wall the heater is on
              const toHeaterX = heater.x - closestOnWallX;
              const toHeaterY = heater.y - closestOnWallY;
              const side = perpX * toHeaterX + perpY * toHeaterY;

              // Position heater at offset distance from the wall, keeping its position along the wall
              const sign = side >= 0 ? 1 : -1;
              const newX = closestOnWallX + perpX * offsetPx * sign;
              const newY = closestOnWallY + perpY * offsetPx * sign;

              updateHeaterPosition(heater.id, newX, newY);
            }
          }
          clearWallOffsetMode();
          return;
        } else {
          // Clicked elsewhere - cancel offset mode
          clearWallOffsetMode();
        }
      }

      const entityEl = e.target.closest('[data-entity-id]');
      if (entityEl) {
        const entityId = entityEl.dataset.entityId;
        if (e.shiftKey) {
          // Shift+click: toggle selection (add/remove from multi-select)
          toggleSelection(entityId);
        } else {
          // Regular click: select only this item
          setSelected(entityId);
        }
      } else {
        // Click on empty space: clear selection
        clearSelection();
      }
    }
  }, [activeTool, currentPath, hoverPos, heaterAngle, selectedModel, addWall, addDoor, addHeater, setSelected, setActiveTool, getCoords, doorPlacement, walls, isPanning, pasteMode, confirmPaste, rectangleStart, manDoorFlipH, manDoorFlipV, dimensionStart, findNearestSnapPoint, addDimension, wallOffsetMode, heaters, updateHeaterPosition, clearWallOffsetMode, toggleSelection, clearSelection, heaterFlipH, heaterFlipV]);

  // Mouse down — pan or drag
  const handleMouseDown = useCallback((e) => {
    // Middle mouse button or space+left click = pan
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, originX: viewOrigin.x, originY: viewOrigin.y };
      return;
    }

    // Left click in select mode on a selected entity = start drag
    if (e.button === 0 && activeTool === 'select' && !wallOffsetMode) {
      const entityEl = e.target.closest('[data-entity-id]');
      if (entityEl) {
        const entityId = entityEl.dataset.entityId;
        const entityType = entityEl.dataset.entityType;

        // Check if clicked entity is already selected
        if (selectedIds.includes(entityId)) {
          e.preventDefault();
          const pos = getCoords(e);

          // Gather all selected entities that can be dragged (heaters for now)
          const entities = [];
          selectedIds.forEach(id => {
            const heater = heaters.find(h => h.id === id);
            if (heater) {
              entities.push({ id, type: 'heater', origX: heater.x, origY: heater.y });
            }
          });

          if (entities.length > 0) {
            pushHistory(); // Save state before drag
            setIsDragging(true);
            dragStart.current = { x: pos.x, y: pos.y, entities };
          }
        }
      }
    }
  }, [viewOrigin, spaceHeld, activeTool, selectedIds, heaters, wallOffsetMode, getCoords, pushHistory]);

  // Mouse up — pan or drag end
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDragging) {
      justDragged.current = true;
      setIsDragging(false);
      dragStart.current = { x: 0, y: 0, entities: [] };
    }
  }, [isPanning, isDragging]);

  // Keep refs in sync so wheel handler reads current values
  const zoomRef = useRef(zoom);
  const viewOriginRef = useRef(viewOrigin);
  const containerSizeRef = useRef(containerSize);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { viewOriginRef.current = viewOrigin; }, [viewOrigin]);
  useEffect(() => { containerSizeRef.current = containerSize; }, [containerSize]);

  // Wheel zoom — attached once, uses refs for current values
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const curZoom = zoomRef.current;
      const curOrigin = viewOriginRef.current;
      const rect = container.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      // SVG coordinate under the mouse
      const svgMouseX = curOrigin.x + mouseScreenX / curZoom;
      const svgMouseY = curOrigin.y + mouseScreenY / curZoom;

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, curZoom * factor));

      // Keep the SVG point under the cursor fixed:
      // svgMouseX = newOrigin.x + mouseScreenX / newZoom
      // => newOrigin.x = svgMouseX - mouseScreenX / newZoom
      setViewOrigin({
        x: svgMouseX - mouseScreenX / newZoom,
        y: svgMouseY - mouseScreenY / newZoom,
      });
      setZoom(newZoom);
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Global mouseup listener for pan and drag
  useEffect(() => {
    if (!isPanning && !isDragging) return;
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        justDragged.current = true;
      }
      setIsPanning(false);
      setIsDragging(false);
      dragStart.current = { x: 0, y: 0, entities: [] };
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isPanning, isDragging]);

  // Global mousemove for panning/dragging when mouse leaves SVG
  useEffect(() => {
    if (!isPanning && !isDragging) return;
    const handleGlobalMouseMove = (e) => {
      const curZoom = zoomRef.current;
      const curOrigin = viewOriginRef.current;

      if (isPanning) {
        const dx = (e.clientX - panStart.current.x) / curZoom;
        const dy = (e.clientY - panStart.current.y) / curZoom;
        setViewOrigin({
          x: panStart.current.originX - dx,
          y: panStart.current.originY - dy,
        });
      }

      if (isDragging && dragStart.current.entities.length > 0) {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        let svgX = curOrigin.x + screenX / curZoom;
        let svgY = curOrigin.y + screenY / curZoom;

        // Snap to grid if enabled
        if (showGrid) {
          const snapStep = GRID * gridDivisionFt;
          svgX = Math.round(svgX / snapStep) * snapStep;
          svgY = Math.round(svgY / snapStep) * snapStep;
        }

        const dx = svgX - dragStart.current.x;
        const dy = svgY - dragStart.current.y;

        const heaterUpdates = dragStart.current.entities
          .filter(ent => ent.type === 'heater')
          .map(ent => ({
            id: ent.id,
            x: ent.origX + dx,
            y: ent.origY + dy,
          }));

        if (heaterUpdates.length > 0) {
          useLayoutStore.setState((s) => ({
            heaters: s.heaters.map((h) => {
              const update = heaterUpdates.find((u) => u.id === h.id);
              return update ? { ...h, x: update.x, y: update.y } : h;
            })
          }));
        }
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isPanning, isDragging, showGrid, gridDivisionFt]);

  // Space key for pan mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept shortcuts when typing in an input field
      const tag = e.target.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (isTyping) return;
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z (or Cmd+Shift+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))) {
        if (isTyping) return;
        e.preventDefault();
        redo();
        return;
      }

      // Copy: Ctrl+C (or Cmd+C on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (isTyping) return;
        e.preventDefault();
        copySelected();
        return;
      }

      // Paste: Ctrl+V (or Cmd+V on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (isTyping) return;
        e.preventDefault();
        startPaste(); // Enter paste placement mode
        return;
      }

      if (e.key === ' ' && !e.repeat) {
        if (isTyping) return;
        e.preventDefault();
        setSpaceHeld(true);
      }

      // Ortho mode toggle: O key or F8 (like AutoCAD)
      if ((e.key === 'o' || e.key === 'O' || e.key === 'F8') && !e.ctrlKey && !e.metaKey) {
        if (isTyping) return;
        e.preventDefault();
        toggleOrthoMode();
        return;
      }
      if (e.key === 'Escape') {
        if (pasteMode) {
          cancelPaste();
        } else if (wallOffsetMode) {
          clearWallOffsetMode();
        } else if (activeTool === 'draw') {
          // Immediately exit draw mode and go to select
          setCurrentPath([]);
          wallInputLocks.current = { length: null, angle: null };
          setActiveTool('select');
        } else if (activeTool === 'rectangle') {
          if (rectangleStart) {
            setRectangleStart(null);
          } else {
            setActiveTool('select');
          }
        } else if (doorPlacement) {
          if (doorPlacement.phase === 'height') {
            // ESC during height phase: place door with no height
            addDoor(
              doorPlacement.wallId,
              doorPlacement.segmentIndex,
              doorPlacement.lockedTStart,
              doorPlacement.lockedWidthPx,
              null,
              'overhead'
            );
            setDoorPlacement(null);
            doorWidthLock.current = null;
            doorHeightRef.current = null;
          } else {
            setDoorPlacement(null);
            doorWidthLock.current = null;
            doorHeightRef.current = null;
            setActiveTool('select');
          }
        } else if (activeTool === 'dimension') {
          setDimensionStart(null);
          setActiveTool('select');
        } else if (activeTool !== 'select') {
          setActiveTool('select');
        }
      }
      if (e.key === 'Delete' && selectedIds.length > 0) {
        selectedIds.forEach((id) => {
          if (walls.find((w) => w.id === id)) {
            removeWall(id);
          } else if (doors.find((d) => d.id === id)) {
            removeDoor(id);
          } else if (heaters.find((h) => h.id === id)) {
            removeHeater(id);
          } else if (dimensions.find((d) => d.id === id)) {
            removeDimension(id);
          }
        });
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentPath, selectedIds, walls, doors, heaters, dimensions, removeWall, removeDoor, removeHeater, removeDimension, doorPlacement, wallOffsetMode, clearWallOffsetMode, activeTool, setActiveTool, undo, redo, copySelected, startPaste, pasteMode, cancelPaste, rectangleStart, addDoor, toggleOrthoMode]);

  // Clear state when switching tools
  useEffect(() => {
    if (activeTool !== 'draw') {
      setCurrentPath([]);
      wallInputLocks.current = { length: null, angle: null };
    }
    if (activeTool !== 'overhead-door') {
      setDoorPlacement(null);
      doorWidthLock.current = null;
      doorHeightRef.current = null;
    }
    if (activeTool !== 'dimension') {
      setDimensionStart(null);
      setHoverSnapPoint(null);
    }
    if (activeTool !== 'rectangle') {
      setRectangleStart(null);
    }
  }, [activeTool]);

  // Cursor style
  const cursor = isPanning ? 'grabbing'
    : isDragging ? 'move'
    : spaceHeld ? 'grab'
    : pasteMode ? 'crosshair'
    : wallOffsetMode ? 'crosshair'
    : activeTool === 'draw' ? 'crosshair'
    : activeTool === 'rectangle' ? 'crosshair'
    : activeTool === 'heater' ? 'cell'
    : (activeTool === 'overhead-door' || activeTool === 'man-door') ? 'copy'
    : activeTool === 'dimension' ? 'crosshair'
    : 'default';

  // Wall overlay confirm handler
  const handleWallOverlayConfirm = useCallback((point) => {
    if (currentPath.length >= 3) {
      const first = currentPath[0];
      if (Math.hypot(point.x - first.x, point.y - first.y) < GRID * 1.5) {
        addWall([...currentPath]);
        setCurrentPath([]);
        wallInputLocks.current = { length: null, angle: null };
        setActiveTool('select');
        return;
      }
    }
    setCurrentPath((prev) => [...prev, { x: point.x, y: point.y }]);
    wallInputLocks.current = { length: null, angle: null };
  }, [currentPath, addWall, setActiveTool]);

  // Door overlay confirm handler (Enter key or typed width)
  const handleDoorConfirm = useCallback((widthFt, heightFt) => {
    if (!doorPlacement) return;
    const widthPx = widthFt * GRID;
    addDoor(
      doorPlacement.wallId,
      doorPlacement.segmentIndex,
      doorPlacement.effectiveTStart,
      widthPx,
      heightFt,
      doorPlacement.doorType || 'overhead'
    );
    setDoorPlacement(null);
    doorWidthLock.current = null;
  }, [doorPlacement, addDoor]);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <svg
        ref={setSvgRef}
        width="100%"
        height="100%"
        viewBox={viewBox}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if ((activeTool !== 'draw' || currentPath.length === 0) && !doorPlacement) {
            setHoverPos(null);
          }
          setHoverWall(null);
        }}
        style={{ cursor, display: 'block', background: 'white' }}
      >
        {/* Arrow markers for dimension lines */}
        <defs>
          <marker
            id="dimArrowStart"
            markerWidth="8"
            markerHeight="8"
            refX="0"
            refY="4"
            orient="auto"
          >
            <path d="M8,0 L0,4 L8,8" fill="none" stroke="#f37021" strokeWidth="1" />
          </marker>
          <marker
            id="dimArrowEnd"
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8" fill="none" stroke="#f37021" strokeWidth="1" />
          </marker>
        </defs>

        {/* Grid fills the entire visible area */}
        {showGrid && <GridLayer viewX={viewOrigin.x} viewY={viewOrigin.y} viewW={viewW} viewH={viewH} />}

        {/* Origin crosshair — subtle reference at (0,0) */}
        <line x1={-10} y1={0} x2={10} y2={0} stroke="#CBD5E1" strokeWidth={0.5 / zoom} />
        <line x1={0} y1={-10} x2={0} y2={10} stroke="#CBD5E1" strokeWidth={0.5 / zoom} />

        {/* Completed walls */}
        {walls.map((wall) => {
          const pts = wall.points;
          const pointStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
          const isSelected = selectedIds.includes(wall.id);
          const isOffsetTarget = !!wallOffsetMode;

          // Get wall segments with door gaps
          const wallSegments = getWallSegmentsWithDoorGaps(wall, doors);
          const strokeColor = isSelected ? '#60A5FA' : isOffsetTarget ? '#f37021' : COLORS.wallStroke;
          const strokeW = isSelected ? 4 : isOffsetTarget ? 4 : 3.5;

          // Deduplicate dimensions: only show one label per unique (angle, length) pair
          // This avoids labeling parallel walls of the same length twice
          const seenDimensions = new Set();
          const shouldShowDimension = pts.map((p, i) => {
            const q = pts[(i + 1) % pts.length];
            const len = Math.round(Math.hypot(q.x - p.x, q.y - p.y) / GRID); // length in feet
            // Normalize angle to 0-180 range (parallel walls differ by 180°)
            let angle = Math.round(Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI);
            if (angle < 0) angle += 180;
            if (angle >= 180) angle -= 180;
            const key = `${angle}_${len}`;
            if (seenDimensions.has(key)) return false;
            seenDimensions.add(key);
            return true;
          });

          return (
            <g key={wall.id} data-entity-id={wall.id} data-entity-type="wall">
              {/* Wall fill */}
              <polygon points={pointStr} fill={COLORS.wallFill} stroke="none" />
              {/* Wall stroke segments (with door gaps) */}
              {wallSegments.map((seg, idx) => (
                <line
                  key={`stroke-${idx}`}
                  x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  style={{ cursor: isOffsetTarget ? 'crosshair' : 'pointer' }}
                />
              ))}
              {/* Wall hatch segments (with door gaps) */}
              {wallSegments.map((seg, idx) => (
                <line
                  key={`hatch-${idx}`}
                  x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                  stroke={COLORS.wallHatch}
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeDasharray="4,4"
                />
              ))}
              {showDimensions && pts.map((p, i) => {
                if (!shouldShowDimension[i]) return null;
                const q = pts[(i + 1) % pts.length];
                const segLabel = wall.segmentLabels?.[i] || {};
                return (
                  <DimensionLabel
                    key={i}
                    ax={p.x} ay={p.y} bx={q.x} by={q.y}
                    wallPoints={pts}
                    labelText={segLabel.labelText}
                    labelSizeOffset={segLabel.labelSizeOffset}
                    labelRotation={segLabel.labelRotation}
                    labelVisible={segLabel.labelVisible}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Doors */}
        {doors.map((d) => (
          <DoorGlyph key={d.id} door={d} walls={walls} selected={selectedIds.includes(d.id)} />
        ))}

        {/* Heaters */}
        {heaters.map((h) => {
          // Use actual SVG dimensions for proper sizing
          const displayWidth = getHeaterDisplayWidth(h.model);
          const aspectRatio = h.model.dimensions?.aspectRatio || 1;
          const displayHeight = displayWidth / aspectRatio;
          const heaterFontSize = 7 * labelScale;
          const labelOffset = Math.max(14 * labelScale, displayHeight / 2 + 8 * labelScale);

          // Normalize angle to 0-360 and check if label would be upside down
          // Text should be readable from bottom or right (CAD convention)
          // Flip if angle is in [90°, 270°) so text reads left-to-right or bottom-to-top
          const normalizedAngle = ((h.angleDeg % 360) + 360) % 360;
          const flipLabel = normalizedAngle >= 90 && normalizedAngle < 270;

          return (
            <g
              key={h.id}
              transform={`translate(${h.x},${h.y}) rotate(${h.angleDeg})`}
              data-entity-id={h.id}
              data-entity-type="heater"
              style={{ cursor: activeTool === 'select' ? (selectedIds.includes(h.id) ? 'move' : 'pointer') : undefined }}
            >
              <HeaterGlyph
                model={h.model}
                lengthPx={displayWidth}
                selected={selectedIds.includes(h.id)}
                preview={false}
                flipH={h.flipH || false}
                flipV={h.flipV || false}
              />
              {(h.labelVisible !== false) && (() => {
                const adjustedFontSize = heaterFontSize * (1 + (h.labelSizeOffset || 0) * 0.1);
                const labelText = h.labelText ?? h.model.label;
                // Use manual rotation if set, otherwise use auto flip
                const useManualRotation = h.labelRotation !== null && h.labelRotation !== undefined;
                const manualRotation = useManualRotation ? h.labelRotation : 0;
                const effectiveFlipLabel = useManualRotation ? false : flipLabel;

                return (
                  <text
                    y={effectiveFlipLabel ? -labelOffset : labelOffset}
                    transform={useManualRotation
                      ? `rotate(${manualRotation})`
                      : (effectiveFlipLabel ? 'rotate(180)' : undefined)}
                    textAnchor="middle"
                    fontSize={adjustedFontSize}
                    fill={COLORS.heaterNormal}
                    fontFamily="'DM Mono', monospace"
                  >
                    {labelText}
                  </text>
                );
              })()}
              {/* Heat throw arrows */}
              {(h.heatThrowAngle !== 0) && (() => {
                const angle = h.heatThrowAngle || 0;
                const absAngle = Math.abs(angle);
                // Arrow size scales with angle: 15°=small, 30°=medium, 45°=large
                const sizeMultiplier = absAngle / 45; // 0.33, 0.67, 1.0
                const baseArrowLength = 20 * labelScale;
                const arrowLength = baseArrowLength * (0.5 + sizeMultiplier * 0.5);
                const arrowWidth = 6 * labelScale * (0.5 + sizeMultiplier * 0.5);
                const strokeW = 2 * labelScale * (0.5 + sizeMultiplier * 0.3);

                // Arrow spacing along heater length
                const arrowCount = 3;
                const spacing = displayWidth / (arrowCount + 1);

                // Direction: negative = top (negative Y), positive = bottom (positive Y)
                const direction = angle < 0 ? -1 : 1;
                const arrowStartY = direction * (displayHeight / 2 + 2);

                return (
                  <g>
                    {Array.from({ length: arrowCount }, (_, i) => {
                      const arrowX = -displayWidth / 2 + spacing * (i + 1);
                      // Line ends where arrowhead begins (no overlap)
                      const lineEndY = arrowStartY + direction * (arrowLength - arrowWidth);
                      const tipY = arrowStartY + direction * arrowLength;
                      return (
                        <g key={i}>
                          {/* Arrow shaft - stops before arrowhead */}
                          <line
                            x1={arrowX}
                            y1={arrowStartY}
                            x2={arrowX}
                            y2={lineEndY}
                            stroke="#dc2626"
                            strokeWidth={strokeW}
                          />
                          {/* Arrow head */}
                          <polygon
                            points={`
                              ${arrowX},${tipY}
                              ${arrowX - arrowWidth / 2},${lineEndY}
                              ${arrowX + arrowWidth / 2},${lineEndY}
                            `}
                            fill="#dc2626"
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* In-progress wall path */}
        {currentPath.length > 0 && (
          <g data-no-print="true">
            {currentPath.length >= 2 && hoverPos && (
              <polygon
                points={[...currentPath, hoverPos].map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(27,53,87,0.06)"
                stroke="none"
              />
            )}
            <polyline
              points={[
                ...currentPath,
                hoverPos || currentPath[currentPath.length - 1],
              ].map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={COLORS.wallStroke}
              strokeWidth={2}
              strokeDasharray="8,4"
              strokeLinejoin="round"
            />
            {currentPath.length >= 3 && hoverPos &&
              Math.hypot(hoverPos.x - currentPath[0].x, hoverPos.y - currentPath[0].y) < GRID * 1.5 && (
                <circle
                  cx={currentPath[0].x} cy={currentPath[0].y}
                  r={10}
                  fill="rgba(255,107,53,0.2)"
                  stroke={COLORS.orange}
                  strokeWidth={1.5}
                  strokeDasharray="3,2"
                />
              )}
            {currentPath.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x} cy={p.y}
                  r={i === 0 ? 7 : 4}
                  fill="white"
                  stroke={COLORS.wallStroke}
                  strokeWidth={2}
                />
                {i === 0 && (
                  <circle cx={p.x} cy={p.y} r={4} fill={COLORS.orange} />
                )}
              </g>
            ))}
          </g>
        )}

        {/* Rectangle preview */}
        {activeTool === 'rectangle' && rectangleStart && hoverPos && (
          <g data-no-print="true">
            <rect
              x={Math.min(rectangleStart.x, hoverPos.x)}
              y={Math.min(rectangleStart.y, hoverPos.y)}
              width={Math.abs(hoverPos.x - rectangleStart.x)}
              height={Math.abs(hoverPos.y - rectangleStart.y)}
              fill="rgba(27,53,87,0.06)"
              stroke={COLORS.wallStroke}
              strokeWidth={2}
              strokeDasharray="8,4"
            />
            <circle
              cx={rectangleStart.x} cy={rectangleStart.y}
              r={6}
              fill="white"
              stroke={COLORS.orange}
              strokeWidth={2}
            />
          </g>
        )}

        {/* Door placement preview */}
        {doorPlacement && (doorPlacement.currentWidthPx > 0 || doorPlacement.phase === 'height') && (() => {
          const wall = walls.find((w) => w.id === doorPlacement.wallId);
          if (!wall) return null;
          const previewDoor = {
            id: 'preview',
            wallId: doorPlacement.wallId,
            segmentIndex: doorPlacement.segmentIndex,
            tStart: doorPlacement.phase === 'height' ? doorPlacement.lockedTStart : doorPlacement.effectiveTStart,
            widthPx: doorPlacement.phase === 'height' ? doorPlacement.lockedWidthPx : doorPlacement.currentWidthPx,
            heightFt: doorPlacement.phase === 'height' ? doorPlacement.currentHeightFt : null,
          };
          return (
            <g data-no-print="true" opacity={0.6}>
              <DoorGlyph door={previewDoor} walls={walls} selected={false} />
            </g>
          );
        })()}

        {/* Door start point indicator */}
        {doorPlacement && (
          <circle
            cx={doorPlacement.startPoint.x} cy={doorPlacement.startPoint.y}
            r={5}
            fill="white"
            stroke={COLORS.orange}
            strokeWidth={2}
            data-no-print="true"
          />
        )}

        {/* Door wall highlight */}
        {hoverWall && !doorPlacement && walls.find((w) => w.id === hoverWall.wallId) && (() => {
          const wall = walls.find((w) => w.id === hoverWall.wallId);
          const pts = wall.points;
          const a = pts[hoverWall.segmentIndex];
          const b = pts[(hoverWall.segmentIndex + 1) % pts.length];
          return (
            <line
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke={COLORS.orange}
              strokeWidth={4}
              opacity={0.5}
              data-no-print="true"
            />
          );
        })()}

        {/* Manual dimension lines */}
        {dimensions.map((dim) => (
          <g key={dim.id} data-entity-id={dim.id} data-entity-type="dimension">
            <ManualDimension
              x1={dim.x1}
              y1={dim.y1}
              x2={dim.x2}
              y2={dim.y2}
              selected={selectedIds.includes(dim.id)}
              labelText={dim.labelText}
              labelSizeOffset={dim.labelSizeOffset}
              labelRotation={dim.labelRotation}
              labelVisible={dim.labelVisible}
            />
          </g>
        ))}

        {/* Dimension snap points (when in dimension mode) */}
        {activeTool === 'dimension' && (
          <g data-no-print="true">
            {/* Show all heater snap points */}
            {heaters.map((h) =>
              getHeaterSnapPoints(h).map((pt, i) => {
                const isHovered = hoverSnapPoint?.x === pt.x && hoverSnapPoint?.y === pt.y;
                return (
                  <g key={`${h.id}-${i}`}>
                    {/* Small crosshair instead of circle */}
                    <line
                      x1={pt.x - 4} y1={pt.y}
                      x2={pt.x + 4} y2={pt.y}
                      stroke={isHovered ? '#f37021' : '#f37021'}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                    <line
                      x1={pt.x} y1={pt.y - 4}
                      x2={pt.x} y2={pt.y + 4}
                      stroke={isHovered ? '#f37021' : '#f37021'}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                  </g>
                );
              })
            )}
            {/* Show wall corner snap points - small hollow circles */}
            {walls.map((w) =>
              w.points.map((pt, i) => {
                const isHovered = hoverSnapPoint?.x === pt.x && hoverSnapPoint?.y === pt.y;
                return (
                  <g key={`${w.id}-${i}`}>
                    <line
                      x1={pt.x - 4} y1={pt.y}
                      x2={pt.x + 4} y2={pt.y}
                      stroke={isHovered ? '#f37021' : '#1B3557'}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                    <line
                      x1={pt.x} y1={pt.y - 4}
                      x2={pt.x} y2={pt.y + 4}
                      stroke={isHovered ? '#f37021' : '#1B3557'}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                  </g>
                );
              })
            )}
          </g>
        )}

        {/* Dimension preview line */}
        {activeTool === 'dimension' && dimensionStart && hoverPos && (
          <g data-no-print="true" opacity={0.6}>
            <line
              x1={dimensionStart.x}
              y1={dimensionStart.y}
              x2={hoverSnapPoint?.x || hoverPos.x}
              y2={hoverSnapPoint?.y || hoverPos.y}
              stroke="#f37021"
              strokeWidth={1.5}
              strokeDasharray="6,3"
            />
            <circle cx={dimensionStart.x} cy={dimensionStart.y} r={5} fill="#f37021" />
          </g>
        )}

        {/* Paste preview - items following cursor */}
        {pasteMode && hoverPos && (() => {
          const basePoint = pasteMode.basePoint || { x: 0, y: 0 };
          const offsetX = hoverPos.x - basePoint.x;
          const offsetY = hoverPos.y - basePoint.y;

          return (
            <g opacity={0.5} data-no-print="true">
              {/* Preview walls */}
              {(pasteMode.walls || []).map((wall, i) => {
                const offsetPoints = wall.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
                const pointStr = offsetPoints.map(p => `${p.x},${p.y}`).join(' ');
                return (
                  <polygon
                    key={`paste-wall-${i}`}
                    points={pointStr}
                    fill="rgba(96,165,250,0.1)"
                    stroke="#60A5FA"
                    strokeWidth={3}
                    strokeDasharray="8,4"
                    strokeLinejoin="round"
                  />
                );
              })}
              {/* Preview heaters */}
              {(pasteMode.heaters || []).map((h, i) => {
                const displayWidth = getHeaterDisplayWidth(h.model);
                return (
                  <g
                    key={`paste-heater-${i}`}
                    transform={`translate(${h.x + offsetX},${h.y + offsetY}) rotate(${h.angleDeg})`}
                  >
                    <HeaterGlyph
                      model={h.model}
                      lengthPx={displayWidth}
                      selected={false}
                      preview={true}
                      flipH={h.flipH || false}
                      flipV={h.flipV || false}
                    />
                  </g>
                );
              })}
              {/* Preview dimensions */}
              {(pasteMode.dimensions || []).map((d, i) => (
                <line
                  key={`paste-dim-${i}`}
                  x1={d.x1 + offsetX}
                  y1={d.y1 + offsetY}
                  x2={d.x2 + offsetX}
                  y2={d.y2 + offsetY}
                  stroke="#60A5FA"
                  strokeWidth={1.5}
                  strokeDasharray="6,3"
                />
              ))}
            </g>
          );
        })()}

        {/* Heater ghost preview */}
        {activeTool === 'heater' && hoverPos && selectedModel && (
          <g
            transform={`translate(${hoverPos.x},${hoverPos.y}) rotate(${heaterAngle})`}
            opacity={0.45}
            data-no-print="true"
          >
            <HeaterGlyph model={selectedModel} lengthPx={getHeaterDisplayWidth(selectedModel)} selected={false} preview={true} flipH={heaterFlipH} flipV={heaterFlipV} />
          </g>
        )}

        {/* Hover snap indicator */}
        {hoverPos && (activeTool !== 'select' || pasteMode) && (
          <circle
            cx={hoverPos.x} cy={hoverPos.y}
            r={3}
            fill={pasteMode ? '#60A5FA' : COLORS.orange}
            opacity={0.4}
            data-no-print="true"
          />
        )}
      </svg>

      {/* Fixed HUD overlays — positioned in screen coords, outside SVG */}

      {/* North arrow — top right */}
      <svg
        width={40} height={50}
        style={{ position: 'absolute', top: 12, right: 12, pointerEvents: 'none' }}
      >
        <NorthArrow x={20} y={25} />
      </svg>

      {/* Scale bar — bottom left */}
      {(() => {
        // Pick a nice round number of feet that produces a bar ~100-150px wide
        const targetPx = 120;
        const feetPerPx = 1 / (GRID * zoom);
        const rawFeet = targetPx * feetPerPx;
        const niceSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
        const niceFeet = niceSteps.find((s) => s >= rawFeet) || Math.ceil(rawFeet);
        const barPx = Math.round(niceFeet * GRID * zoom);
        return (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 12,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 6,
            }}
          >
            <svg width={barPx + 2} height={16} style={{ overflow: 'visible' }}>
              <rect x={0} y={4} width={barPx} height={8} fill="#1B3557" rx={1} />
              <rect x={0} y={4} width={barPx / 2} height={8} fill="rgba(27,53,87,0.45)" rx={1} />
            </svg>
            <span
              style={{
                fontSize: 10,
                fontFamily: "'DM Mono', monospace",
                color: '#1B3557',
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {niceFeet} ft
            </span>
          </div>
        );
      })()}

      {/* Wall Input Overlay */}
      {activeTool === 'draw' && currentPath.length > 0 && (() => {
        const cp = hoverPos || currentPath[currentPath.length - 1];
        const screenPos = svgToScreen(cp.x, cp.y);
        return (
          <WallInputOverlay
            anchorPoint={currentPath[currentPath.length - 1]}
            cursorPoint={cp}
            screenPos={screenPos}
            onConfirm={handleWallOverlayConfirm}
            onLocksChange={(locks) => { wallInputLocks.current = locks; }}
          />
        );
      })()}

      {/* Door Input Overlay */}
      {doorPlacement && (() => {
        const cp = hoverPos || doorPlacement.startPoint;
        const screenPos = svgToScreen(cp.x, cp.y);
        const liveWidthFt = Math.round(doorPlacement.currentWidthPx / GRID);
        return (
          <DoorInputOverlay
            liveWidthFt={liveWidthFt}
            screenPos={screenPos}
            onConfirm={handleDoorConfirm}
            onWidthLock={(val) => { doorWidthLock.current = val; }}
            onHeightChange={(val) => { doorHeightRef.current = val; }}
          />
        );
      })()}

      {/* Rectangle Input Overlay */}
      {activeTool === 'rectangle' && rectangleStart && hoverPos && (() => {
        const screenPos = svgToScreen(hoverPos.x, hoverPos.y);
        return (
          <RectangleInputOverlay
            startPoint={rectangleStart}
            cursorPoint={hoverPos}
            screenPos={screenPos}
            onConfirm={(endPoint) => {
              const p1 = rectangleStart;
              const p3 = endPoint;
              if (Math.abs(p3.x - p1.x) >= GRID && Math.abs(p3.y - p1.y) >= GRID) {
                const p2 = { x: p3.x, y: p1.y };
                const p4 = { x: p1.x, y: p3.y };
                addWall([p1, p2, p3, p4]);
              }
              setRectangleStart(null);
              rectangleLocks.current = { width: null, height: null };
            }}
            onDimensionsChange={(dims) => { rectangleLocks.current = dims; }}
          />
        );
      })()}

      {/* Zoom indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(27,53,87,0.75)',
          color: '#fff',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 10,
          fontFamily: "'DM Mono', monospace",
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {zoomPercent}%
      </div>
    </div>
  );
});

export default DrawingCanvas;
