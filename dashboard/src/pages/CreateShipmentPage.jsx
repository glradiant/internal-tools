import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const WORKER_URL = 'https://netsuite-integration.josh-0da.workers.dev';

const WAREHOUSES = {
  '1': { label: 'MN — Edina, MN', name: 'Great Lakes Radiant - MN', zip: '55439' },
  '2': { label: 'NE — Shrewsbury, MA', name: 'Great Lakes Radiant - NE', zip: '01545' },
  '3': { label: 'OH — Akron, OH', name: 'Great Lakes Radiant - OH', zip: '44312' },
  '4': { label: 'DRP — Warren, MI', name: 'Great Lakes Radiant - DRP', zip: '48089' },
};

const BILL_TO_LOCATIONS = {
  '1': { label: 'MN — Edina, MN' },
  '2': { label: 'NE — Shrewsbury, MA' },
  '3': { label: 'OH — Akron, OH' },
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
  ups:            (t) => `https://www.ups.com/track?tracknum=${t}`,
  stamps_com:     (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  usps:           (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  fedex:          (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  fedex_walleted: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

function formatServiceName(code) {
  if (!code) return '';
  if (SERVICE_NAMES[code]) return SERVICE_NAMES[code];
  // Custom casing for known carrier words; title-case everything else
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

// ── Shared styles ──────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: '#fff',
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  color: '#1a1a1a',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#344054',
  marginBottom: 4,
};

const sectionStyle = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e4e7ec',
  padding: 24,
  marginBottom: 20,
};

// ── Component ──────────────────────────────────────────────────────────────

export default function CreateShipmentPage({ session }) {
  // Form state
  const [fromWarehouse, setFromWarehouse] = useState('1');
  const [differentBilling, setDifferentBilling] = useState(false);
  const [billToOverride, setBillToOverride] = useState('1');
  // Custom ship-from fields (when fromWarehouse === 'other')
  const [customFromName, setCustomFromName] = useState('');
  const [customFromStreet, setCustomFromStreet] = useState('');
  const [customFromCity, setCustomFromCity] = useState('');
  const [customFromState, setCustomFromState] = useState('');
  const [customFromZip, setCustomFromZip] = useState('');
  const [customFromPhone, setCustomFromPhone] = useState('');
  const [toName, setToName] = useState('');
  const [toCompany, setToCompany] = useState('');
  const [toStreet1, setToStreet1] = useState('');
  const [toStreet2, setToStreet2] = useState('');
  const [toCity, setToCity] = useState('');
  const [toState, setToState] = useState('');
  const [toZip, setToZip] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [sendNotifications, setSendNotifications] = useState(true);
  const [residential, setResidential] = useState(false);
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  // Rate results
  const [rates, setRates] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(null);
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('cost'); // 'cost' | 'transit'

  // Purchase state
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [purchaseError, setPurchaseError] = useState(null);

  async function getAuthHeaders() {
    const { data: { session: s } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${s?.access_token}`, 'Content-Type': 'application/json' };
  }

  async function handleGetRates() {
    setRatesLoading(true);
    setRatesError(null);
    setRates(null);
    setSelectedRate(null);

    try {
      const fromZip = fromWarehouse === 'other' ? customFromZip : WAREHOUSES[fromWarehouse].zip;
      const payload = {
        fromPostalCode: fromZip,
        toPostalCode: toZip,
        residential,
        weight: { value: parseFloat(weight), unit: 'pound' },
      };

      const l = parseFloat(length), w = parseFloat(width), h = parseFloat(height);
      if (l > 0 && w > 0 && h > 0) {
        payload.dimensions = { length: l, width: w, height: h, unit: 'inch' };
      }

      const headers = await getAuthHeaders();
      const resp = await fetch(`${WORKER_URL}/shipping-rates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);

      setRates(data.rates || []);
    } catch (e) {
      setRatesError(e.message);
    } finally {
      setRatesLoading(false);
    }
  }

  async function handlePurchaseLabel() {
    if (!selectedRate) return;
    setPurchasing(true);
    setPurchaseError(null);

    try {
      const pkg = { weight: { value: parseFloat(weight), unit: 'pound' } };
      const l = parseFloat(length), w = parseFloat(width), h = parseFloat(height);
      if (l > 0 && w > 0 && h > 0) {
        pkg.dimensions = { length: l, width: w, height: h };
      }

      const isCustomOrigin = fromWarehouse === 'other';
      const payload = {
        carrierCode: selectedRate.carrierCode || selectedRate.carrier_code,
        serviceCode: selectedRate.serviceCode || selectedRate.service_code,
        packages: [pkg],
        ...(isCustomOrigin
          ? { shipFrom: { name: customFromName, street1: customFromStreet, city: customFromCity, state: customFromState, zip: customFromZip, phone: customFromPhone || undefined } }
          : { fromWarehouse }),
        billTo: isCustomOrigin || differentBilling ? billToOverride : (BILL_TO_LOCATIONS[fromWarehouse] ? fromWarehouse : '1'),
        toName,
        toCompany: toCompany || undefined,
        toStreet1,
        toStreet2: toStreet2 || undefined,
        toCity,
        toState,
        toZip,
        toPhone: toPhone || undefined,
        residential,
      };

      const headers = await getAuthHeaders();
      const resp = await fetch(`${WORKER_URL}/purchase-label`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);

      setPurchaseResult({
        ...data,
        carrierCode: selectedRate.carrierCode || selectedRate.carrier_code,
        serviceName: formatServiceName(selectedRate.serviceCode || selectedRate.service_code),
        cost: selectedRate.markedUpRate ?? selectedRate.shipping_amount?.amount ?? selectedRate.cost,
      });
    } catch (e) {
      setPurchaseError(e.message);
    } finally {
      setPurchasing(false);
    }
  }

  function handleReset() {
    setToName(''); setToCompany(''); setToStreet1(''); setToStreet2('');
    setToCity(''); setToState(''); setToZip(''); setToPhone(''); setToEmail(''); setSendNotifications(true);
    setWeight(''); setLength(''); setWidth(''); setHeight('');
    setResidential(false); setFromWarehouse('1'); setDifferentBilling(false); setBillToOverride('1');
    setCustomFromName(''); setCustomFromStreet(''); setCustomFromCity(''); setCustomFromState(''); setCustomFromZip(''); setCustomFromPhone('');
    setRates(null); setSelectedRate(null);
    setRatesError(null); setPurchaseResult(null); setPurchaseError(null);
  }

  // ── Validation ─────────────────────────────────────────────────────────

  const isCustomOrigin = fromWarehouse === 'other';
  const customFromValid = customFromName.trim() && customFromStreet.trim() && customFromCity.trim() && customFromState && customFromZip.trim().length >= 5;
  const canGetRates = toZip.trim().length >= 5 && parseFloat(weight) > 0 && (isCustomOrigin ? customFromZip.trim().length >= 5 : true);
  const canPurchase = selectedRate && toName.trim() && toStreet1.trim() && toCity.trim() && toState && toZip.trim() && (isCustomOrigin ? customFromValid : true) && (!sendNotifications || toEmail.trim());

  // ── Success view ───────────────────────────────────────────────────────

  if (purchaseResult) {
    const trackingUrl = (() => {
      const builder = TRACKING_URLS[purchaseResult.carrierCode] || TRACKING_URLS[purchaseResult.carrierCode?.split('_')[0]];
      return builder ? builder(purchaseResult.trackingNumber) : `https://www.google.com/search?q=${purchaseResult.trackingNumber}`;
    })();

    return (
      <div>
        <div style={{
          ...sectionStyle,
          textAlign: 'center',
          padding: 40,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: '#ecfdf3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="#12b76a">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
            Label Purchased Successfully
          </h3>
          <p style={{ fontSize: 14, color: '#667085', marginBottom: 28 }}>
            {purchaseResult.serviceName} &middot; {formatCarrier(purchaseResult.carrierCode)}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
            maxWidth: 480, margin: '0 auto 28px', textAlign: 'left',
          }}>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#667085', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tracking Number</div>
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: '#175cd3', textDecoration: 'none', wordBreak: 'break-all' }}>
                {purchaseResult.trackingNumber}
              </a>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#667085', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Label</div>
              <a href={purchaseResult.labelUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: '#175cd3', textDecoration: 'none' }}>
                Download PDF
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px', background: '#f37021', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Create Another Shipment
            </button>
            <a
              href="#/shipments"
              style={{
                padding: '10px 20px', background: '#fff', border: '1px solid #d0d5dd', borderRadius: 8,
                color: '#344054', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block',
              }}
            >
              View in Shipments
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────

  return (
    <div className="create-shipment-grid">
      <style>{`
        .create-shipment-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .create-shipment-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      {/* LEFT COLUMN — form */}
      <div>
      {/* Ship From */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: '0 0 16px' }}>Ship From</h3>
        <div>
          <label style={labelStyle}>Warehouse</label>
          <select
            value={fromWarehouse}
            onChange={(e) => {
              setFromWarehouse(e.target.value);
              if (e.target.value === 'other') {
                setDifferentBilling(false);
              }
            }}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {Object.entries(WAREHOUSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
            <option value="other">Other (custom address)</option>
          </select>
        </div>

        {/* Custom origin address fields */}
        {isCustomOrigin && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Name / Company *</label>
              <input style={inputStyle} value={customFromName} onChange={(e) => setCustomFromName(e.target.value)} placeholder="Sender name" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={customFromPhone} onChange={(e) => setCustomFromPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Street Address *</label>
              <input style={inputStyle} value={customFromStreet} onChange={(e) => setCustomFromStreet(e.target.value)} placeholder="Street address" />
            </div>
            <div>
              <label style={labelStyle}>City *</label>
              <input style={inputStyle} value={customFromCity} onChange={(e) => setCustomFromCity(e.target.value)} placeholder="City" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>State *</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={customFromState} onChange={(e) => setCustomFromState(e.target.value)}>
                  <option value="">—</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>ZIP *</label>
                <input style={inputStyle} value={customFromZip} onChange={(e) => setCustomFromZip(e.target.value)} placeholder="ZIP code" maxLength={10} />
              </div>
            </div>
          </div>
        )}

        {/* Bill To — always shown for custom origin, checkbox toggle for warehouses */}
        {isCustomOrigin ? (
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Bill To *</label>
            <select
              value={billToOverride}
              onChange={(e) => setBillToOverride(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {Object.entries(BILL_TO_LOCATIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#344054', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={differentBilling}
                  onChange={(e) => {
                    setDifferentBilling(e.target.checked);
                    if (!e.target.checked) setBillToOverride(fromWarehouse);
                  }}
                  style={{ width: 16, height: 16, accentColor: '#f37021' }}
                />
                Different billing location
              </label>
            </div>
            {differentBilling && (
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Bill To</label>
                <select
                  value={billToOverride}
                  onChange={(e) => setBillToOverride(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {Object.entries(BILL_TO_LOCATIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ship To */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: '0 0 16px' }}>Ship To</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Recipient name" />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input style={inputStyle} value={toCompany} onChange={(e) => setToCompany(e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Street Address *</label>
            <input style={inputStyle} value={toStreet1} onChange={(e) => setToStreet1(e.target.value)} placeholder="Street address" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Address Line 2</label>
            <input style={inputStyle} value={toStreet2} onChange={(e) => setToStreet2(e.target.value)} placeholder="Apt, suite, unit, etc." />
          </div>
          <div>
            <label style={labelStyle}>City *</label>
            <input style={inputStyle} value={toCity} onChange={(e) => setToCity(e.target.value)} placeholder="City" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>State *</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={toState} onChange={(e) => setToState(e.target.value)}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>ZIP *</label>
              <input style={inputStyle} value={toZip} onChange={(e) => setToZip(e.target.value)} placeholder="ZIP code" maxLength={10} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={toPhone} onChange={(e) => setToPhone(e.target.value)} placeholder="Optional" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#344054', cursor: 'pointer', userSelect: 'none', marginTop: 8 }}>
              <input
                type="checkbox"
                checked={residential}
                onChange={(e) => setResidential(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#f37021' }}
              />
              Residential address
            </label>
          </div>
          <div>
            <label style={labelStyle}>Email{sendNotifications ? ' *' : ''}</label>
            <input style={inputStyle} type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder={sendNotifications ? 'Required for notifications' : 'Optional'} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#344054', cursor: 'pointer', userSelect: 'none', marginTop: 8 }}>
              <input
                type="checkbox"
                checked={sendNotifications}
                onChange={(e) => setSendNotifications(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#f37021' }}
              />
              Send shipment notifications
            </label>
          </div>
        </div>
      </div>

      {/* Package Details */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: '0 0 16px' }}>Package</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Weight (lbs) *</label>
            <input style={inputStyle} type="number" min="0.1" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0" />
          </div>
          <div>
            <label style={labelStyle}>Length (in)</label>
            <input style={inputStyle} type="number" min="0" step="0.5" value={length} onChange={(e) => setLength(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label style={labelStyle}>Width (in)</label>
            <input style={inputStyle} type="number" min="0" step="0.5" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label style={labelStyle}>Height (in)</label>
            <input style={inputStyle} type="number" min="0" step="0.5" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="—" />
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#667085', marginTop: 8 }}>
          Dimensions are optional but recommended for accurate rates.
        </div>
      </div>

      {/* Get Rates Button */}
      {!rates && (
        <button
          onClick={handleGetRates}
          disabled={!canGetRates || ratesLoading}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: canGetRates && !ratesLoading ? '#f37021' : '#d0d5dd',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: canGetRates && !ratesLoading ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            marginBottom: 20,
            opacity: ratesLoading ? 0.7 : 1,
          }}
        >
          {ratesLoading ? 'Getting Rates...' : 'Get Shipping Rates'}
        </button>
      )}
      </div>

      {/* RIGHT COLUMN — rates + purchase */}
      <div style={{ position: 'sticky', top: 20 }}>
      {/* Rates Error */}
      {ratesError && (
        <div style={{
          background: '#fef3f2', border: '1px solid #fecdca', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#b42318',
        }}>
          {ratesError}
        </div>
      )}

      {/* Placeholder when no rates yet */}
      {!rates && !ratesLoading && !ratesError && (
        <div style={{
          ...sectionStyle, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 24px', textAlign: 'center', minHeight: 360,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #fff5f0 0%, #ffe8dc 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#f37021">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: '0 0 6px' }}>Shipping Rates</h3>
          <p style={{ fontSize: 13, color: '#667085', margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
            Fill in the ship-to address and package details, then click <strong style={{ color: '#344054' }}>Get Shipping Rates</strong> to see available options.
          </p>
        </div>
      )}

      {/* Loading placeholder */}
      {ratesLoading && (
        <div style={{
          ...sectionStyle, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 24px', textAlign: 'center', minHeight: 360,
        }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #e4e7ec', borderTopColor: '#f37021',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16,
          }} />
          <div style={{ fontSize: 13, color: '#667085' }}>Fetching rates from carriers…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Rate Cards */}
      {rates && rates.length > 0 && (() => {
        // Detect carrier group: UPS/USPS/FedEx based on carrierCode
        const carrierGroup = (r) => {
          const c = (r.carrierCode || r.carrier_code || '').toLowerCase();
          if (c.startsWith('ups')) return 'ups';
          if (c.startsWith('fedex')) return 'fedex';
          if (c === 'usps' || c === 'stamps_com' || c.startsWith('usps')) return 'usps';
          return c;
        };
        const displayRates = rates
          .filter(r => carrierFilter === 'all' || carrierGroup(r) === carrierFilter)
          .slice()
          .sort((a, b) => {
            if (sortBy === 'transit') {
              const da = a.deliveryDays ?? a.delivery_days ?? 999;
              const db = b.deliveryDays ?? b.delivery_days ?? 999;
              if (da !== db) return da - db;
            }
            const ca = a.markedUpRate ?? a.shipping_amount?.amount ?? a.cost ?? 0;
            const cb = b.markedUpRate ?? b.shipping_amount?.amount ?? b.cost ?? 0;
            return ca - cb;
          });

        return (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              Select a Rate
              <span style={{ fontSize: 12, fontWeight: 400, color: '#667085', marginLeft: 8 }}>
                {displayRates.length} option{displayRates.length !== 1 ? 's' : ''}
                {displayRates.length !== rates.length && ` of ${rates.length}`}
              </span>
            </h3>
            <button
              onClick={() => { setRates(null); setSelectedRate(null); }}
              style={{
                padding: '6px 12px', background: '#f9fafb', border: '1px solid #e4e7ec',
                borderRadius: 6, fontSize: 12, color: '#667085', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Edit Details
            </button>
          </div>

          {/* Filter + Sort controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { k: 'all',   label: 'All' },
                { k: 'ups',   label: 'UPS' },
                { k: 'usps',  label: 'USPS' },
                { k: 'fedex', label: 'FedEx' },
              ].map(opt => {
                const active = carrierFilter === opt.k;
                return (
                  <button key={opt.k} onClick={() => setCarrierFilter(opt.k)} style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                    border: active ? '1px solid #f37021' : '1px solid #e4e7ec',
                    background: active ? '#fff8f5' : '#fff',
                    color: active ? '#f37021' : '#344054',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{opt.label}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#667085' }}>Sort by:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                padding: '6px 10px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                border: '1px solid #d0d5dd', background: '#fff', color: '#344054',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <option value="cost">Lowest Cost</option>
                <option value="transit">Fastest Transit</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {displayRates.map((rate, i) => {
              const isSelected = selectedRate === rate;
              const chargedCost = rate.markedUpRate ?? rate.shipping_amount?.amount ?? rate.cost;
              const ourCost = rate.originalRate;
              const serviceCode = rate.serviceCode || rate.service_code;
              const carrierCode = rate.carrierCode || rate.carrier_code;
              const deliveryDays = rate.deliveryDays ?? rate.delivery_days;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedRate(rate)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    border: isSelected ? '2px solid #f37021' : '1px solid #e4e7ec',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isSelected ? '#fff8f5' : '#fff',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#f9a06c'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#e4e7ec'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Checkmark circle */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: isSelected ? 'none' : '2px solid #d0d5dd',
                      background: isSelected ? '#f37021' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="#fff">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                        {formatServiceName(serviceCode)}
                      </div>
                      <div style={{ fontSize: 12, color: '#667085', marginTop: 2 }}>
                        {formatCarrier(carrierCode)}
                        {deliveryDays != null && ` · ${deliveryDays} day${deliveryDays !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                      ${Number(ourCost ?? chargedCost).toFixed(2)}
                    </div>
                    {ourCost != null && chargedCost != null && (
                      <div style={{ fontSize: 11, color: '#98a2b3', marginTop: 2 }}>
                        charge ${Number(chargedCost).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Purchase Button */}
          <button
            onClick={handlePurchaseLabel}
            disabled={!canPurchase || purchasing}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: canPurchase && !purchasing ? '#f37021' : '#d0d5dd',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: canPurchase && !purchasing ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              marginTop: 20,
              opacity: purchasing ? 0.7 : 1,
            }}
          >
            {purchasing
              ? 'Purchasing Label...'
              : selectedRate
                ? `Purchase Label — $${Number(selectedRate.markedUpRate ?? selectedRate.shipping_amount?.amount ?? selectedRate.cost).toFixed(2)}`
                : 'Select a rate to continue'}
          </button>

          {purchaseError && (
            <div style={{
              background: '#fef3f2', border: '1px solid #fecdca', borderRadius: 8,
              padding: '12px 16px', marginTop: 12, fontSize: 13, color: '#b42318',
            }}>
              {purchaseError}
            </div>
          )}
        </div>
        );
      })()}

      {/* No rates found */}
      {rates && rates.length === 0 && (
        <div style={{
          ...sectionStyle, textAlign: 'center', padding: 40, color: '#667085',
        }}>
          <p style={{ fontSize: 14, margin: '0 0 12px' }}>No rates available for this route.</p>
          <button
            onClick={() => { setRates(null); setSelectedRate(null); }}
            style={{
              padding: '8px 16px', background: '#f37021', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Edit Details
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
