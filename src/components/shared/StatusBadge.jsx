import { CANDIDATE_STATUSES, DOCUMENT_STATUSES, APPOINTMENT_STATUSES } from '../../lib/types'

const tone = { accepte: 'success', accepté: 'success', inscrit: 'success', confirmé: 'success', terminé: 'success', nouveau: 'info', orienté: 'info', reçu: 'info', proposé: 'info', préinscrit: 'warning', qcm_fait: 'warning', rdv_planifié: 'warning', en_vérification: 'warning', entretien: 'warning', rejeté: 'danger', refusé: 'danger', annulé: 'danger', abandon: 'danger', manquant: 'danger' }

export default function StatusBadge({ status }) {
  const known = [...CANDIDATE_STATUSES, ...DOCUMENT_STATUSES, ...APPOINTMENT_STATUSES].includes(status)
  return <span className={`status-badge status-${tone[status] || 'neutral'}`} aria-label={`Statut : ${status}`}>{known ? status.replace('_', ' ') : status}</span>
}
