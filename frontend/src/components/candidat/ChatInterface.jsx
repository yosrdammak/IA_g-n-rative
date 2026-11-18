import { useState, useEffect, useRef } from 'react'
import { api, getGuestToken, storedUser } from '../../api'

/**
 * ChatInterface — fonctionne pour les utilisateurs connectés ET les visiteurs.
 * SA-25 : session visiteur via session_token stocké en localStorage
 * SA-26 : mémoire temporaire chargée depuis le backend au montage
 * SA-29 : proposition de rattachement après connexion/inscription
 */
export default function ChatInterface({ onNeedLogin }) {
  const isLogged = Boolean(storedUser())

  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversationId, setConversationId] = useState(() =>
    isLogged ? null : (Number(localStorage.getItem('smartcampus_guest_conversation_id')) || null)
  )
  const bottomRef = useRef(null)

  // SA-26 : charger l'historique de la session visiteur au montage
  useEffect(() => {
    if (isLogged) return
    const token = getGuestToken()
    api.guestHistory(token).then((convs) => {
      if (convs.length > 0) {
        const latest = convs[0]
        setConversationId(latest.id)
        setMessages(latest.messages)
        localStorage.setItem('smartcampus_guest_conversation_id', latest.id)
      }
    }).catch(() => {})
  }, [isLogged])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(event) {
    event.preventDefault()
    if (!message.trim()) return
    const userText = message.trim()
    setMessage('')
    setError('')
    setMessages((prev) => [...prev, { sender: 'user', text: userText }])
    setLoading(true)
    try {
      let result
      if (isLogged) {
        result = await api.chat(userText, conversationId)
      } else {
        const guestToken = getGuestToken()
        result = await api.guestChat(userText, guestToken, conversationId)
        localStorage.setItem('smartcampus_guest_conversation_id', result.conversation_id)
      }
      setConversationId(result.conversation_id)
      setMessages((prev) => [...prev, { sender: 'assistant', text: result.reply }])
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'envoi du message.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="chat panel" aria-label="Assistant IA">
      <div className="chat-head">
        <div>
          <p className="eyebrow">ASSISTANT SMARTCAMPUS</p>
          <h3>Posez votre question</h3>
        </div>
        {/* SA-29 : bannière d'invitation à se connecter pour sauvegarder */}
        {!isLogged && messages.length > 0 && (
          <div className="guest-banner" role="alert">
            <span>💡 Votre conversation est temporaire (24 h).</span>
            {onNeedLogin && (
              <button className="link-btn" onClick={onNeedLogin}>
                Connectez-vous pour la sauvegarder
              </button>
            )}
          </div>
        )}
      </div>

      <div className="messages">
        {messages.length === 0 && !loading && (
          <p className="chat-empty">Bonjour ! Comment puis-je vous aider pour votre orientation ?</p>
        )}
        {messages.map((m, i) => (
          <div key={i} dir="auto" className={`message ${m.sender}`}>
            <span>{m.sender === 'assistant' ? 'SC' : 'Vous'}</span>
            <p>{m.text}</p>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <span>SC</span>
            <p className="typing">…</p>
          </div>
        )}
        {error && <p className="chat-error" role="alert">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-message">Votre question</label>
        <input
          id="chat-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Écrivez votre question…"
          disabled={loading}
        />
        <button disabled={loading || !message.trim()} aria-label="Envoyer">↑</button>
      </form>
    </section>
  )
}
