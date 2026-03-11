import { useState } from 'react';

export default function LayoutCard({ layout, onClick, onDelete, onDuplicate }) {
  const [showMenu, setShowMenu] = useState(false);

  const formattedDate = layout.updated_at
    ? new Date(layout.updated_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : layout.date || '';

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 8,
        border: '1px solid #E5E9EF',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
        position: 'relative',
      }}
      onClick={onClick}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Thumbnail area */}
      <div
        style={{
          height: 140,
          background: '#F0F3F7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #E5E9EF',
        }}
      >
        {layout.thumbnail_url ? (
          <img
            src={layout.thumbnail_url}
            alt={layout.project_name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          // Placeholder icon
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            style={{ opacity: 0.3 }}
          >
            <rect
              x="8"
              y="8"
              width="32"
              height="32"
              stroke="#1B3557"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="8"
              y1="20"
              x2="40"
              y2="20"
              stroke="#1B3557"
              strokeWidth="1.5"
            />
            <line
              x1="20"
              y1="20"
              x2="20"
              y2="40"
              stroke="#1B3557"
              strokeWidth="1.5"
            />
            <rect
              x="24"
              y="26"
              width="10"
              height="8"
              fill="#f37021"
              opacity="0.5"
            />
          </svg>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: '12px 16px' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#1B3557',
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {layout.customer_name || 'Untitled'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#8AAABF',
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {layout.project_name || 'New Layout'}
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#B0BAC5',
          }}
        >
          {formattedDate}
        </div>
      </div>

      {/* Action buttons (show on hover) */}
      {showMenu && (
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            style={{
              width: 28,
              height: 28,
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #E5E9EF',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1B3557',
            }}
            title="Duplicate layout"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              width: 28,
              height: 28,
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #E5E9EF',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#f37021',
            }}
            title="Delete layout"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
