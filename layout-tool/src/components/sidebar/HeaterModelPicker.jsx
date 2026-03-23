import { useState } from 'react';
import useLayoutStore from '../../store/useLayoutStore';
import { HEATER_TREE, hasSvgHeaters } from '../../utils/heaterCatalog';

export default function HeaterModelPicker({ onOpenBuilder }) {
  const selectedModelId = useLayoutStore((s) => s.selectedModelId);
  const customHeaters = useLayoutStore((s) => s.customHeaters);
  const removeCustomHeater = useLayoutStore((s) => s.removeCustomHeater);
  const heaterAngle = useLayoutStore((s) => s.heaterAngle);
  const heaterFlipH = useLayoutStore((s) => s.heaterFlipH);
  const heaterFlipV = useLayoutStore((s) => s.heaterFlipV);
  const setSelectedModel = useLayoutStore((s) => s.setSelectedModel);
  const setHeaterAngle = useLayoutStore((s) => s.setHeaterAngle);
  const toggleHeaterFlipH = useLayoutStore((s) => s.toggleHeaterFlipH);
  const toggleHeaterFlipV = useLayoutStore((s) => s.toggleHeaterFlipV);

  // Track expanded nodes by ID
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Check if any descendant has the selected model
  const hasSelectedDescendant = (node) => {
    if (node.models?.some(m => m.id === selectedModelId)) return true;
    if (node.children) {
      return Object.values(node.children).some(hasSelectedDescendant);
    }
    return false;
  };

  // Count total models in a node and its descendants
  const countModels = (node) => {
    let count = node.models?.length || 0;
    if (node.children) {
      count += Object.values(node.children).reduce((sum, child) => sum + countModels(child), 0);
    }
    return count;
  };

  // Render a tree node recursively
  const renderNode = (node, depth = 0) => {
    const isExpanded = expandedNodes[node.id];
    const hasSelected = hasSelectedDescendant(node);
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    const hasModels = node.models && node.models.length > 0;
    const modelCount = countModels(node);

    return (
      <div key={node.id} style={{ marginBottom: depth === 0 ? 4 : 2 }}>
        {/* Node Header (Folder) */}
        <button
          onClick={() => toggleNode(node.id)}
          style={{
            width: '100%',
            padding: depth === 0 ? '8px 10px' : '6px 8px',
            paddingLeft: 10 + depth * 12,
            background: hasSelected ? 'rgba(243,112,33,0.08)' : 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            color: hasSelected ? '#f37021' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: depth === 0 ? 11 : 10,
            fontWeight: depth === 0 ? 500 : 400,
          }}
        >
          {/* Folder icon */}
          <span style={{ fontSize: depth === 0 ? 12 : 10, opacity: 0.7 }}>
            {isExpanded ? '\u{1F4C2}' : '\u{1F4C1}'}
          </span>
          <span style={{ flex: 1 }}>{node.label}</span>
          {/* Model count */}
          <span style={{
            fontSize: 9,
            opacity: 0.5,
            background: 'rgba(255,255,255,0.1)',
            padding: '2px 6px',
            borderRadius: 10,
          }}>
            {modelCount}
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

        {/* Children and Models */}
        {isExpanded && (
          <div style={{
            paddingLeft: 12,
            paddingTop: 4,
            borderLeft: '2px solid rgba(255,255,255,0.05)',
            marginLeft: 10 + depth * 6,
          }}>
            {/* Render child folders */}
            {hasChildren && Object.values(node.children)
              .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
              .map(child => renderNode(child, depth + 1))
            }
            {/* Render models at this level */}
            {hasModels && node.models.map((model) => {
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
                    {model.kbtu}kBTU
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const treeNodes = Object.values(HEATER_TREE);

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
      {/* Custom Heaters Section */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
          CUSTOM HEATERS
        </div>
        <button
          onClick={onOpenBuilder}
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: 6,
            background: 'rgba(243,112,33,0.1)',
            border: '1px solid rgba(243,112,33,0.3)',
            borderRadius: 4,
            color: '#f37021',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            fontSize: 10,
            fontWeight: 500,
          }}
        >
          + Build Custom LS3
        </button>
        {customHeaters.map((ch) => {
          const isSelected = selectedModelId === ch.id;
          return (
            <div
              key={ch.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 2,
              }}
            >
              <button
                onClick={() => setSelectedModel(ch.id)}
                style={{
                  flex: 1,
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
                  fontSize: 9,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ch.label}
              </button>
              <button
                onClick={() => removeCustomHeater(ch.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,100,100,0.5)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '2px 4px',
                  lineHeight: 1,
                }}
                title="Delete custom heater"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
        HEATER MODELS
      </div>

      {/* Nested Tree */}
      <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 10 }}>
        {treeNodes
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
          .map(node => renderNode(node, 0))
        }
      </div>

      {/* Rotation Controls */}
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', margin: '10px 0 6px' }}>
        ROTATION
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => setHeaterAngle((heaterAngle - 90 + 360) % 360)}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
          title="Rotate 90° left"
        >
          ↺
        </button>
        <input
          type="number"
          min={0}
          max={360}
          value={heaterAngle}
          onChange={(e) => setHeaterAngle(((Number(e.target.value) % 360) + 360) % 360)}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'white',
            padding: '4px 8px',
            fontSize: 10,
            borderRadius: 3,
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            outline: 'none',
            textAlign: 'center',
          }}
        />
        <button
          onClick={() => setHeaterAngle((heaterAngle + 90) % 360)}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
          }}
          title="Rotate 90° right"
        >
          ↻
        </button>
      </div>

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
