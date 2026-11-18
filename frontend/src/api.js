const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function request(path, options = {}) {
  const token = localStorage.getItem('smartcampus_token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : 'Données invalides ou requête refusée.'
    throw new Error(detail)
  }
  return body
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  programs: () => request('/api/programs'),

  recommendations: () => request('/api/recommendations'),
  profile: () => request('/api/profile'),
  profileOptions: () => request('/api/profile/options'),
  updateProfile: (data) => request('/api/profile', { method: 'PUT', body: JSON.stringify(data) }),
  applications: () => request('/api/applications'),
  apply: (program_id, phone) => request('/api/applications', { method: 'POST', body: JSON.stringify({ program_id, phone, consent: true }) }),
  conversations: () => request('/api/conversations'),
  chat: (message, conversation_id) => request('/api/chat', { method: 'POST', body: JSON.stringify({ message, conversation_id }) }),
  dashboard: () => request('/api/dashboard'),

  // SA-25 / SA-26 — Chat visiteur sans compte
  guestChat: (message, session_token, conversation_id) =>
    request('/api/chat/guest', { method: 'POST', body: JSON.stringify({ message, session_token, ...(conversation_id ? { conversation_id } : {}) }) }),
  guestHistory: (session_token) =>
    request(`/api/chat/guest/${encodeURIComponent(session_token)}`),

  // SA-29 — Rattacher la session invitée au compte après connexion
  claimGuestSession: (session_token) =>
    request('/api/chat/guest/claim', { method: 'POST', body: JSON.stringify({ session_token }) }),
}

export function saveSession(session) {
  localStorage.setItem('smartcampus_token', session.access_token)
  localStorage.setItem('smartcampus_user', JSON.stringify(session.user))
}
export function clearSession() { localStorage.removeItem('smartcampus_token'); localStorage.removeItem('smartcampus_user') }
export function storedUser() { try { return JSON.parse(localStorage.getItem('smartcampus_user')) } catch { return null } }

// SA-25 — Génère ou récupère le session token du visiteur (stocké en localStorage)
export function getGuestToken() {
  let token = localStorage.getItem('smartcampus_guest_token')
  if (!token) {
    // Génère un UUID v4 simple
    token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    localStorage.setItem('smartcampus_guest_token', token)
  }
  return token
}

export function clearGuestToken() {
  localStorage.removeItem('smartcampus_guest_token')
  localStorage.removeItem('smartcampus_guest_conversation_id')
}
