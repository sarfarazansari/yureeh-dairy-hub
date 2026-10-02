export function KPI({
  label,
  value,
  foot,
  accent,
}: {
  label: string;
  value: string;
  foot: string;
  accent?: boolean;
}) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: '#b58137' } : undefined}>
        {value}
      </div>
      <div className="kpi-foot">{foot}</div>
    </div>
  );
}
