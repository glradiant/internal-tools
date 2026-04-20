import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const WORKER_URL = 'https://netsuite-integration.josh-0da.workers.dev';
const NS_BASE = 'https://6914156.app.netsuite.com';

const STATUS_COLORS = {
  purchased:        { bg: '#f2f4f7', color: '#475467', dot: '#98a2b3' },
  in_transit:       { bg: '#eff8ff', color: '#175cd3', dot: '#2e90fa' },
  out_for_delivery: { bg: '#fff6ed', color: '#b93815', dot: '#f79009' },
  delivered:        { bg: '#ecfdf3', color: '#027a48', dot: '#12b76a' },
  voided:           { bg: '#fef3f2', color: '#b42318', dot: '#f04438' },
  exception:        { bg: '#fef3f2', color: '#b42318', dot: '#f04438' },
};

const STATUS_LABELS = {
  purchased: 'Purchased',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  voided: 'Voided',
  exception: 'Exception',
};

const SERVICE_NAMES = {
  ups_ground: 'UPS Ground',
  ups_ground_saver: 'UPS Ground Saver',
  ups_3_day_select: 'UPS 3 Day Select',
  ups_2nd_day_air: 'UPS 2nd Day Air',
  ups_next_day_air: 'UPS Next Day Air',
  ups_next_day_air_saver: 'UPS Next Day Air Saver',
  fedex_ground: 'FedEx Ground',
  fedex_home_delivery: 'FedEx Home Delivery',
  fedex_2day: 'FedEx 2Day',
  fedex_priority_overnight: 'FedEx Priority Overnight',
  usps_first_class_mail: 'USPS First Class',
  usps_priority_mail: 'USPS Priority Mail',
  usps_priority_mail_express: 'USPS Priority Express',
};

