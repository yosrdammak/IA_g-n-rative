export default function KpiCard({ label, value, detail }) {
  return <div className="admin-kpi-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}
