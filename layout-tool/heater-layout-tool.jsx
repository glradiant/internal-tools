import { useState, useRef, useCallback, useEffect } from "react";

const GRID = 20;
const snap = (v) => Math.round(v / GRID) * GRID;

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0.05, Math.min(0.95, t));
  return { x: ax + t * dx, y: ay + t * dy, t };
}

function segmentAngleDeg(ax, ay, bx, by) {
  return (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
}

const HEATER_MODELS = [
  { id: "u100", label: "U-100", kbtu: 100, len: 72 },
  { id: "u150", label: "U-150", kbtu: 150, len: 96 },
  { id: "u200", label: "U-200", kbtu: 200, len: 120 },
  { id: "it150", label: "IT-150", kbtu: 150, len: 108 },
  { id: "it200", label: "IT-200", kbtu: 200, len: 132 },
];

function HeaterGlyph({ len, selected, preview }) {
  const hl = len / 2;
  return (
    <g>
      {selected && (
        <rect
          x={-hl - 10}
          y={-12}
          width={len + 20}
          height={24}
          rx={4}
          fill="none"
          stroke="#60A5FA"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
      )}
      {/* Reflector/shield arc */}
      <path
        d={`M ${-hl} -8 Q 0 -18 ${hl} -8`}
        fill="none"
        stroke={preview ? "#FF8C5A" : "#f37021"}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Tube body */}
      <rect
        x={-hl}
        y={-4}
        width={len}
        height={8}
        rx={4}
        fill={preview ? "rgba(255,107,53,0.15)" : "rgba(199,74,26,0.12)"}
        stroke={preview ? "#FF8C5A" : "#f37021"}
        strokeWidth={1.5}
      />
      {/* Burner head */}
      <rect
        x={-hl - 10}
        y={-6}
        width={18}
        height={12}
        rx={2}
        fill={preview ? "rgba(255,107,53,0.2)" : "rgba(199,74,26,0.2)"}
        stroke={preview ? "#FF8C5A" : "#f37021"}
        strokeWidth={1.5}
      />
      {/* Flame icon hint */}
      <circle
        cx={-hl - 2}
        cy={0}
        r={2.5}
        fill={preview ? "#FF8C5A" : "#f37021"}
        opacity={0.7}
      />
      {/* End cap */}
      <circle
        cx={hl}
        cy={0}
        r={3.5}
        fill="none"
        stroke={preview ? "#FF8C5A" : "#f37021"}
        strokeWidth={1.5}
      />
      {/* Mounting hangers */}
      {[-hl * 0.5, 0, hl * 0.5].map((x, i) => (
        <line
          key={i}
          x1={x}
          y1={-4}
          x2={x}
          y2={-13}
          stroke={preview ? "#FF8C5A" : "#f37021"}
          strokeWidth={1}
          opacity={0.5}
          strokeDasharray="2,2"
        />
      ))}
    </g>
  );
}

function DoorGlyph({ door, walls }) {
  const wall = walls[door.wallIdx];
  if (!wall) return null;
  const pts = wall.points;
  const a = pts[door.segIdx];
  const b = pts[(door.segIdx + 1) % pts.length];
  const dx = b.x - a.x, dy = b.y - a.y;
  const cx = a.x + door.t * dx;
  const cy = a.y + door.t * dy;
  const angle = segmentAngleDeg(a.x, a.y, b.x, b.y);
  const hw = door.width / 2;
  return (
    <g transform={`translate(${cx},${cy}) rotate(${angle})`}>
      {/* Erase wall under door */}
      <rect x={-hw} y={-5} width={door.width} height={10} fill="white" />
      {/* Door jamb lines */}
      <line x1={-hw} y1={-7} x2={-hw} y2={7} stroke="#1B3557" strokeWidth={2.5} />
      <line x1={hw} y1={-7} x2={hw} y2={7} stroke="#1B3557" strokeWidth={2.5} />
      {/* Sectional door panel lines */}
      {[-1, 0, 1].map((i) => (
        <line
          key={i}
          x1={-hw + 3}
          y1={i * 2.5}
          x2={hw - 3}
          y2={i * 2.5}
          stroke="#1B3557"
          strokeWidth={0.75}
          opacity={0.4}
        />
      ))}
      {/* Arrow indicators */}
      <text
        y={-11}
        textAnchor="middle"
        fontSize={7}
        fill="#7A9BB5"
        fontFamily="'DM Mono', monospace"
        letterSpacing={0.5}
      >
        OH DOOR
      </text>
    </g>
  );
}

