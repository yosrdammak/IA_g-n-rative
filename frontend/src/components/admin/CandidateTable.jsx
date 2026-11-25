import StatusBadge from '../shared/StatusBadge'

export default function CandidateTable({ applications = [] }) {
  if (!applications.length) return <div className="empty"><span>○</span><p>Aucune candidature à afficher.</p></div>
  return <table><thead><tr><th>ID</th><th>Formation</th><th>Statut</th><th>Date</th></tr></thead><tbody>{applications.map(application => <tr key={application.id}><td>#{application.id}</td><td>Programme #{application.program_id}</td><td><StatusBadge status={application.status} /></td><td>{application.created_at ? new Date(application.created_at).toLocaleDateString('fr-FR') : '—'}</td></tr>)}</tbody></table>
}
