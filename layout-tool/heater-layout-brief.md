# Heater Layout Tool — Claude Code Project Brief

Paste this entire document into Claude Code to kick off the project.

---

## What We're Building

A browser-based radiant tube heater layout tool for Great Lakes Radiant & Industrials.
Sales staff use it to create building layout drawings for customer quotes — no CAD knowledge required.
Output is a branded PDF delivered to the customer alongside the quote.

The tool replaces a manual AutoCAD workflow. Layouts are simple: a building footprint,
overhead doors on walls, and radiant tube heaters placed inside. The goal is that anyone
on the team can produce a clean, professional layout in a few minutes.

A working proof-of-concept React component exists (see `poc.jsx` in this folder).
Use it as a reference for the interaction model and visual style, then rebuild it
properly as a full Vite + React application.

---

## Tech Stack

- **Vite + React** (functional components, hooks)
- **Zustand** for global state (walls, doors, heaters, project metadata)
- **Tailwind CSS** for UI chrome (sidebar, toolbar, modals)
- **SVG** for the drawing canvas (keep all canvas rendering in SVG, not Canvas API)
- **jsPDF + svg2pdf.js** for PDF export
- **No backend required** — fully client-side, saves/loads JSON files locally

---

## Project Structure

```
src/
  components/
    canvas/
      DrawingCanvas.jsx      # SVG canvas, all drawing interaction
      HeaterGlyph.jsx        # SVG heater symbol
      DoorGlyph.jsx          # SVG overhead door symbol
      DimensionLabel.jsx     # Wall length badges
      GridLayer.jsx          # Background grid
      NorthArrow.jsx
      ScaleBar.jsx
    sidebar/
      Sidebar.jsx
      ToolPanel.jsx
      HeaterModelPicker.jsx
      ProjectFields.jsx
      SummaryPanel.jsx
    toolbar/
      Toolbar.jsx
      StatusBar.jsx
    modals/
      WallInputOverlay.jsx   # Floating input for wall length/angle
      DoorInputOverlay.jsx   # Floating input for door width during drag
  store/
    useLayoutStore.js        # Zustand store
  utils/
    geometry.js              # snap, distToSegment, closestOnSegment, etc.
    export.js                # PDF generation logic
    constants.js             # GRID size, heater models, colors
  App.jsx
  main.jsx
```

---

## Grid & Coordinate System

- `GRID = 20` pixels = 1 foot (display scale, not real-world)
- All points snap to grid on mouse input
- All stored coordinates are in grid-snapped pixels
- Dimensions displayed in feet (px / GRID)
- SVG canvas: 880 × 620px, white background, light grid

---

## Feature Specs

### 1. Wall Drawing Tool

The user clicks points to define a building footprint as a closed polygon.

**Interaction flow:**
1. User activates Draw Walls tool
2. First click places origin point (shown as filled orange dot)
3. Each subsequent click adds a vertex
4. As the user moves the mouse after placing a point, a rubber-band line follows the cursor showing the next segment
5. When 3+ points exist and the cursor is within 1.5 grid units of the origin, show a "close" indicator (pulsing orange ring) — clicking closes the polygon and finalizes the wall

**Wall Input Overlay (new feature):**
- After each click (while the next segment is being drawn), show a small floating input panel near the cursor
- Panel contains two fields: **Length (ft)** and **Angle (°)**
- These fields are pre-populated with the live values as the user drags:
  - Length = distance from last placed point to cursor in feet (recalculates live)
  - Angle = bearing in degrees from last placed point to cursor (0° = right/east, 90° = up/north, etc. — use standard math convention, but display as compass bearing 0–360)
- The user can **type into either field to lock that value**:
  - Typing a length locks the distance; the cursor/rubber-band snaps to that distance from the last point while still tracking angle from mouse direction
  - Typing an angle locks the direction; rubber-band snaps to that angle while still tracking distance from mouse
  - Typing both locks the next point exactly — pressing Enter or clicking confirms placement at that exact position
