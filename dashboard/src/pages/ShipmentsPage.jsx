import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const WORKER_URL = 'https://netsuite-integration.josh-0da.workers.dev';
const NS_BASE = 'https://6914156.app.netsuite.com';

const STATUS_COLORS = {
  purchased:        { bg: '#f2f4f7', color: '#475467' },
  in_transit:       { bg: '#eff8ff', color: '#175cd3' },
  out_for_delivery: { bg: '#fff6ed', color: '#b93815' },
  delivered:        { bg: '#ecfdf3', color: '#027a48' },
  voided:           { bg: '#fef3f2', color: '#b42318' },
  exception:        { bg: '#fef3f2', color: '#b42318' },
};

const STATUS_LABELS = {
  purchased: 'Purchased',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  voided: 'Voided',
  exception: 'Exception',
};

const TRACKING_URLS = {
  ups:             (t) => `https://www.ups.com/track?tracknum=${t}`,
  stamps_com:      (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  usps:            (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  fedex:           (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  fedex_walleted:  (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
};

function getTrackingUrl(carrier, tracking) {
  const builder = TRACKING_URLS[carrier] || TRACKING_URLS[carrier?.split('_')[0]];
  return builder ? builder(tracking) : `https://www.google.com/search?q=${tracking}`;
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.purchased;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
      fontWeight: 600, background: s.bg, color: s.color, textTransform: 'capitalize',
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function ShipmentsPage({ session }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingIds, setRefreshingIds] = useState(new Set());
  const [refreshAllLoading, setRefreshAllLoading] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);

  // Filters
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  }, []);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (location) params.set('location', location);
    if (search) params.set('search', search);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);

    try {
      const resp = await fetch(`${WORKER_URL}/shipments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setShipments(await resp.json());
      } else {
        console.error('Failed to fetch shipments:', resp.status);
      }
    } catch (e) {
      console.error('Shipments fetch error:', e);
    }
    setLoading(false);
  }, [status, location, search, fromDate, toDate, getToken]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const refreshOne = async (id) => {
    setRefreshingIds((s) => new Set([...s, id]));
    const token = await getToken();
    try {
      const resp = await fetch(`${WORKER_URL}/shipments/${id}/refresh-status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const updated = await resp.json();
        setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
        if (selectedShipment?.id === id) setSelectedShipment((prev) => ({ ...prev, ...updated }));
      }
    } catch (e) { console.error('Refresh error:', e); }
    setRefreshingIds((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const refreshAll = async () => {
    setRefreshAllLoading(true);
    const active = shipments.filter((s) => s.status !== 'delivered' && s.status !== 'voided');
    for (const s of active) {
      await refreshOne(s.id);
    }
    setRefreshAllLoading(false);
  };

  const locations = [...new Set(shipments.map((s) => s.ship_from_location).filter(Boolean))].sort();

  return (
    <div>
      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20,
        padding: 16, background: '#fff', borderRadius: 8,
        border: '1px solid #e4e7ec', alignItems: 'end',
      }}>
        <div>
          <label style={labelStyle}>From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle}>
            <option value="">All</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={labelStyle}>Search</label>
          <input
            type="text" placeholder="SO # or tracking #" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchShipments()}
            style={inputStyle}
          />
        </div>
        <button onClick={fetchShipments} style={{ ...btnStyle, background: '#0D5C82', color: '#fff' }}>
          Search
        </button>
        <button onClick={refreshAll} disabled={refreshAllLoading} style={{ ...btnStyle, background: '#fff', color: '#0D5C82', border: '1px solid #0D5C82' }}>
          {refreshAllLoading ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e4e7ec', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e4e7ec' }}>
              <th style={thStyle}>Order #</th>
              <th style={thStyle}>Tracking</th>
              <th style={thStyle}>Carrier / Service</th>
              <th style={thStyle}>Ship To</th>
              <th style={thStyle}>Location</th>
              <th style={thStyle}>Cost</th>
              <th style={thStyle}>ETA</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#98a2b3' }}>Loading...</td></tr>
            ) : shipments.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#98a2b3' }}>No shipments found</td></tr>
            ) : shipments.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelectedShipment(s)}
                style={{ borderBottom: '1px solid #f2f4f7', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={tdStyle}>
                  {s.netsuite_so_id ? (
                    <a
                      href={`${NS_BASE}/app/accounting/transactions/salesord.nl?id=${s.netsuite_so_id}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#0D5C82', fontWeight: 600, textDecoration: 'none' }}
                    >{s.order_number || s.netsuite_so_number || s.netsuite_so_id}</a>
                  ) : (
                    <span style={{ color: s.order_number ? '#1d2939' : '#98a2b3', fontWeight: s.order_number ? 500 : 400 }}>
                      {s.order_number || s.netsuite_so_number || '—'}
                    </span>
                  )}
                </td>
                <td style={tdStyle}>
                  <a
                    href={getTrackingUrl(s.carrier, s.tracking_number)}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: '#0D5C82', textDecoration: 'none', fontFamily: 'monospace', fontSize: 11 }}
                  >{s.tracking_number}</a>
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{(s.carrier || '').toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: '#667085' }}>{s.service || ''}</div>
                </td>
                <td style={tdStyle}>
                  <div>{s.ship_to_name}</div>
                  <div style={{ fontSize: 11, color: '#667085' }}>{[s.ship_to_city, s.ship_to_state].filter(Boolean).join(', ')}</div>
                </td>
                <td style={tdStyle}>{s.ship_from_location || '—'}</td>
                <td style={tdStyle}>{s.actual_cost != null ? `$${Number(s.actual_cost).toFixed(2)}` : s.quoted_cost != null ? `$${Number(s.quoted_cost).toFixed(2)}` : '—'}</td>
                <td style={tdStyle}>{formatDate(s.estimated_delivery)}</td>
                <td style={tdStyle}><StatusBadge status={s.status} /></td>
                <td style={tdStyle}>
                  <button
                    onClick={(e) => { e.stopPropagation(); refreshOne(s.id); }}
                    disabled={refreshingIds.has(s.id)}
                    title="Refresh tracking"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      opacity: refreshingIds.has(s.id) ? 0.4 : 0.6,
                      animation: refreshingIds.has(s.id) ? 'spin 1s linear infinite' : 'none',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#98a2b3' }}>
        {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Detail Modal */}
      {selectedShipment && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelectedShipment(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 12, width: 560, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e4e7ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Shipment Detail</h3>
              <button onClick={() => setSelectedShipment(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#98a2b3' }}>&times;</button>
            </div>
            <div style={{ padding: 20, fontSize: 13, lineHeight: 1.8 }}>
              <DetailSection title="Shipment">
                <DetailRow label="Tracking" value={
                  <a href={getTrackingUrl(selectedShipment.carrier, selectedShipment.tracking_number)} target="_blank" rel="noopener noreferrer" style={{ color: '#0D5C82' }}>
                    {selectedShipment.tracking_number}
                  </a>
                } />
                <DetailRow label="Carrier" value={(selectedShipment.carrier || '').toUpperCase()} />
                <DetailRow label="Service" value={selectedShipment.service} />
                <DetailRow label="Status" value={<StatusBadge status={selectedShipment.status} />} />
                <DetailRow label="Status Detail" value={selectedShipment.status_detail} />
                <DetailRow label="ETA" value={formatDate(selectedShipment.estimated_delivery)} />
                <DetailRow label="Delivered" value={selectedShipment.actual_delivery ? formatDate(selectedShipment.actual_delivery) : '—'} />
              </DetailSection>
              <DetailSection title="Package">
                <DetailRow label="Weight" value={selectedShipment.weight_lbs ? `${selectedShipment.weight_lbs} lb` : '—'} />
                <DetailRow label="Dimensions" value={selectedShipment.length_in ? `${selectedShipment.length_in} x ${selectedShipment.width_in} x ${selectedShipment.height_in}"` : '—'} />
              </DetailSection>
              <DetailSection title="Ship From">
                <DetailRow label="Location" value={selectedShipment.ship_from_location} />
                <DetailRow label="Name" value={selectedShipment.ship_from_name} />
                <DetailRow label="Address" value={[selectedShipment.ship_from_address1, [selectedShipment.ship_from_city, selectedShipment.ship_from_state, selectedShipment.ship_from_zip].filter(Boolean).join(', ')].filter(Boolean).join('\n')} />
              </DetailSection>
              <DetailSection title="Ship To">
                <DetailRow label="Name" value={selectedShipment.ship_to_name} />
                <DetailRow label="Company" value={selectedShipment.ship_to_company} />
                <DetailRow label="Address" value={[selectedShipment.ship_to_address1, [selectedShipment.ship_to_city, selectedShipment.ship_to_state, selectedShipment.ship_to_zip].filter(Boolean).join(', ')].filter(Boolean).join('\n')} />
                <DetailRow label="Phone" value={selectedShipment.ship_to_phone} />
              </DetailSection>
              <DetailSection title="Cost & References">
                <DetailRow label="Quoted Cost" value={selectedShipment.quoted_cost != null ? `$${Number(selectedShipment.quoted_cost).toFixed(2)}` : '—'} />
                <DetailRow label="Actual Cost" value={selectedShipment.actual_cost != null ? `$${Number(selectedShipment.actual_cost).toFixed(2)}` : '—'} />
                <DetailRow label="Bill-To ZIP" value={selectedShipment.bill_to_zip} />
                <DetailRow label="Order #" value={selectedShipment.order_number || selectedShipment.netsuite_so_number || selectedShipment.netsuite_so_id || '—'} />
                <DetailRow label="IF #" value={selectedShipment.netsuite_if_number || selectedShipment.netsuite_if_id || '—'} />
                <DetailRow label="ShipStation ID" value={selectedShipment.shipstation_shipment_id} />
                <DetailRow label="Purchased By" value={selectedShipment.purchased_by_email} />
                <DetailRow label="Purchased At" value={selectedShipment.purchased_at ? new Date(selectedShipment.purchased_at).toLocaleString() : '—'} />
                <DetailRow label="Last Checked" value={selectedShipment.last_status_check ? new Date(selectedShipment.last_status_check).toLocaleString() : '—'} />
              </DetailSection>
              {selectedShipment.shipstation_label_url && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <a
                    href={selectedShipment.shipstation_label_url}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-block', padding: '8px 20px', background: '#0D5C82', color: '#fff',
                      borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    }}
                  >View / Reprint Label</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0D5C82', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, borderBottom: '1px solid #f2f4f7', paddingBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ width: 110, flexShrink: 0, fontWeight: 600, color: '#475467' }}>{label}</span>
      <span style={{ color: '#1d2939', whiteSpace: 'pre-line' }}>{value || '—'}</span>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 };
const inputStyle = { padding: '7px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const btnStyle = { padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: 0.5 };
const tdStyle = { padding: '10px 12px', verticalAlign: 'top' };
