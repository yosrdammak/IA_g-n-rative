import { useState, useEffect, useRef } from 'react'
import { api, getGuestToken, storedUser } from '../../api'

/**
 * ChatInterface — fonctionne pour les utilisateurs connectés ET les visiteurs.
 *
 * Modes de réponse :
 *   • catalogue  — règles locales du backend (sans LLM)
 *   • ollama     — LLM Ollama sans RAG
 *   • rag        — RAG (ChromaDB + bge-m3 + llama3.2:3b) sur base IIT Sfax ✅
 *   • rag_error  — RAG demandé mais service indisponible
 *
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
  // Mode RAG activé/désactivé par l'utilisateur
  const [ragEnabled, setRagEnabled] = useState(true)
  // Statut de disponibilité du service RAG
  const [ragAvailable, setRagAvailable] = useState(null)
  // Sources affichées sous un message assistant RAG
  const [expandedSources, setExpandedSources] = useState(null)

  const bottomRef = useRef(null)

  // Vérifier la disponibilité du service RAG au montage
  useEffect(() => {
    api.ragStatus()
      .then((data) => setRagAvailable(data.available))
      .catch(() => setRagAvailable(false))
  }, [])

  // SA-26 : charger l'historique de la session visiteur au montage
  useEffect(() => {
    if (isLogged) return
    const token = getGuestToken()
    if (!token) return
    api.guestHistory?.(token).then((convs) => {
      if (convs && convs.length > 0) {
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

      if (ragEnabled && ragAvailable) {
        // --- Mode RAG ---
        if (isLogged) {
          result = await api.ragChat(userText, conversationId)
        } else {
          result = await api.ragChatGuest(userText)
        }
      } else {
        // --- Mode catalogue / Ollama (existant) ---
        if (isLogged) {
          result = await api.chat(userText, conversationId)
        } else {
          const guestToken = getGuestToken()
          result = await api.guestChat(userText, guestToken, conversationId)
          localStorage.setItem('smartcampus_guest_conversation_id', result.conversation_id)
        }
      }

      if (result.conversation_id) {
        setConversationId(result.conversation_id)
      }

      // Ajouter le message assistant avec sources éventuelles
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: result.reply,
          mode: result.mode || 'catalogue',
          sources: result.sources || [],
        },
      ])
    } catch (err) {
      setError(err.message || "Erreur lors de l'envoi du message.")
    } finally {
      setLoading(false)
    }
  }

  function toggleSources(idx) {
    setExpandedSources((prev) => (prev === idx ? null : idx))
  }

  function modeBadge(mode) {
    const labels = {
      rag: { text: '📚 RAG', title: 'Réponse générée par le RAG (base de connaissances IIT Sfax)', cls: 'badge-rag' },
      rag_error: { text: '⚠️ RAG', title: 'Service RAG indisponible — réponse de secours', cls: 'badge-rag-error' },
      ollama: { text: '🤖 LLM', title: 'Réponse générée par Ollama (llama3.2:3b)', cls: 'badge-ollama' },
      catalogue: { text: '📋 Catalogue', title: 'Réponse du catalogue statique', cls: 'badge-catalogue' },
      catalogue_fallback: { text: '📋 Catalogue', title: 'Fallback catalogue (Ollama indisponible)', cls: 'badge-catalogue' },
    }
    const info = labels[mode] || labels['catalogue']
    return <span className={`mode-badge ${info.cls}`} title={info.title}>{info.text}</span>
  }

  return (
    <section className="chat panel" aria-label="Assistant IA">
      <div className="chat-head">
        <div>
          <p className="eyebrow">ASSISTANT SMARTCAMPUS</p>
          <h3>Posez votre question</h3>
        </div>

        {/* Contrôle du mode RAG */}
        <div className="rag-toggle-row">
          <label className="rag-toggle" title={
            ragAvailable === null
              ? 'Vérification du service RAG…'
              : ragAvailable
              ? 'Basculer entre le mode RAG (base de connaissances IIT) et le mode catalogue'
              : 'Service RAG indisponible (Ollama non démarré ?)'
          }>
            <input
              type="checkbox"
              checked={ragEnabled && ragAvailable === true}
              onChange={(e) => setRagEnabled(e.target.checked)}
              disabled={ragAvailable !== true}
            />
            <span className="rag-toggle-label">
              {ragAvailable === null && '⏳ RAG…'}
              {ragAvailable === true && (ragEnabled ? '📚 RAG activé' : '📋 Catalogue')}
              {ragAvailable === false && '⚠️ RAG hors ligne'}
            </span>
          </label>
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
            <div className="message-body">
              <p>{m.text}</p>

              {/* Affichage du mode et des sources pour les messages assistant */}
              {m.sender === 'assistant' && m.mode && (
                <div className="message-meta">
                  {modeBadge(m.mode)}

                  {m.sources && m.sources.length > 0 && (
                    <button
                      className="sources-toggle link-btn"
                      onClick={() => toggleSources(i)}
                      aria-expanded={expandedSources === i}
                    >
                      {expandedSources === i
                        ? '▲ Masquer les sources'
                        : `▼ ${m.sources.length} source${m.sources.length > 1 ? 's' : ''}`}
                    </button>
                  )}
                </div>
              )}

              {/* Panneau des sources */}
              {expandedSources === i && m.sources && m.sources.length > 0 && (
                <ul className="sources-list" aria-label="Sources utilisées">
                  {m.sources.map((s, si) => (
                    <li key={si} className="source-item">
                      <strong>{s.id}</strong> — {s.titre}
                      {s.categorie && <span className="source-cat"> [{s.categorie}]</span>}
                      <p className="source-extrait">{s.extrait}</p>
                      {s.source_url && (
                        <a
                          href={s.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          🔗 iit.tn
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
          placeholder={
            ragEnabled && ragAvailable
              ? 'Posez une question sur l\'IIT Sfax (admissions, frais, formations…)'
              : 'Écrivez votre question…'
          }
          disabled={loading}
        />
        <button disabled={loading || !message.trim()} aria-label="Envoyer">↑</button>
      </form>
    </section>
  )
}