const CARRIER_DISPLAY = {
  ups: 'UPS', fedex: 'FedEx', fedex_walleted: 'FedEx', usps: 'USPS', stamps_com: 'USPS',
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

function formatServiceName(code) {
  if (!code) return '';
  if (SERVICE_NAMES[code]) return SERVICE_NAMES[code];
  const WORD_CASING = { ups: 'UPS', usps: 'USPS', fedex: 'FedEx', dhl: 'DHL' };
  return code.replace(/_/g, ' ').replace(/\b\w+/g, w => {
    const lc = w.toLowerCase();
    if (WORD_CASING[lc]) return WORD_CASING[lc];
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

function formatCarrier(code) {
  if (!code) return '';
  return CARRIER_DISPLAY[code] || code.toUpperCase();
}

function formatShortDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(v) {
  if (v == null) return '—';
  return `$${Number(v).toFixed(2)}`;
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.purchased;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, fontSize: 11,
      fontWeight: 600, background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function LocationBadge({ location }) {
  if (!location) return <span style={{ color: '#98a2b3' }}>—</span>;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11,
      fontWeight: 600, background: '#f2f4f7', color: '#344054',
    }}>{location}</span>
  );
}

function EtaCell({ shipment }) {
  const { status, actual_delivery, estimated_delivery } = shipment;
  if (status === 'delivered' && actual_delivery) {
    return <span style={{ color: '#027a48', fontWeight: 500 }}>{formatShortDate(actual_delivery)}</span>;
  }
  if (estimated_delivery) return <span style={{ color: '#667085' }}>{formatShortDate(estimated_delivery)}</span>;
  return <span style={{ color: '#98a2b3' }}>—</span>;
}

function SortHeader({ label, sortKey, sortCol, sortDir, onSort, style }) {
  const active = sortCol === sortKey;
  return (
    <th
      style={{ ...thStyle, ...style, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(sortKey)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {active && (
          <span style={{ fontSize: 9, lineHeight: 1, color: '#0D5C82' }}>
            {sortDir === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </span>
    </th>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ShipmentsPage({ session }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingIds, setRefreshingIds] = useState(new Set());
  const [selectedShipment, setSelectedShipment] = useState(null);
  // Void flow: which shipment is showing the confirm dialog, plus its in-progress state
  const [voidingShipment, setVoidingShipment] = useState(null);
  const [voidConfirmText, setVoidConfirmText] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState(null);

  // Server-side filters (trigger API call)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [search, setSearch] = useState('');

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Client-side filters
  const [carrierFilter, setCarrierFilter] = useState('');

  // Sort
  const [sortCol, setSortCol] = useState('purchased_at');
  const [sortDir, setSortDir] = useState('desc');

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  }, []);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (locationFilter) params.set('location', locationFilter);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    // Search is handled client-side for richer matching
    params.set('limit', '500');

    try {
      const resp = await fetch(`${WORKER_URL}/shipments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setShipments(await resp.json());
      else console.error('Failed to fetch shipments:', resp.status);
    } catch (e) { console.error('Shipments fetch error:', e); }
    setLoading(false);
  }, [statusFilter, locationFilter, fromDate, toDate, getToken]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  // ── Client-side filtering, searching, sorting ──────────────────────────

  const filtered = useMemo(() => {
    let result = shipments;

    // Carrier filter
    if (carrierFilter) {
      result = result.filter(s => {
        const c = (s.carrier || '').toLowerCase();
        const target = carrierFilter.toLowerCase();
        return c === target || c.startsWith(target + '_') || CARRIER_DISPLAY[c]?.toLowerCase() === target;
      });
    }

    // Client-side search (richer than server-side)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        (s.netsuite_so_number || '').toLowerCase().includes(q) ||
        (s.order_number || '').toLowerCase().includes(q) ||
        (s.tracking_number || '').toLowerCase().includes(q) ||
        (s.ship_to_name || '').toLowerCase().includes(q) ||
        (s.ship_to_company || '').toLowerCase().includes(q) ||
        (s.ship_to_city || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      // Numeric columns
      if (['quoted_cost', 'actual_cost'].includes(sortCol)) {
        av = av != null ? Number(av) : -Infinity;
        bv = bv != null ? Number(bv) : -Infinity;
      }
      // Null handling
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      // String compare
      if (typeof av === 'string') {
        const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }
      // Number/date compare
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

    return result;
  }, [shipments, carrierFilter, search, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Metrics ────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total = filtered.length;
    const inTransit = filtered.filter(s => s.status === 'in_transit' || s.status === 'out_for_delivery').length;
    const totalCost = filtered.reduce((sum, s) => sum + (s.actual_cost != null ? Number(s.actual_cost) : (s.quoted_cost != null ? Number(s.quoted_cost) : 0)), 0);
    const avgCost = total > 0 ? totalCost / total : 0;
    return { total, inTransit, totalCost, avgCost };
  }, [filtered]);

  // ── Dynamic filter options ─────────────────────────────────────────────

  const locations = useMemo(() => [...new Set(shipments.map(s => s.ship_from_location).filter(Boolean))].sort(), [shipments]);
  const carriers = useMemo(() => [...new Set(shipments.map(s => formatCarrier(s.carrier)).filter(Boolean))].sort(), [shipments]);

  // ── Actions ────────────────────────────────────────────────────────────

  const refreshOne = async (id) => {
    setRefreshingIds(s => new Set([...s, id]));
    const token = await getToken();
    try {
      const resp = await fetch(`${WORKER_URL}/shipments/${id}/refresh-status`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const updated = await resp.json();
        setShipments(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
        if (selectedShipment?.id === id) setSelectedShipment(prev => ({ ...prev, ...updated }));
      }
    } catch (e) { console.error('Refresh error:', e); }
    setRefreshingIds(s => { const n = new Set(s); n.delete(id); return n; });
  };

  /** Open the void confirmation dialog. */
  const openVoidDialog = (shipment) => {
    setVoidingShipment(shipment);
    setVoidConfirmText('');
    setVoidError(null);
  };

  /** Close the void dialog without doing anything. */
  const closeVoidDialog = () => {
    setVoidingShipment(null);
    setVoidConfirmText('');
    setVoidError(null);
  };

  /** Execute the void via Worker. */
  const confirmVoid = async () => {
    if (!voidingShipment) return;
    setVoidLoading(true);
    setVoidError(null);
    const token = await getToken();
    try {
      const resp = await fetch(`${WORKER_URL}/shipments/${voidingShipment.id}/void`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_tracking_number: voidingShipment.tracking_number }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setVoidError(data.error || `HTTP ${resp.status}`);
        setVoidLoading(false);
        return;
      }
      // Update the row in the list and the open detail modal
      const updated = data.shipment || { ...voidingShipment, status: 'voided' };
      setShipments(prev => prev.map(s => s.id === voidingShipment.id ? { ...s, ...updated } : s));
      if (selectedShipment?.id === voidingShipment.id) {
        setSelectedShipment(prev => ({ ...prev, ...updated }));
      }
      closeVoidDialog();
    } catch (e) {
      setVoidError(e.message);
    }
    setVoidLoading(false);
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const applyDatePreset = (preset) => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    let from;
    switch (preset) {
      case '30': from = new Date(today); from.setDate(from.getDate() - 30); break;
      case '60': from = new Date(today); from.setDate(from.getDate() - 60); break;
      case '90': from = new Date(today); from.setDate(from.getDate() - 90); break;
      case 'ytd': from = new Date(today.getFullYear(), 0, 1); break;
      case 'year': from = new Date(today); from.setFullYear(from.getFullYear() - 1); break;
      default: return;
    }
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to);
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, locationFilter, carrierFilter, search]);

  // Lock body scroll when any modal (detail or void confirmation) is open
  useEffect(() => {
    const open = !!selectedShipment || !!voidingShipment;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [selectedShipment, voidingShipment]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <MetricCard label="Total Shipments" value={metrics.total} />
        <MetricCard label="In Transit" value={metrics.inTransit} />
        <MetricCard label="Total Cost" value={formatCurrency(metrics.totalCost)} />
        <MetricCard label="Avg Cost" value={formatCurrency(metrics.avgCost)} />
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20,
        padding: 16, background: '#fff', borderRadius: 8,
        border: '1px solid #e4e7ec', alignItems: 'end',
      }}>
        <FilterField label="From">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
        </FilterField>
        <div style={{ display: 'flex', gap: 4, alignItems: 'end', paddingBottom: 1 }}>
          {[['30', '30d'], ['60', '60d'], ['90', '90d'], ['ytd', 'YTD'], ['year', '1yr']].map(([key, label]) => (
            <button key={key} onClick={() => applyDatePreset(key)} style={{
              padding: '5px 8px', fontSize: 11, fontWeight: 500, borderRadius: 4,
              border: '1px solid #d0d5dd', background: '#fff', color: '#344054',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>
        <FilterField label="Status">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </FilterField>
        <FilterField label="Location">
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={inputStyle}>
            <option value="">All</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </FilterField>
        <FilterField label="Carrier">
          <select value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)} style={inputStyle}>
            <option value="">All Carriers</option>
            {carriers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FilterField>
        <FilterField label="Search" flex>
          <input
            type="text" placeholder="Name, city, SO #, tracking #..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchShipments()}
            style={inputStyle}
          />
        </FilterField>
        <button onClick={fetchShipments} style={{ ...btnStyle, background: '#0D5C82', color: '#fff' }}>Search</button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e4e7ec', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e4e7ec' }}>
              <SortHeader label="Order #" sortKey="order_number" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Shipped" sortKey="purchased_at" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th style={thStyle}>Tracking</th>
              <SortHeader label="Carrier / Service" sortKey="service" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Ship To" sortKey="ship_to_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Location" sortKey="ship_from_location" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Cost" sortKey="actual_cost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Charged" sortKey="quoted_cost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="ETA / Delivered" sortKey="estimated_delivery" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Status" sortKey="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th style={{ ...thStyle, width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#98a2b3' }}>Loading...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#98a2b3' }}>No shipments found</td></tr>
            ) : paged.map(s => (
              <tr
                key={s.id}
                onClick={() => setSelectedShipment(s)}
                style={{ borderBottom: '1px solid #f2f4f7', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Order # */}
                <td style={tdStyle}>
                  {s.netsuite_so_id ? (
                    <a href={`${NS_BASE}/app/accounting/transactions/salesord.nl?id=${s.netsuite_so_id}`}
                      target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      style={{ color: '#0D5C82', fontWeight: 600, textDecoration: 'none' }}
                    >{s.netsuite_so_number || s.order_number || s.netsuite_so_id}</a>
                  ) : (
                    <span style={{ color: '#98a2b3' }}>—</span>
                  )}
                </td>
                {/* Shipped */}
                <td style={tdStyle}>
                  <span style={{ color: '#667085', fontSize: 12 }}>{formatShortDate(s.purchased_at) || '—'}</span>
                </td>
                {/* Tracking */}
                <td style={tdStyle}>
                  <a href={getTrackingUrl(s.carrier, s.tracking_number)} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: '#0D5C82', textDecoration: 'none', fontSize: 13 }}
                  >{s.tracking_number}</a>
                </td>
                {/* Carrier / Service */}
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{formatCarrier(s.carrier)}</div>
                  <div style={{ fontSize: 11, color: '#667085' }}>{formatServiceName(s.service)}</div>
                </td>
                {/* Ship To */}
                <td style={tdStyle}>
                  <div style={{ fontWeight: 400 }}>{s.ship_to_name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#667085' }}>{[s.ship_to_city, s.ship_to_state].filter(Boolean).join(', ')}</div>
                </td>
                {/* Location */}
                <td style={tdStyle}><LocationBadge location={s.ship_from_location} /></td>
                {/* Cost */}
                <td style={tdStyle}>{formatCurrency(s.actual_cost)}</td>
                {/* Charged */}
                <td style={tdStyle}>{formatCurrency(s.quoted_cost)}</td>
                {/* ETA / Delivered */}
                <td style={tdStyle}><EtaCell shipment={s} /></td>
                {/* Status */}
                <td style={tdStyle}><StatusBadge status={s.status} /></td>
                {/* Refresh */}
                <td style={tdStyle}>
                  <button
                    onClick={e => { e.stopPropagation(); refreshOne(s.id); }}
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
      {/* Pagination */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#667085' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>
            {filtered.length === 0 ? '0' : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)}`} of {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#d0d5dd' }}>|</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Per page:
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ padding: '2px 6px', border: '1px solid #d0d5dd', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={{ ...pageBtnStyle, opacity: currentPage === 1 ? 0.4 : 1 }}>‹ Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? <span key={`e${i}`} style={{ padding: '0 4px', color: '#98a2b3' }}>...</span> : (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    style={{ ...pageBtnStyle, background: p === currentPage ? '#0D5C82' : '#fff', color: p === currentPage ? '#fff' : '#344054', borderColor: p === currentPage ? '#0D5C82' : '#d0d5dd' }}
                  >{p}</button>
                )
              )}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              style={{ ...pageBtnStyle, opacity: currentPage === totalPages ? 0.4 : 1 }}>Next ›</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Detail Modal */}
      {selectedShipment && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelectedShipment(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 12, width: 560, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}
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
                <DetailRow label="Carrier" value={formatCarrier(selectedShipment.carrier)} />
                <DetailRow label="Service" value={formatServiceName(selectedShipment.service)} />
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
              {Array.isArray(selectedShipment.tracking_events) && selectedShipment.tracking_events.length > 0 && (
                <DetailSection title="Tracking Timeline">
                  <TrackingTimeline events={selectedShipment.tracking_events} />
                </DetailSection>
              )}
              <DetailSection title="Cost & References">
                <DetailRow label="Charged" value={formatCurrency(selectedShipment.quoted_cost)} />
                <DetailRow label="Actual Cost" value={formatCurrency(selectedShipment.actual_cost)} />
                <DetailRow label="Bill-To ZIP" value={selectedShipment.bill_to_zip} />
                <DetailRow label="Order #" value={selectedShipment.order_number || selectedShipment.netsuite_so_number || selectedShipment.netsuite_so_id || '—'} />
                <DetailRow label="IF #" value={selectedShipment.netsuite_if_number || selectedShipment.netsuite_if_id || '—'} />
                <DetailRow label="Label ID" value={selectedShipment.source_shipment_id} />
                <DetailRow label="Purchased By" value={selectedShipment.purchased_by_email} />
                <DetailRow label="Purchased At" value={selectedShipment.purchased_at ? new Date(selectedShipment.purchased_at).toLocaleString() : '—'} />
                <DetailRow label="Last Checked" value={selectedShipment.last_status_check ? new Date(selectedShipment.last_status_check).toLocaleString() : '—'} />
              </DetailSection>
              {(selectedShipment.source_label_url || selectedShipment.status === 'purchased') && (
                <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {selectedShipment.source_label_url && (
                    <a href={selectedShipment.source_label_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', padding: '8px 20px', background: '#0D5C82', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                    >View / Reprint Label</a>
                  )}
                  {selectedShipment.status === 'purchased' && selectedShipment.label_source === 'shipengine' && (
                    <button
                      onClick={() => openVoidDialog(selectedShipment)}
                      style={{
                        padding: '8px 20px', background: '#fff', color: '#b42318', border: '1px solid #fda29b',
                        borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >Void Label</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Dialog */}
      {voidingShipment && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={voidLoading ? undefined : closeVoidDialog}
        >
          <div
            style={{ background: '#fff', borderRadius: 12, width: 480, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e4e7ec', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#fef3f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b42318" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1d2939' }}>Void Label</h3>
            </div>

            <div style={{ padding: '16px 20px', fontSize: 13, color: '#344054', lineHeight: 1.55 }}>
              <p style={{ margin: '0 0 12px' }}>
                Voiding requests a refund from the carrier. Once voided, the label cannot be reused.
                The carrier may reject the void if the package has already been scanned.
              </p>

              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#667085' }}>Carrier</span>
                  <span style={{ color: '#1d2939', fontWeight: 500 }}>{formatCarrier(voidingShipment.carrier)} {voidingShipment.service ? `· ${formatServiceName(voidingShipment.service)}` : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#667085' }}>Tracking</span>
                  <span style={{ color: '#1d2939', fontFamily: 'monospace' }}>{voidingShipment.tracking_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#667085' }}>Cost</span>
                  <span style={{ color: '#1d2939' }}>{voidingShipment.actual_cost != null ? `$${Number(voidingShipment.actual_cost).toFixed(2)}` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#667085' }}>Ship To</span>
                  <span style={{ color: '#1d2939' }}>{voidingShipment.ship_to_name || '—'}</span>
                </div>
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475467', marginBottom: 6 }}>
                Type <strong>CANCEL</strong> to confirm:
              </label>
              <input
                type="text"
                value={voidConfirmText}
                onChange={e => setVoidConfirmText(e.target.value.toUpperCase())}
                placeholder="CANCEL"
                disabled={voidLoading}
                autoFocus
                style={{
                  width: '100%', padding: '8px 10px', fontSize: 13,
                  border: '1px solid #d0d5dd', borderRadius: 6, boxSizing: 'border-box',
                  background: voidLoading ? '#f9fafb' : '#fff',
                  letterSpacing: 1,
                }}
              />

              {voidError && (
                <div style={{
                  marginTop: 12, padding: '8px 12px', background: '#fef3f2',
                  border: '1px solid #fecdca', borderRadius: 6, fontSize: 12, color: '#b42318',
                }}>{voidError}</div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e4e7ec', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={closeVoidDialog}
                disabled={voidLoading}
                style={{
                  padding: '8px 16px', background: '#fff', color: '#344054', border: '1px solid #d0d5dd',
                  borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: voidLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >Cancel</button>
              <button
                onClick={confirmVoid}
                disabled={voidLoading || voidConfirmText !== 'CANCEL'}
                style={{
                  padding: '8px 16px',
                  background: voidConfirmText === 'CANCEL' && !voidLoading ? '#b42318' : '#fee4e2',
                  color: voidConfirmText === 'CANCEL' && !voidLoading ? '#fff' : '#f97066',
                  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: voidConfirmText === 'CANCEL' && !voidLoading ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >{voidLoading ? 'Voiding...' : 'Void Label'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, border: '1px solid #e4e7ec',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1d2939' }}>{value}</div>
    </div>
  );
}

function FilterField({ label, children, flex }) {
  return (
    <div style={flex ? { flex: 1, minWidth: 180 } : undefined}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

/** Scan timeline — renders newest event at the top, color-coded by event type. */
function TrackingTimeline({ events }) {
  // Sort newest first by occurred_at timestamp
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.occurred_at || a.carrier_occurred_at || 0).getTime();
    const tb = new Date(b.occurred_at || b.carrier_occurred_at || 0).getTime();
    return tb - ta;
  });

  const dotColor = (ev) => {
    const code = (ev.status_code || '').toUpperCase();
    if (code === 'DE' || code === 'SP') return '#12b76a'; // delivered green
    if (code === 'EX') return '#f04438';                  // exception red
    if (code === 'AT') return '#f79009';                  // attempt orange
    return '#2e90fa';                                      // in_transit blue
  };

  const fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      {/* Vertical connector line */}
      <div style={{
        position: 'absolute', left: 5, top: 6, bottom: 6,
        width: 1, background: '#e4e7ec',
      }} />
      {sorted.map((ev, i) => (
        <div key={i} style={{ position: 'relative', paddingBottom: 12 }}>
          {/* Dot */}
          <div style={{
            position: 'absolute', left: -20, top: 4,
            width: 11, height: 11, borderRadius: '50%',
            background: dotColor(ev), border: '2px solid #fff',
            boxShadow: '0 0 0 1px #e4e7ec',
          }} />
          {/* Content */}
          <div style={{ fontSize: 13, color: '#1d2939', fontWeight: 500 }}>
            {ev.description || ev.status_description || ev.carrier_status_description || '—'}
          </div>
          <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>
            {fmt(ev.occurred_at || ev.carrier_occurred_at)}
            {(ev.city_locality || ev.state_province) && (
              <> · {[ev.city_locality, ev.state_province].filter(Boolean).join(', ')}</>
            )}
          </div>
        </div>
      ))}
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

// ── Style constants ─────────────────────────────────────────────────────────

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 };
const inputStyle = { padding: '7px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const btnStyle = { padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: 0.5 };
const tdStyle = { padding: '10px 12px', verticalAlign: 'top' };
const pageBtnStyle = { padding: '4px 10px', fontSize: 12, fontWeight: 500, borderRadius: 4, border: '1px solid #d0d5dd', background: '#fff', color: '#344054', cursor: 'pointer', fontFamily: 'inherit' };