function dimensionLabel(ax, ay, bx, by) {
  const ft = Math.round(Math.hypot(bx - ax, by - ay) / GRID);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const angle = segmentAngleDeg(ax, ay, bx, by);
  const nx = -(by - ay) / Math.hypot(bx - ax, by - ay);
  const ny = (bx - ax) / Math.hypot(bx - ax, by - ay);
  return { ft, mx, my, angle, nx, ny };
}

export default function LayoutTool() {
  const [mode, setMode] = useState("draw");
  const [walls, setWalls] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [doors, setDoors] = useState([]);
  const [heaters, setHeaters] = useState([]);
  const [hoverPos, setHoverPos] = useState(null);
  const [hoverWall, setHoverWall] = useState(null);
  const [selectedModel, setSelectedModel] = useState(HEATER_MODELS[0]);
  const [heaterAngle, setHeaterAngle] = useState(0);
  const [selectedHeater, setSelectedHeater] = useState(null);
  const [showDimensions, setShowDimensions] = useState(true);
  const [projectName, setProjectName] = useState("New Layout");
  const svgRef = useRef(null);

  const getCoords = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: snap(e.clientX - r.left), y: snap(e.clientY - r.top) };
  };

  const findNearestWallSegment = useCallback(
    (x, y) => {
      let best = { dist: Infinity, wallIdx: null, segIdx: null, point: null };
      walls.forEach((wall, wi) => {
        const pts = wall.points;
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
          if (d < best.dist) {
            best = {
              dist: d,
              wallIdx: wi,
              segIdx: i,
              point: closestOnSegment(x, y, a.x, a.y, b.x, b.y),
            };
          }
        }
      });
      return best;
    },
    [walls]
  );

  const handleClick = (e) => {
    if (e.target.closest(".sidebar")) return;
    const { x, y } = getCoords(e);

    if (mode === "draw") {
      if (currentPath.length >= 3) {
        const first = currentPath[0];
        if (Math.hypot(x - first.x, y - first.y) < GRID * 1.5) {
          setWalls((prev) => [...prev, { points: [...currentPath] }]);
          setCurrentPath([]);
          setMode("select");
          return;
        }
      }
      setCurrentPath((prev) => [...prev, { x, y }]);
    } else if (mode === "heater") {
      setHeaters((prev) => [
        ...prev,
        { x, y, angle: heaterAngle, model: { ...selectedModel } },
      ]);
    } else if (mode === "door") {
      const nearest = findNearestWallSegment(x, y);
      if (nearest.dist < 24 && nearest.wallIdx !== null) {
        setDoors((prev) => [
          ...prev,
          {
            wallIdx: nearest.wallIdx,
            segIdx: nearest.segIdx,
            t: nearest.point.t,
            width: GRID * 4,
          },
        ]);
      }
    }
  };

  const handleMouseMove = (e) => {
    const { x, y } = getCoords(e);
    setHoverPos({ x, y });
    if (mode === "door") {
      const nearest = findNearestWallSegment(x, y);
      setHoverWall(nearest.dist < 24 ? nearest : null);
    } else {
      setHoverWall(null);
    }
  };

  const cancelDraw = () => {
    if (currentPath.length > 0) setCurrentPath([]);
    else setMode("select");
  };

  const W = 880, H = 620;
  const gridLines = [];
  for (let x = 0; x <= W; x += GRID)
    gridLines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke="#E2EAF2" strokeWidth={0.5} />
    );
  for (let y = 0; y <= H; y += GRID)
    gridLines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke="#E2EAF2" strokeWidth={0.5} />
    );

  const totalKbtu = heaters.reduce((s, h) => s + h.model.kbtu, 0);

  const tools = [
    { id: "select", label: "Select", icon: "↖", hint: "Select & inspect elements" },
    { id: "draw", label: "Draw Walls", icon: "⬡", hint: "Click points · click origin to close" },
    { id: "door", label: "OH Door", icon: "⬜", hint: "Click on a wall to place door" },
    { id: "heater", label: "Heater", icon: "◉", hint: "Click canvas to place heater" },
  ];

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "'DM Mono', 'Courier New', monospace",
        background: "#0F1E30",
        overflow: "hidden",
      }}
    >
      {/* ── SIDEBAR ── */}
      <div
        className="sidebar"
        style={{
          width: 230,
          background: "#0F1E30",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          padding: "0",
          flexShrink: 0,
        }}
      >
        {/* Logo / Header */}
        <div
          style={{
            padding: "20px 18px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#f37021", marginBottom: 4 }}>
            GREAT LAKES RADIANT
          </div>
          <div style={{ fontSize: 15, color: "white", fontWeight: 700, letterSpacing: 1 }}>
            LAYOUT TOOL
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            v1.0 PROOF OF CONCEPT
          </div>
        </div>

        {/* Project name */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>
            PROJECT
          </div>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              padding: "5px 8px",
              fontSize: 11,
              borderRadius: 3,
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Tools */}
        <div style={{ padding: "12px 18px 8px" }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
            TOOLS
          </div>
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => { setMode(t.id); setCurrentPath([]); }}
              style={{
                width: "100%",
                marginBottom: 4,
                padding: "8px 10px",
                background: mode === t.id ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.03)",
                border: mode === t.id
                  ? "1px solid rgba(255,107,53,0.6)"
                  : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 4,
                color: mode === t.id ? "#f37021" : "rgba(255,255,255,0.55)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: 0.5,
                transition: "all 0.15s",
              }}
            >
              <span style={{ marginRight: 8 }}>{t.icon}</span>
              {t.label}
              {mode === t.id && (
                <div style={{ fontSize: 8, opacity: 0.6, marginTop: 3, lineHeight: 1.4 }}>
                  {t.hint}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Heater config */}
        {mode === "heater" && (
          <div
            style={{
              padding: "10px 18px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
              MODEL
            </div>
            {HEATER_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m)}
                style={{
                  width: "100%",
                  marginBottom: 3,
                  padding: "6px 8px",
                  background: selectedModel.id === m.id ? "rgba(255,107,53,0.15)" : "transparent",
                  border: selectedModel.id === m.id
                    ? "1px solid rgba(255,107,53,0.5)"
                    : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 3,
                  color: selectedModel.id === m.id ? "#f37021" : "rgba(255,255,255,0.45)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                }}
              >
                <span>{m.label}</span>
                <span style={{ opacity: 0.5 }}>{m.kbtu}kBTU</span>
              </button>
            ))}

            <div style={{ fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.35)", margin: "10px 0 6px" }}>
              ROTATION
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 45, 90, 135].map((a) => (
                <button
                  key={a}
                  onClick={() => setHeaterAngle(a)}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    background: heaterAngle === a ? "#f37021" : "rgba(255,255,255,0.05)",
                    border: "none",
                    borderRadius: 3,
                    color: heaterAngle === a ? "white" : "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 9,
                  }}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Draw instructions */}
        {mode === "draw" && currentPath.length > 0 && (
          <div
            style={{
              padding: "10px 18px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              fontSize: 9,
              color: "rgba(255,255,255,0.4)",
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: "#f37021", marginBottom: 4 }}>
              {currentPath.length} point{currentPath.length !== 1 ? "s" : ""} placed
            </div>
            {currentPath.length >= 3 && "Click the first point (orange) to close shape."}
            <button
              onClick={cancelDraw}
              style={{
                display: "block",
                marginTop: 8,
                width: "100%",
                padding: "5px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.35)",
                cursor: "pointer",
                borderRadius: 3,
                fontFamily: "inherit",
                fontSize: 9,
              }}
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{ marginTop: "auto", padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
            SUMMARY
          </div>
          {[
            ["Buildings", walls.length],
            ["OH Doors", doors.length],
            ["Heaters", heaters.length],
            ["Total kBTU", totalKbtu],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                fontSize: 10,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
              <span style={{ color: val > 0 ? "#f37021" : "rgba(255,255,255,0.2)" }}>{val}</span>
            </div>
          ))}

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={() => {
                setWalls([]);
                setCurrentPath([]);
                setDoors([]);
                setHeaters([]);
              }}
              style={{
                flex: 1,
                padding: "6px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.3)",
                cursor: "pointer",
                borderRadius: 3,
                fontFamily: "inherit",
                fontSize: 9,
              }}
            >
              CLEAR
            </button>
            <button
              onClick={() => window.print()}
              style={{
                flex: 2,
                padding: "6px",
                background: "#f37021",
                border: "none",
                color: "white",
                cursor: "pointer",
                borderRadius: 3,
                fontFamily: "inherit",
                fontSize: 9,
                letterSpacing: 1,
              }}
            >
              EXPORT PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── CANVAS AREA ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F7F9FC" }}>
        {/* Toolbar strip */}
        <div
          style={{
            height: 36,
            background: "#1B3557",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 16,
            borderBottom: "1px solid rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
            {projectName.toUpperCase()}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
            1 grid unit = 1 ft · snap enabled
          </span>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 9,
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={(e) => setShowDimensions(e.target.checked)}
              style={{ accentColor: "#f37021" }}
            />
            DIMENSIONS
          </label>
        </div>

        {/* SVG Canvas */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <svg
            ref={svgRef}
            width={W}
            height={H}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            style={{
              cursor:
                mode === "draw"
                  ? "crosshair"
                  : mode === "heater"
                  ? "cell"
                  : mode === "door"
                  ? "copy"
                  : "default",
              display: "block",
              background: "white",
              boxShadow: "0 2px 20px rgba(0,0,0,0.1)",
            }}
          >
            {/* Grid */}
            <g>{gridLines}</g>

            {/* Major grid every 5 units */}
            {Array.from({ length: Math.floor(W / (GRID * 5)) + 1 }, (_, i) => (
              <line
                key={`mv${i}`}
                x1={i * GRID * 5}
                y1={0}
                x2={i * GRID * 5}
                y2={H}
                stroke="#D4DCE8"
                strokeWidth={0.8}
              />
            ))}
            {Array.from({ length: Math.floor(H / (GRID * 5)) + 1 }, (_, i) => (
              <line
                key={`mh${i}`}
                x1={0}
                y1={i * GRID * 5}
                x2={W}
                y2={i * GRID * 5}
                stroke="#D4DCE8"
                strokeWidth={0.8}
              />
            ))}

            {/* Completed buildings */}
            {walls.map((wall, wi) => {
              const pts = wall.points;
              const pointStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
              return (
                <g key={wi}>
                  {/* Fill */}
                  <polygon
                    points={pointStr}
                    fill="rgba(27,53,87,0.04)"
                    stroke="none"
                  />
                  {/* Wall outline */}
                  <polygon
                    points={pointStr}
                    fill="none"
                    stroke="#1B3557"
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                  />
                  {/* Wall hatch (inner offset hint) */}
                  <polygon
                    points={pointStr}
                    fill="none"
                    stroke="rgba(27,53,87,0.15)"
                    strokeWidth={1}
                    strokeLinejoin="round"
                    strokeDasharray="4,4"
                  />

                  {/* Dimension labels */}
                  {showDimensions &&
                    pts.map((p, i) => {
                      const q = pts[(i + 1) % pts.length];
                      const { ft, mx, my, nx, ny } = dimensionLabel(p.x, p.y, q.x, q.y);
                      if (ft === 0) return null;
                      return (
                        <g key={i} transform={`translate(${mx + nx * 18},${my + ny * 18})`}>
                          <rect
                            x={-14}
                            y={-8}
                            width={28}
                            height={14}
                            rx={2}
                            fill="white"
                            stroke="#D4DCE8"
                            strokeWidth={0.5}
                          />
                          <text
                            textAnchor="middle"
                            y={4}
                            fontSize={8}
                            fill="#1B3557"
                            fontFamily="'DM Mono', monospace"
                            fontWeight={600}
                          >
                            {ft}′
                          </text>
                        </g>
                      );
                    })}
                </g>
              );
            })}

            {/* Doors */}
            {doors.map((d, i) => (
              <DoorGlyph key={i} door={d} walls={walls} />
            ))}

            {/* Heaters */}
            {heaters.map((h, i) => (
              <g
                key={i}
                transform={`translate(${h.x},${h.y}) rotate(${h.angle})`}
                onClick={(e) => {
                  if (mode === "select") {
                    e.stopPropagation();
                    setSelectedHeater(i === selectedHeater ? null : i);
                  }
                }}
              >
                <HeaterGlyph
                  len={h.model.len}
                  selected={selectedHeater === i}
                  preview={false}
                />
                <text
                  y={h.model.len / 2 + 12}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#f37021"
                  fontFamily="'DM Mono', monospace"
                  transform={`rotate(0)`}
                >
                  {h.model.label}
                </text>
              </g>
            ))}

            {/* Current draw path */}
            {currentPath.length > 0 && (
              <g>
                {/* Filled preview */}
                {currentPath.length >= 2 && hoverPos && (
                  <polygon
                    points={[...currentPath, hoverPos].map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="rgba(27,53,87,0.06)"
                    stroke="none"
                  />
                )}
                {/* Path line */}
                <polyline
                  points={[
                    ...currentPath,
                    hoverPos || currentPath[currentPath.length - 1],
                  ]
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}
                  fill="none"
                  stroke="#1B3557"
                  strokeWidth={2}
                  strokeDasharray="8,4"
                  strokeLinejoin="round"
                />
                {/* Close indicator */}
                {currentPath.length >= 3 &&
                  hoverPos &&
                  Math.hypot(
                    hoverPos.x - currentPath[0].x,
                    hoverPos.y - currentPath[0].y
                  ) < GRID * 1.5 && (
                    <circle
                      cx={currentPath[0].x}
                      cy={currentPath[0].y}
                      r={10}
                      fill="rgba(255,107,53,0.2)"
                      stroke="#f37021"
                      strokeWidth={1.5}
                      strokeDasharray="3,2"
                    />
                  )}
                {/* Vertices */}
                {currentPath.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={i === 0 ? 7 : 4} fill="white" stroke="#1B3557" strokeWidth={2} />
                    {i === 0 && (
                      <circle cx={p.x} cy={p.y} r={4} fill="#f37021" />
                    )}
                  </g>
                ))}
              </g>
            )}

            {/* Hover snap indicator */}
            {hoverPos && mode !== "select" && (
              <g>
                <circle cx={hoverPos.x} cy={hoverPos.y} r={3} fill="#f37021" opacity={0.4} />
              </g>
            )}

            {/* Heater ghost in heater mode */}
            {mode === "heater" && hoverPos && (
              <g transform={`translate(${hoverPos.x},${hoverPos.y}) rotate(${heaterAngle})`} opacity={0.45}>
                <HeaterGlyph len={selectedModel.len} selected={false} preview={true} />
              </g>
            )}

            {/* Door wall highlight */}
            {hoverWall && walls[hoverWall.wallIdx] && (
              <g>
                {(() => {
                  const wall = walls[hoverWall.wallIdx];
                  const pts = wall.points;
                  const a = pts[hoverWall.segIdx];
                  const b = pts[(hoverWall.segIdx + 1) % pts.length];
                  return (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#f37021"
                      strokeWidth={4}
                      opacity={0.5}
                    />
                  );
                })()}
              </g>
            )}

            {/* North arrow */}
            <g transform={`translate(${W - 32}, 32)`}>
              <circle r={20} fill="white" stroke="#D4DCE8" strokeWidth={1} />
              <polygon points="0,-14 4,6 0,2 -4,6" fill="#1B3557" />
              <polygon points="0,14 4,-6 0,-2 -4,-6" fill="rgba(27,53,87,0.15)" />
              <text
                y={-17}
                textAnchor="middle"
                fontSize={7}
                fill="#1B3557"
                fontFamily="'DM Mono', monospace"
                fontWeight={700}
              >
                N
              </text>
            </g>

            {/* Scale bar */}
            <g transform={`translate(16, ${H - 24})`}>
              <rect x={0} y={-4} width={GRID * 10} height={4} fill="#1B3557" />
              <rect x={GRID * 10} y={-4} width={GRID * 10} height={4} fill="rgba(27,53,87,0.3)" />
              <text x={0} y={8} fontSize={7} fill="#7A9BB5" fontFamily="'DM Mono', monospace">0</text>
              <text x={GRID * 10} y={8} textAnchor="middle" fontSize={7} fill="#7A9BB5" fontFamily="'DM Mono', monospace">10′</text>
              <text x={GRID * 20} y={8} textAnchor="end" fontSize={7} fill="#7A9BB5" fontFamily="'DM Mono', monospace">20′</text>
            </g>
          </svg>
        </div>

        {/* Status bar */}
        <div
          style={{
            height: 28,
            background: "#1B3557",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 20,
            flexShrink: 0,
          }}
        >
          {[
            ["MODE", mode.toUpperCase()],
            hoverPos ? ["POS", `${hoverPos.x / GRID}′, ${hoverPos.y / GRID}′`] : null,
            ["HEATERS", heaters.length],
            ["TOTAL", `${totalKbtu} kBTU`],
          ]
            .filter(Boolean)
            .map(([k, v]) => (
              <span key={k} style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5 }}>
                {k}:{" "}
                <span style={{ color: "rgba(255,255,255,0.65)" }}>{v}</span>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
