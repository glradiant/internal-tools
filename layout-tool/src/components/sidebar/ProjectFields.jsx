import useLayoutStore from '../../store/useLayoutStore';

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'white',
  padding: '5px 8px',
  fontSize: 11,
  borderRadius: 3,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function ProjectFields() {
  const projectName = useLayoutStore((s) => s.projectName);
  const customerName = useLayoutStore((s) => s.customerName);
  const customerAddress = useLayoutStore((s) => s.customerAddress);
  const preparedBy = useLayoutStore((s) => s.preparedBy);
  const quoteNumber = useLayoutStore((s) => s.quoteNumber);
  const date = useLayoutStore((s) => s.date);
  const setProjectName = useLayoutStore((s) => s.setProjectName);
  const setCustomerName = useLayoutStore((s) => s.setCustomerName);
  const setCustomerAddress = useLayoutStore((s) => s.setCustomerAddress);
  const setPreparedBy = useLayoutStore((s) => s.setPreparedBy);
  const setQuoteNumber = useLayoutStore((s) => s.setQuoteNumber);
  const setDate = useLayoutStore((s) => s.setDate);

  return (
    <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>
        PROJECT
      </div>
      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <input
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="Customer"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <input
        value={customerAddress}
        onChange={(e) => setCustomerAddress(e.target.value)}
        placeholder="Customer address"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <input
        value={preparedBy}
        onChange={(e) => setPreparedBy(e.target.value)}
        placeholder="Prepared by"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <input
        value={quoteNumber}
        onChange={(e) => setQuoteNumber(e.target.value)}
        placeholder="Quote #"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}