- Tab moves between fields; Enter confirms and places the point
- Clicking on the canvas (outside the overlay) places the point at the current rubber-band position
- Overlay dismisses and resets after each point is placed
- Overlay should not interfere with close-polygon detection

**Rendering:**
- Completed walls: thick dark blue stroke (`#1B3557`), 3.5px, with a subtle fill `rgba(27,53,87,0.04)`
- In-progress path: dashed stroke, same color
- Dimension badges shown on each wall segment (see Dimensions section)

---

### 2. Overhead Door Tool

Places an overhead door opening on an existing wall segment.

**Interaction flow:**
1. User activates OH Door tool
2. Mouse hovering near a wall highlights that wall segment in orange
3. **Click** on the wall to place the door's **start point** — this snaps to the nearest point on the nearest wall segment
4. After clicking, the user **drags along the wall** to define door width:
   - The door preview renders in real-time as a gap in the wall with jamb lines at each end
   - A floating **Door Width** label follows the drag showing current width in feet (e.g. "12′")
   - The door can only grow along the wall — constrain dragging to the wall segment direction
   - If the drag would extend past the end of the wall segment, clamp to wall end
5. **Release mouse** to confirm door placement
6. Minimum door width: 2 ft. If released below minimum, cancel placement.

**Door Input Overlay (new feature):**
- While dragging, show a small floating overlay near the drag endpoint with a **Width (ft)** field
- The field updates live as the user drags
- User can type an exact width; the door preview snaps to that width immediately
- Pressing Enter or releasing the mouse confirms

**Rendering:**
- Gap in wall at door location (render wall with the door gap cut out — use SVG clipPath or split wall rendering)
- Door jamb lines: vertical tick marks at each end of the opening, `#1B3557`, 2.5px
- Horizontal panel lines inside the opening (representing sectional door panels), subtle opacity
- "OH DOOR" label above the opening
- Door width dimension shown below

---

### 3. Heater Placement Tool

**Interaction flow:**
1. User selects a heater model and rotation in the sidebar
2. A ghost/preview of the heater follows the cursor on the canvas
3. Click to place. Heaters can be placed anywhere inside or outside walls (no constraint needed for POC).
4. In Select mode, clicking a placed heater selects it (shows selection ring). Delete key removes it.

**Heater models (define in constants.js):**
```js
export const HEATER_MODELS = [
  { id: "u100",  label: "U-100",  kbtu: 100, lengthFt: 6  },
  { id: "u150",  label: "U-150",  kbtu: 150, lengthFt: 8  },
  { id: "u200",  label: "U-200",  kbtu: 200, lengthFt: 10 },
  { id: "it150", label: "IT-150", kbtu: 150, lengthFt: 9  },
  { id: "it200", label: "IT-200", kbtu: 200, lengthFt: 11 },
];
```

**Rotation:** Free rotation via a numeric input (0–360°) in the sidebar, plus quick-set buttons for 0 / 45 / 90 / 135°.

**Heater SVG symbol (HeaterGlyph.jsx):**
- Centered at (0,0), horizontal, length = model.lengthFt * GRID px
- Reflector arc above tube body
- Tube body: rounded rectangle
- Burner head box on left end
- Mounting hanger dashes above tube
- End cap circle on right
- Model label below
- Color: `#f37021` (normal), `#ff8c5a` (preview/ghost)

---

### 4. Select & Edit Tool

- Click heater → select (highlight ring), Delete key removes it
- Click door → select, Delete key removes it
- Click wall → select, Delete key removes that entire wall (and its associated doors)
- Click empty space → deselect all
- Future (not MVP): drag to move elements

---

### 5. Dimension Labels

- Auto-rendered on every completed wall segment
- Show length in feet, rounded to nearest foot
- Displayed as a small white badge with dark text, offset outward from the wall
- Offset direction = outward normal of the segment
- Toggle on/off via checkbox in toolbar
- Use `DimensionLabel.jsx` component

