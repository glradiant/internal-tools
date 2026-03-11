import { create } from 'zustand';
import { HEATER_MODELS_FROM_SVG } from '../utils/heaterCatalog';
import { GRID, LABEL_SCALE_FACTOR } from '../utils/constants';

// Get the first available model ID, or null if no models
const getDefaultModelId = () => {
  if (HEATER_MODELS_FROM_SVG.length > 0) {
    return HEATER_MODELS_FROM_SVG[0].id;
  }
  return null;
};

// Calculate bounding box of all walls
const getWallsBoundingBox = (walls) => {
  if (!walls || walls.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  walls.forEach(wall => {
    wall.points.forEach(pt => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

// Calculate label scale factor based on drawing size
// Simply: scale = largestDimension(ft) * LABEL_SCALE_FACTOR
// Adjust LABEL_SCALE_FACTOR in constants.js to tune all label sizes
const calcLabelScale = (walls) => {
  const bbox = getWallsBoundingBox(walls);
  if (!bbox) return 1;
  const maxExtentPx = Math.max(bbox.width, bbox.height);
  const maxExtentFt = maxExtentPx / GRID;
  // Direct scaling: larger buildings = larger labels
  return Math.max(1, maxExtentFt * LABEL_SCALE_FACTOR);
};

// Helper to extract entity state for history
const getEntityState = (s) => ({
  walls: s.walls,
  doors: s.doors,
  heaters: s.heaters,
  dimensions: s.dimensions,
});

// Deep clone entity state
const cloneEntityState = (state) => JSON.parse(JSON.stringify(state));

const MAX_HISTORY = 50;

const useLayoutStore = create((set, get) => ({
  projectName: 'New Layout',
  customerName: '',
  customerAddress: '',
  preparedBy: '',
  quoteNumber: '',
  date: new Date().toISOString().slice(0, 10),

  walls: [],
  doors: [],
  heaters: [],
  dimensions: [], // Manual dimension lines: { id, x1, y1, x2, y2 }

  // Undo/redo stacks (stores entity snapshots only)
  past: [],    // States we can undo to
  future: [],  // States we can redo to

  selectedIds: [], // Support multi-select
  activeTool: 'select',
  wallOffsetMode: null, // { heaterId, offsetFt } when setting offset from wall
  showDimensions: true,
  showGrid: true,
  gridDivisionFt: 1, // Feet per grid division (1, 2, 5, 10, etc.)
  selectedModelId: getDefaultModelId(),
  heaterAngle: 0,
  heaterFlipH: false,
  heaterFlipV: false,
  doorHingeSide: 'left', // 'left' or 'right'
  doorSwingIn: true, // true = swing into building

  // Push current state to past stack (call before making changes)
  pushHistory: () => set((s) => {
    const currentState = cloneEntityState(getEntityState(s));
    const newPast = [...s.past, currentState];
    // Limit history size
    if (newPast.length > MAX_HISTORY) {
      newPast.shift();
    }
    return {
      past: newPast,
      future: [], // Clear redo stack on new action
    };
  }),

  // Undo action
  undo: () => {
    const s = get();
    if (s.past.length === 0) return false;

    const currentState = cloneEntityState(getEntityState(s));
    const newPast = [...s.past];
    const prevState = newPast.pop();

    set({
      ...prevState,
      past: newPast,
      future: [currentState, ...s.future],
      selectedIds: [],
    });
    return true;
  },

  // Redo action
  redo: () => {
    const s = get();
    if (s.future.length === 0) return false;

    const currentState = cloneEntityState(getEntityState(s));
    const newFuture = [...s.future];
    const nextState = newFuture.shift();

    set({
      ...nextState,
      past: [...s.past, currentState],
      future: newFuture,
      selectedIds: [],
    });
    return true;
  },

  // Check if undo/redo is available
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  // Get label scale factor based on drawing size
  getLabelScale: () => calcLabelScale(get().walls),

  // Metadata actions
  setProjectName: (name) => set({ projectName: name }),
  setCustomerName: (name) => set({ customerName: name }),
  setCustomerAddress: (v) => set({ customerAddress: v }),
  setPreparedBy: (v) => set({ preparedBy: v }),
  setQuoteNumber: (v) => set({ quoteNumber: v }),
  setDate: (date) => set({ date }),

  // Wall actions
  addWall: (points) => {
    get().pushHistory();
    set((s) => ({
      walls: [...s.walls, { id: crypto.randomUUID(), points }],
    }));
  },
  removeWall: (id) => {
    get().pushHistory();
    set((s) => ({
      walls: s.walls.filter((w) => w.id !== id),
      doors: s.doors.filter((d) => d.wallId !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    }));
  },

  // Door actions
  addDoor: (wallId, segmentIndex, tStart, widthPx, heightFt, doorType = 'overhead', hingeSide = 'left', swingIn = true) => {
    get().pushHistory();
    set((s) => ({
      doors: [...s.doors, { id: crypto.randomUUID(), wallId, segmentIndex, tStart, widthPx, heightFt: heightFt || null, doorType, hingeSide, swingIn }],
    }));
  },
  removeDoor: (id) => {
    get().pushHistory();
    set((s) => ({
      doors: s.doors.filter((d) => d.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    }));
  },
  updateDoor: (id, updates) => {
    get().pushHistory();
    set((s) => ({
      doors: s.doors.map((d) => d.id === id ? { ...d, ...updates } : d)
    }));
  },

  // Heater actions
  addHeater: (x, y, angleDeg, model, flipH = false, flipV = false) => {
    get().pushHistory();
    set((s) => ({
      heaters: [...s.heaters, { id: crypto.randomUUID(), x, y, angleDeg, model, flipH, flipV }],
    }));
  },
  removeHeater: (id) => {
    get().pushHistory();
    set((s) => ({
      heaters: s.heaters.filter((h) => h.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    }));
  },
  updateHeater: (id, updates) => {
    get().pushHistory();
    set((s) => ({
      heaters: s.heaters.map((h) => h.id === id ? { ...h, ...updates } : h)
    }));
  },

  // UI actions
  setSelected: (id) => set({ selectedIds: id ? [id] : [] }),
  addToSelection: (id) => set((s) => ({
    selectedIds: s.selectedIds.includes(id) ? s.selectedIds : [...s.selectedIds, id]
  })),
  removeFromSelection: (id) => set((s) => ({
    selectedIds: s.selectedIds.filter((sid) => sid !== id)
  })),
  toggleSelection: (id) => set((s) => ({
    selectedIds: s.selectedIds.includes(id)
      ? s.selectedIds.filter((sid) => sid !== id)
      : [...s.selectedIds, id]
  })),
  clearSelection: () => set({ selectedIds: [] }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedIds: [], wallOffsetMode: null }),
  setWallOffsetMode: (mode) => set({ wallOffsetMode: mode }),
  clearWallOffsetMode: () => set({ wallOffsetMode: null }),
  setSelectedModel: (id) => set({ selectedModelId: id }),
  setHeaterAngle: (angle) => set({ heaterAngle: angle }),
  setHeaterFlipH: (flip) => set({ heaterFlipH: flip }),
  setHeaterFlipV: (flip) => set({ heaterFlipV: flip }),
  toggleHeaterFlipH: () => set((s) => ({ heaterFlipH: !s.heaterFlipH })),
  toggleHeaterFlipV: () => set((s) => ({ heaterFlipV: !s.heaterFlipV })),
  setDoorHingeSide: (side) => set({ doorHingeSide: side }),
  toggleDoorHingeSide: () => set((s) => ({ doorHingeSide: s.doorHingeSide === 'left' ? 'right' : 'left' })),
  setDoorSwingIn: (swingIn) => set({ doorSwingIn: swingIn }),
  toggleDoorSwingIn: () => set((s) => ({ doorSwingIn: !s.doorSwingIn })),
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setGridDivisionFt: (ft) => set({ gridDivisionFt: ft }),

  // Dimension actions
  addDimension: (x1, y1, x2, y2) => {
    get().pushHistory();
    set((s) => ({
      dimensions: [...s.dimensions, { id: crypto.randomUUID(), x1, y1, x2, y2 }],
    }));
  },
  removeDimension: (id) => {
    get().pushHistory();
    set((s) => ({
      dimensions: s.dimensions.filter((d) => d.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    }));
  },

  // Heater positioning
  updateHeaterPosition: (id, x, y) => {
    get().pushHistory();
    set((s) => ({
      heaters: s.heaters.map((h) => h.id === id ? { ...h, x, y } : h)
    }));
  },
  updateHeatersPositions: (updates) => {
    get().pushHistory();
    set((s) => ({
      heaters: s.heaters.map((h) => {
        const update = updates.find((u) => u.id === h.id);
        return update ? { ...h, x: update.x, y: update.y } : h;
      })
    }));
  },

  // Bulk actions
  clearAll: () => {
    get().pushHistory();
    set({ walls: [], doors: [], heaters: [], dimensions: [], selectedIds: [] });
  },
  loadLayout: (data) => set({
    projectName: data.projectName || 'New Layout',
    customerName: data.customerName || '',
    customerAddress: data.customerAddress || '',
    preparedBy: data.preparedBy || '',
    quoteNumber: data.quoteNumber || '',
    date: data.date || '',
    walls: data.walls || [],
    doors: data.doors || [],
    heaters: data.heaters || [],
    dimensions: data.dimensions || [],
    selectedIds: [],
    activeTool: 'select',
    // Reset history when loading a new layout
    past: [],
    future: [],
  }),
}));

export default useLayoutStore;
