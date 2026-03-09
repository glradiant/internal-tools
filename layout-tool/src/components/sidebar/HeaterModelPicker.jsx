import { useState } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import { HEATER_CATEGORIES, hasSvgHeaters } from '../../utils/heaterCatalog';

export default function HeaterModelPicker() {
  const selectedModelId = useLayoutStore((s) => s.selectedModelId);
  const heaterAngle = useLayoutStore((s) => s.heaterAngle);
  const heaterFlipH = useLayoutStore((s) => s.heaterFlipH);
  const heaterFlipV = useLayoutStore((s) => s.heaterFlipV);
  const setSelectedModel = useLayoutStore((s) => s.setSelectedModel);
  const setHeaterAngle = useLayoutStore((s) => s.setHeaterAngle);
  const toggleHeaterFlipH = useLayoutStore((s) => s.toggleHeaterFlipH);
  const toggleHeaterFlipV = useLayoutStore((s) => s.toggleHeaterFlipV);

  // Track expanded categories
  const [expandedCategories, setExpandedCategories] = useState(() => {
    // Default: expand the first category
    const categoryIds = Object.keys(HEATER_CATEGORIES);
    return categoryIds.length > 0 ? { [categoryIds[0]]: true } : {};
  });

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const categories = Object.values(HEATER_CATEGORIES);

  if (!hasSvgHeaters()) {
    return (
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.45)',
          fontSize: 10,
        }}
      >
        No heater SVGs found in heater_svgs folder
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '10px 18px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        HEATER MODELS
      </div>

      {/* Categories */}
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 10 }}>
        {categories.map((category) => {
          const isExpanded = expandedCategories[category.id];
          const hasSelectedModel = category.models.some(m => m.id === selectedModelId);

          return (
            <div key={category.id} style={{ marginBottom: 4 }}>
              {/* Category Header (Folder) */}
              <button
                onClick={() => toggleCategory(category.id)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: hasSelectedModel ? 'rgba(243,112,33,0.08)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4,
                  color: hasSelectedModel ? '#f37021' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {/* Folder icon */}
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {isExpanded ? '\u{1F4C2}' : '\u{1F4C1}'}
                </span>
                <span style={{ flex: 1 }}>{category.label}</span>
                {/* Model count */}
                <span style={{
                  fontSize: 9,
                  opacity: 0.5,
                  background: 'rgba(255,255,255,0.1)',
                  padding: '2px 6px',
                  borderRadius: 10,
                }}>
                  {category.models.length}
                </span>
                {/* Chevron */}
                <span style={{
                  fontSize: 10,
                  opacity: 0.5,
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}>
                  {'\u25B6'}
                </span>
              </button>

              {/* Models in category */}
              {isExpanded && (
                <div style={{
                  paddingLeft: 12,
                  paddingTop: 4,
                  borderLeft: '2px solid rgba(255,255,255,0.05)',
                  marginLeft: 10,
                }}>
                  {category.models.map((model) => {
                    const isSelected = selectedModelId === model.id;
                    return (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        style={{
                          width: '100%',
                          marginBottom: 2,
                          padding: '5px 8px',
                          background: isSelected ? 'rgba(243,112,33,0.15)' : 'transparent',
                          border: isSelected
                            ? '1px solid rgba(243,112,33,0.5)'
                            : '1px solid rgba(255,255,255,0.05)',
                          borderRadius: 3,
                          color: isSelected ? '#f37021' : 'rgba(255,255,255,0.45)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 9,
                          gap: 8,
                        }}
                      >
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {model.label}
                        </span>
                        <span style={{ opacity: 0.5, fontSize: 8, flexShrink: 0 }}>
                          {model.lengthFt}ft
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rotation Controls */}
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', margin: '10px 0 6px' }}>
        ROTATION
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 45, 90, 135].map((a) => (
          <button
            key={a}
            onClick={() => setHeaterAngle(a)}
            style={{
              flex: 1,
              padding: '5px 0',
              background: heaterAngle === a ? '#f37021' : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 3,
              color: heaterAngle === a ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 9,
            }}
          >
            {a}&deg;
          </button>
        ))}
      </div>
      <input
        type="number"
        min={0}
        max={360}
        value={heaterAngle}
        onChange={(e) => setHeaterAngle(Number(e.target.value) % 360)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'white',
          padding: '4px 8px',
          fontSize: 10,
          borderRadius: 3,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {/* Flip Controls */}
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', margin: '10px 0 6px' }}>
        FLIP
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={toggleHeaterFlipH}
          style={{
            flex: 1,
            padding: '6px 0',
            background: heaterFlipH ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: heaterFlipH ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          {'\u2194'} Horizontal
        </button>
        <button
          onClick={toggleHeaterFlipV}
          style={{
            flex: 1,
            padding: '6px 0',
            background: heaterFlipV ? '#f37021' : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 3,
            color: heaterFlipV ? 'white' : 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 9,
          }}
        >
          {'\u2195'} Vertical
        </button>
      </div>
    </div>
  );
}