---

### 6. Zustand Store Shape

```js
// useLayoutStore.js
{
  projectName: "New Layout",
  customerName: "",
  date: "",          // auto-set to today on init

  walls: [
    {
      id: "uuid",
      points: [{ x, y }, ...]   // closed polygon, last point connects back to first
    }
  ],

  doors: [
    {
      id: "uuid",
      wallId: "uuid",
      segmentIndex: 0,          // which segment of the wall
      tStart: 0.2,              // 0–1 position along segment where door starts
      widthPx: 80               // door width in pixels
    }
  ],

  heaters: [
    {
      id: "uuid",
      x: 200, y: 300,
      angleDeg: 0,
      model: { ...heaterModelObject }
    }
  ],

  selectedId: null,
  activeTool: "select",         // "select" | "draw" | "door" | "heater"
  showDimensions: true,

  // Actions
  setProjectName, setCustomerName, setDate,
  addWall, removeWall,
  addDoor, removeDoor,
  addHeater, removeHeater,
  setSelected, setActiveTool,
  toggleDimensions,
  clearAll,
  loadLayout,     // accepts parsed JSON
}
```

---

### 7. PDF Export

Use `jsPDF` + `svg2pdf.js` to export the SVG canvas directly.

**PDF layout (landscape Letter, 11×8.5in):**
- Top: company logo placeholder (left) + project title (center) + date/customer (right)
- Main: the SVG canvas drawing, scaled to fit
- Bottom strip (title block):
  - Left: `GREAT LAKES RADIANT & INDUSTRIALS`
  - Center: project name, customer, date
  - Right: heater count, total kBTU, scale note (`1 div = 1 ft`)
- North arrow and scale bar should be part of the SVG (already rendered)

**Export button** in sidebar triggers download of `[projectName]-layout.pdf`

---

### 8. Save / Load

- **Save**: serialize Zustand store to JSON, trigger browser download as `[projectName].glr` (just JSON with a custom extension)
- **Load**: file input (hidden), parse JSON, call `loadLayout()` action
- Both accessible from sidebar

---

## Visual Design

Follow the POC's aesthetic:
- **Canvas**: white background, light blue-grey grid
- **Sidebar**: dark navy `#0F1E30`, orange accent `#f37021`
- **Toolbar strip**: `#1B3557`
- **Walls**: `#1B3557`
- **Heaters**: `#f37021`
- **Font**: `DM Sans` (import from Google Fonts) for all UI text
- Active tool: orange border + tinted background in sidebar button
- Overlays (wall input, door input): small white floating panels with subtle shadow, `DM Mono`, positioned near cursor

---

## Build Order (Recommended)

1. Scaffold Vite + React + Tailwind + Zustand, verify dev server runs
2. Implement `geometry.js` utilities and unit test them
3. Build `GridLayer`, `DrawingCanvas` shell with mouse tracking
4. Implement wall drawing (click-to-place without overlay first)
5. Add `WallInputOverlay` — length/angle live update and locking
6. Implement `DoorGlyph` and door dragging (start point + drag along wall)
7. Add `DoorInputOverlay`
8. Implement heater placement, `HeaterGlyph`, ghost preview
9. Implement Select tool (select + delete)
10. Add `DimensionLabel`
11. Build sidebar UI and `SummaryPanel`
12. Implement Save/Load
13. Implement PDF export

---

## Reference File

`poc.jsx` in this folder is a single-file proof of concept demonstrating:
- The wall polygon drawing interaction (click-to-place vertices, close on origin)
- The SVG heater glyph style
- The door snap-to-wall behavior (click-to-place version, to be replaced with drag)
- The overall visual style and color palette

Do not copy it wholesale — rebuild cleanly using the structure above, using it only as a visual and interaction reference.
