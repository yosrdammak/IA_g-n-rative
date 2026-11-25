import { useState } from 'react'
import { api, getGuestToken, clearGuestToken } from '../../api'

/**
 * SA-29 — Affiché juste après une connexion/inscription si l'utilisateur
 * avait une session invitée active. Propose de rattacher les conversations.
 */
export default function ClaimSessionBanner({ onDismiss }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [message, setMessage] = useState('')

  async function claim() {
    const guestToken = localStorage.getItem('smartcampus_guest_token')
    if (!guestToken) { onDismiss?.(); return }
    setStatus('loading')
    try {
      const result = await api.claimGuestSession(guestToken)
      setMessage(result.message)
      setStatus('done')
      clearGuestToken()
      setTimeout(() => onDismiss?.(), 3000)
    } catch (err) {
      setMessage(err.message || 'Impossible de rattacher la conversation.')
      setStatus('error')
    }
  }

  function dismiss() {
    clearGuestToken()
    onDismiss?.()
  }

  if (status === 'done') {
    return (
      <div className="claim-banner claim-success" role="status">
        ✅ {message}
      </div>
    )
  }

  return (
    <div className="claim-banner" role="alert">
      <p>
        Vous avez une conversation en tant que visiteur.{' '}
        Voulez-vous la rattacher à votre compte ?
      </p>
      {status === 'error' && <p className="claim-error">{message}</p>}
      <div className="claim-actions">
        <button onClick={claim} disabled={status === 'loading'} className="btn-primary">
          {status === 'loading' ? 'Rattachement…' : 'Oui, récupérer ma conversation'}
        </button>
        <button onClick={dismiss} className="btn-secondary">Non, ignorer</button>
      </div>
    </div>
  )
}
