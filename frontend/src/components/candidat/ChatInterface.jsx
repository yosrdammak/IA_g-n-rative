import { useState } from 'react'
import { api } from '../../lib/api'

export default function ChatInterface() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  async function send(event) { event.preventDefault(); if (!message.trim()) return; setLoading(true); try { const result = await api.chat(message); setReply(result.reply); setMessage('') } finally { setLoading(false) } }
  return <section className="chat panel" aria-label="Assistant IA"><div className="chat-head"><div><p className="eyebrow">ASSISTANT SMARTCAMPUS</p><h3>Posez votre question</h3></div></div><div className="messages">{reply && <div dir="auto" className="message assistant"><span>SC</span><p>{reply}</p></div>}</div><form className="chat-input" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Votre question</label><input id="chat-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="Écrivez votre question…" /><button disabled={loading} aria-label="Envoyer">↑</button></form></section>
}
