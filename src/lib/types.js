/** @typedef {'candidat'|'administrateur'|'responsable_iit'|'responsable_isb'|'responsable_entretien'} Role */
/** @typedef {'nouveau'|'orienté'|'préinscrit'|'qcm_fait'|'rdv_planifié'|'entretien'|'inscrit'|'abandon'|'rejeté'} CandidateStatus */
/** @typedef {'manquant'|'reçu'|'en_vérification'|'accepté'|'rejeté'} DocumentStatus */
/** @typedef {'proposé'|'confirmé'|'refusé'|'annulé'|'terminé'} AppointmentStatus */

export const ROLES = ['candidat', 'administrateur', 'responsable_iit', 'responsable_isb', 'responsable_entretien']
export const CANDIDATE_STATUSES = ['nouveau', 'orienté', 'préinscrit', 'qcm_fait', 'rdv_planifié', 'entretien', 'inscrit', 'abandon', 'rejeté']
export const DOCUMENT_STATUSES = ['manquant', 'reçu', 'en_vérification', 'accepté', 'rejeté']
export const APPOINTMENT_STATUSES = ['proposé', 'confirmé', 'refusé', 'annulé', 'terminé']
