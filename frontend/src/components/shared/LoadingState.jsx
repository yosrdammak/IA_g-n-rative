export default function LoadingState({ label = 'Chargement en cours…' }) {
  return <div className="loading" role="status" aria-live="polite"><span />{label}</div>
}
