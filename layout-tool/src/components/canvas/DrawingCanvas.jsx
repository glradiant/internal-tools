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

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 6;
const INITIAL_ZOOM = 1; // 1 SVG unit = 1 screen pixel at zoom=1

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
  const doorHingeSide = useLayoutStore((s) => s.doorHingeSide);
  const doorSwingIn = useLayoutStore((s) => s.doorSwingIn);
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

    if (locks.length !== null || locks.angle !== null) {
      return {
        x: snap(anchor.x + dist * Math.cos(angle)),
        y: snap(anchor.y - dist * Math.sin(angle)),
      };
    }
    return cursor;
  }, []);

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

    // Door second-click preview — project cursor along the wall segment
    if (doorPlacement) {
      const wall = walls.find((w) => w.id === doorPlacement.wallId);
      if (wall) {
        const pts = wall.points;
        const a = pts[doorPlacement.segmentIndex];
        const b = pts[(doorPlacement.segmentIndex + 1) % pts.length];
        const proj = closestOnSegment(raw.x, raw.y, a.x, a.y, b.x, b.y);
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);

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
      }
    }
  }, [activeTool, currentPath, walls, doorPlacement, getCoords, applyLocks, onHoverPos, isPanning, zoom]);

  // Click handler
  const handleClick = useCallback((e) => {
    if (isPanning) return;

    const pos = hoverPos || getCoords(e);

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
          });
          doorWidthLock.current = null;
          doorHeightRef.current = null;
          setHoverWall(null);
        }
      } else {
        // Second click — place the door if wide enough
        const widthFt = doorPlacement.currentWidthPx / GRID;
        if (widthFt >= 2) {
          addDoor(
            doorPlacement.wallId,
            doorPlacement.segmentIndex,
            doorPlacement.effectiveTStart,
            doorPlacement.currentWidthPx,
            doorHeightRef.current,
            'overhead'
          );
        }
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
            doorHingeSide,
            doorSwingIn
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
  }, [activeTool, currentPath, hoverPos, heaterAngle, selectedModel, addWall, addDoor, addHeater, setSelected, setActiveTool, getCoords, doorPlacement, walls, isPanning]);

  // Mouse down — pan only
  const handleMouseDown = useCallback((e) => {
    // Middle mouse button or space+left click = pan
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, originX: viewOrigin.x, originY: viewOrigin.y };
      return;
    }
  }, [viewOrigin]);

  // Mouse up — pan
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

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

  // Global mouseup listener for pan
  useEffect(() => {
    if (!isPanning) return;
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isPanning]);

  // Global mousemove for panning when mouse leaves SVG
  useEffect(() => {
    if (!isPanning) return;
    const handleGlobalMouseMove = (e) => {
      const curZoom = zoomRef.current;
      const dx = (e.clientX - panStart.current.x) / curZoom;
      const dy = (e.clientY - panStart.current.y) / curZoom;
      setViewOrigin({
        x: panStart.current.originX - dx,
        y: panStart.current.originY - dy,
      });
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isPanning]);

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

      if (e.key === ' ' && !e.repeat) {
        if (isTyping) return;
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === 'Escape') {
        if (wallOffsetMode) {
          clearWallOffsetMode();
        } else if (activeTool === 'draw') {
          // Immediately exit draw mode and go to select
          setCurrentPath([]);
          wallInputLocks.current = { length: null, angle: null };
          setActiveTool('select');
        } else if (doorPlacement) {
          setDoorPlacement(null);
          doorWidthLock.current = null;
          doorHeightRef.current = null;
          setActiveTool('select');
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
  }, [currentPath, selectedIds, walls, doors, heaters, dimensions, removeWall, removeDoor, removeHeater, removeDimension, doorPlacement, wallOffsetMode, clearWallOffsetMode, activeTool, setActiveTool, undo, redo]);

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
  }, [activeTool]);

  // Cursor style
  const cursor = isPanning ? 'grabbing'
    : spaceHeld ? 'grab'
    : wallOffsetMode ? 'crosshair'
    : activeTool === 'draw' ? 'crosshair'
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

        {/* Wall masks - cut out door openings */}
        <defs>
          {walls.map((wall) => {
            const wallDoors = doors.filter(d => d.wallId === wall.id);
            if (wallDoors.length === 0) return null;

            const pts = wall.points;
            return (
              <mask key={`mask-${wall.id}`} id={`wall-mask-${wall.id}`}>
                {/* White background - visible */}
                <rect x={-100000} y={-100000} width={200000} height={200000} fill="white" />
                {/* Black rectangles where doors are - cut out */}
                {wallDoors.map((door) => {
                  const a = pts[door.segmentIndex];
                  const b = pts[(door.segmentIndex + 1) % pts.length];
                  const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                  if (segLen === 0) return null;
                  const dx = (b.x - a.x) / segLen;
                  const dy = (b.y - a.y) / segLen;
                  const startX = a.x + door.tStart * (b.x - a.x);
                  const startY = a.y + door.tStart * (b.y - a.y);
                  const centerX = startX + (door.widthPx / 2) * dx;
                  const centerY = startY + (door.widthPx / 2) * dy;
                  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
                  return (
                    <rect
                      key={door.id}
                      x={-door.widthPx / 2 - 1}
                      y={-8}
                      width={door.widthPx + 2}
                      height={16}
                      fill="black"
                      transform={`translate(${centerX},${centerY}) rotate(${angle})`}
                    />
                  );
                })}
              </mask>
            );
          })}
        </defs>

        {/* Completed walls */}
        {walls.map((wall) => {
          const pts = wall.points;
          const pointStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
          const isSelected = selectedIds.includes(wall.id);
          const isOffsetTarget = !!wallOffsetMode;
          const hasDoors = doors.some(d => d.wallId === wall.id);
          const maskUrl = hasDoors ? `url(#wall-mask-${wall.id})` : undefined;

          return (
            <g key={wall.id} data-entity-id={wall.id} data-entity-type="wall">
              <polygon points={pointStr} fill={COLORS.wallFill} stroke="none" />
              <g mask={maskUrl}>
                <polygon
                  points={pointStr}
                  fill="none"
                  stroke={isSelected ? '#60A5FA' : isOffsetTarget ? '#f37021' : COLORS.wallStroke}
                  strokeWidth={isSelected ? 4 : isOffsetTarget ? 4 : 3.5}
                  strokeLinejoin="round"
                  style={{ cursor: isOffsetTarget ? 'crosshair' : 'pointer' }}
                />
                <polygon
                  points={pointStr}
                  fill="none"
                  stroke={COLORS.wallHatch}
                  strokeWidth={1}
                  strokeLinejoin="round"
                  strokeDasharray="4,4"
                />
              </g>
              {showDimensions && pts.map((p, i) => {
                const q = pts[(i + 1) % pts.length];
                return <DimensionLabel key={i} ax={p.x} ay={p.y} bx={q.x} by={q.y} wallPoints={pts} />;
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

          return (
            <g
              key={h.id}
              transform={`translate(${h.x},${h.y}) rotate(${h.angleDeg})`}
              data-entity-id={h.id}
              data-entity-type="heater"
              style={{ cursor: activeTool === 'select' ? 'pointer' : undefined }}
            >
              <HeaterGlyph
                model={h.model}
                lengthPx={displayWidth}
                selected={selectedIds.includes(h.id)}
                preview={false}
                flipH={h.flipH || false}
                flipV={h.flipV || false}
              />
              <text
                y={labelOffset}
                textAnchor="middle"
                fontSize={heaterFontSize}
                fill={COLORS.heaterNormal}
                fontFamily="'DM Mono', monospace"
              >
                {h.model.label}
              </text>
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

        {/* Door placement preview */}
        {doorPlacement && doorPlacement.currentWidthPx > 0 && (() => {
          const wall = walls.find((w) => w.id === doorPlacement.wallId);
          if (!wall) return null;
          const previewDoor = {
            id: 'preview',
            wallId: doorPlacement.wallId,
            segmentIndex: doorPlacement.segmentIndex,
            tStart: doorPlacement.effectiveTStart,
            widthPx: doorPlacement.currentWidthPx,
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
        {hoverPos && activeTool !== 'select' && (
          <circle
            cx={hoverPos.x} cy={hoverPos.y}
            r={3}
            fill={COLORS.orange}
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
