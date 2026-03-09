import { OFFICES, GLR_LOGO_BASE64 } from '../utils/constants';
import './LayoutTemplate.css';

/**
 * Full-sheet PDF template component.
 * Rendered off-screen at 1056x816px (11x8.5in at 96dpi) and captured by html2canvas.
 */
export default function LayoutTemplate({ store, svgMarkup }) {
  // Group heaters by model, count each
  const schedule = Object.values(
    (store.heaters || []).reduce((acc, h) => {
      const key = h.model.id;
      if (!acc[key]) acc[key] = { model: h.model, count: 0 };
      acc[key].count++;
      return acc;
    }, {})
  );

  // Sum all heater kBTU values
  const totalKbtu = (store.heaters || []).reduce((sum, h) => sum + h.model.kbtu, 0);

  return (
    <div className="layout-sheet">

      {/* ═══════ HEADER ═══════ */}
      <div className="hdr">

        {/* Logo cell */}
        <div className="hdr-logo">
          {GLR_LOGO_BASE64 ? (
            <img src={GLR_LOGO_BASE64} alt="Great Lakes Radiant & Industrials" />
          ) : (
            <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#1B3557', letterSpacing: 1 }}>
                GREAT LAKES
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 500, color: '#1B3557', letterSpacing: 0.5 }}>
                RADIANT &amp; INDUSTRIALS
              </div>
            </div>
          )}
          <div className="hdr-contact">
            <span>sales@glradiant.com</span>
            <span className="hdr-contact-div">|</span>
            <span>www.glradiant.com</span>
          </div>
        </div>

        {/* Project info */}
        <div className="hdr-project">
          <div className="hdr-title">{store.projectName || 'Untitled Layout'}</div>
          <div className="hdr-customer">
            {[store.customerName, store.customerAddress].filter(Boolean).join(' \u00A0\u00B7\u00A0 ')}
          </div>
        </div>

        {/* Meta grid — 2 cols x 2 rows */}
        <div className="meta-grid">
          <MetaCell label="PREPARED BY" value={store.preparedBy || '\u2014'} />
          <MetaCell label="DATE" value={store.date || '\u2014'} />
          <MetaCell label="QUOTE NO." value={store.quoteNumber || '\u2014'} />
          <MetaCell label="SCALE" value={store.showGrid ? `1 div = ${store.gridDivisionFt} ft` : "Not to scale"} />
        </div>
      </div>

      {/* ═══════ DRAWING AREA ═══════ */}
      <div
        className="drawing-area"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />

      {/* ═══════ TITLE BLOCK ═══════ */}
      <div className="title-block">

        {/* Cell 1 — Equipment Schedule */}
        <div className="tb" style={{ width: 160 }}>
          <div className="tb-lbl">Equipment Schedule</div>
          <div style={{ marginTop: 2 }}>
            {schedule.length === 0 ? (
              <div className="eq-row" style={{ color: '#8AAABF' }}>No heaters placed</div>
            ) : (
              schedule.map(({ model, count }) => (
                <div className="eq-row" key={model.id}>
                  <span className="eq-sw" />
                  {count}&times; {model.label}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cell 2 — Total Output (SVG to bypass html2canvas layout bugs) */}
        <div style={{ width: 84, height: 92, flexShrink: 0, borderRight: '1px solid #1B3557', background: 'white' }}>
          <svg width="84" height="92" viewBox="0 0 84 92">
            <text
              x="42" y="22"
              textAnchor="middle"
              fontFamily="DM Mono, monospace"
              fontSize="6"
              letterSpacing="2"
              fill="#8AAABF"
            >TOTAL OUTPUT</text>
            <text
              x="42" y="56"
              textAnchor="middle"
              fontFamily="Barlow Condensed, sans-serif"
              fontSize="30"
              fontWeight="700"
              fill="#f37021"
            >{totalKbtu}</text>
            <text
              x="42" y="72"
              textAnchor="middle"
              fontFamily="DM Mono, monospace"
              fontSize="6.5"
              letterSpacing="1.5"
              fill="#8AAABF"
            >kBTU / HR</text>
          </svg>
        </div>

        {/* Cell 4 — Offices, fills remaining width */}
        <div className="offices">
          {OFFICES.map((office) => (
            <div className="ofc" key={office.name}>
              <div className="ofc-name">{office.name}</div>
              <div className="ofc-detail">
                {office.lines.map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < office.lines.length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

    </div>
  );
}

/** Small cell in the header meta grid */
function MetaCell({ label, value }) {
  return (
    <div className="meta-cell">
      <div className="meta-lbl">{label}</div>
      <div className="meta-val">{value}</div>
    </div>
  );
}
