import { useCallback, useEffect, useState } from 'react'
import { api, clearSession, saveSession, storedUser } from './api'
import EmptyState from './components/shared/EmptyState'
import './SmartCampus.css'
import './components/components.css'

const CURRENT_YEAR = new Date().getFullYear()
const nav = [{ id: 'dashboard', label: 'Vue d’ensemble', icon: 'home' }, { id: 'profile', label: 'Mon profil', icon: 'profile' }, { id: 'programs', label: 'Programmes', icon: 'grid' }, { id: 'orientation', label: 'Mon orientation', icon: 'spark' }, { id: 'application', label: 'Ma candidature', icon: 'check' }, { id: 'assistant', label: 'Assistant IA', icon: 'chat' }]
const PROFILE_COMPLETION_FIELDS = ['academic_level', 'interests', 'goals', 'bac_section', 'bac_year', 'bac_average', 'subject_grades', 'criteria']
function profileCompletion(profile) {
  const criteriaComplete = profile?.max_budget && profile?.study_duration && profile?.city && profile?.learning_style
  const isComplete = key => key === 'criteria'
    ? Boolean(criteriaComplete)
    : key === 'subject_grades'
      ? Object.keys(profile?.subject_grades || {}).length > 0
      : Boolean(String(profile?.[key] ?? '').trim())
  const completed = PROFILE_COMPLETION_FIELDS.filter(isComplete).length
  return Math.round((completed / PROFILE_COMPLETION_FIELDS.length) * 100)
}
function Brand() { return <div className="brand"><img src="/smartCampus logo.png" alt="SmartCampus AI" /><span>smart<span>campus</span><small>AI</small></span></div> }
function Icon({ name, size = 19 }) { const paths = { home: <path d="m3 9 6-5 6 5v6H4V9m3 6v-4h4v4" />, grid: <><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="10" y="3" width="5" height="5" rx="1" /><rect x="3" y="10" width="5" height="5" rx="1" /><rect x="10" y="10" width="5" height="5" rx="1" /></>, spark: <path d="m9 2 1.2 4.8L15 8l-4.8 1.2L9 14l-1.2-4.8L3 8l4.8-1.2L9 2Z" />, check: <path d="m3 9 4 4 7-8" />, chat: <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h7A2.5 2.5 0 0 1 15 4.5v4a2.5 2.5 0 0 1-2.5 2.5H8l-4 3v-3.5A2.5 2.5 0 0 1 3 9V4.5Z" />, profile: <><circle cx="9" cy="6" r="2.5" /><path d="M4 15a5 5 0 0 1 10 0" /></>, bell: <path d="M4 11h10l-1.2-1.7V6a3.8 3.8 0 0 0-7.6 0v3.3L4 11Zm4.2 2a1.1 1.1 0 0 0 1.6 0" />, sun: <><circle cx="9" cy="9" r="3" /><path d="M9 1v2m0 12v2M1 9h2m12 0h2M3.3 3.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M4.7 13.3l-1.4 1.4" /></>, moon: <path d="M14.5 11.8A6 6 0 0 1 6.2 3.5 6.5 6.5 0 1 0 14.5 11.8Z" /> }; return <svg className="ui-icon" width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg> }
function Theme({ theme, onClick }) { return <button className="icon-button" onClick={onClick} aria-label="Changer de thème"><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button> }
export default function SmartCampus() {
  const route = window.location.pathname
  const initialView = route.includes('/assistant') ? 'assistant' : route.includes('/orientation') ? 'orientation' : route.includes('/dossier') ? 'application' : route.includes('/programmes') ? 'programs' : route.includes('/profil') ? 'profile' : 'dashboard'
  const [user, setUser] = useState(storedUser()); const [view, setViewState] = useState(initialView); const [theme, setTheme] = useState(() => localStorage.getItem('smartcampus_theme') || 'light'); const [auth, setAuth] = useState(route === '/auth/signup' ? 'signup' : route === '/auth' ? 'login' : null)
  const setView = nextView => { const paths = { dashboard: '/candidat', programs: '/candidat/programmes', orientation: '/candidat/orientation', application: '/candidat/dossier', assistant: '/candidat/assistant', profile: '/candidat/profil' }; window.history.pushState({}, '', paths[nextView] || '/candidat'); setViewState(nextView) }
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('smartcampus_theme', theme); if (window.location.pathname === '/') window.history.replaceState({}, '', '/interface') }, [theme])
  const toggle = () => setTheme(theme === 'light' ? 'dark' : 'light'); const login = session => { saveSession(session); setUser(session.user); setAuth(null) }; const logout = () => { clearSession(); setUser(null) }
  if (auth) return <Auth mode={auth} switchMode={setAuth} success={login} back={() => setAuth(null)} />
  if (!user) return <Landing theme={theme} toggle={toggle} auth={setAuth} />
  if (user.role !== 'candidate') return <Admin user={user} theme={theme} toggle={toggle} logout={logout} />
  return <Candidate user={user} view={view} setView={setView} theme={theme} toggle={toggle} logout={logout} />
}
function Landing({ theme, toggle, auth }) { const steps = ['Conversation', 'Orientation', 'Préinscription', 'QCM & rendez-vous']; return <main className="landing"><header className="public-header"><Brand /><nav><a href="#programmes">Programmes</a><a href="#methode">Notre méthode</a><Theme theme={theme} onClick={toggle} /><button className="button ghost" onClick={() => auth('login')}>Se connecter</button><button className="button primary" onClick={() => auth('signup')}>Commencer</button></nav></header><section className="hero-section"><div className="hero-copy"><p className="eyebrow">ORIENTATION UNIVERSITAIRE · IIT × ISB</p><h1>Le bon parcours commence par <em>une bonne question.</em></h1><p className="hero-text">SmartCampus vous aide à comprendre vos options, clarifier votre projet et avancer vers l'admission avec des informations fiables.</p><div className="hero-actions"><button className="button primary large" onClick={() => auth('signup')}>Démarrer mon orientation ↗</button><button className="text-button" onClick={() => auth('login')}>J'ai déjà un compte →</button></div><div className="trust-row"><span>✓ Données protégées</span><span>✓ Accompagnement humain</span><span>✓ Sources officielles</span></div></div><div className="hero-visual"><img className="hero-photo" src="/iit3.jpg" alt="Campus de l'Institut International de Technologie" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="signal-card"><span className="signal-dot" /> VOTRE PROJET, EN CLAIR</div><div className="path-card"><span className="path-number">01</span><strong>Explorer</strong><span>Comprendre les parcours</span></div><div className="path-card second"><span className="path-number">02</span><strong>Choisir</strong><span>Une recommandation argumentée</span></div><div className="hero-core">SC<span>AI</span></div></div></section><section className="metrics"><div><strong>5</strong><span>étapes guidées</span></div><div><strong>2</strong><span>établissements</span></div><div><strong>100%</strong><span>votre décision</span></div><p>Un espace pensé pour<br /><b>votre prochaine étape.</b></p></section><section id="methode" className="method"><div><p className="eyebrow">UNE MÉTHODE SIMPLE</p><h2>Du premier doute<br />au projet qui avance.</h2></div><div className="method-grid">{steps.map((step, i) => <article key={step}><span>0{i + 1}</span><h3>{step}</h3><p>{['Posez vos questions en français, tunisien ou Arabizi.', 'Comparez des parcours selon votre profil.', 'Constituez votre dossier étape par étape.', 'Préparez la suite avec les équipes IIT et ISB.'][i]}</p></article>)}</div></section><section id="programmes" className="institutions"><div><p className="eyebrow">DES PARCOURS CONCRETS</p><h2>IIT ou ISB.<br /><em>Votre futur, votre choix.</em></h2></div><div className="institution-cards"><div className="institution"><img src="/iit.png" alt="Logo IIT" /><h3>Institut International de Technologie</h3><p>Préparatoire, Licence et Ingénierie pour construire une expertise solide.</p><a href="#top">Découvrir →</a></div><div className="institution isb"><img src="/instutue.jfif" alt="Campus ISB" /><h3>International School of Business</h3><p>Management, Finance et Marketing pour donner de l'impact à vos idées.</p><a href="#top">Découvrir →</a></div></div></section><footer><Brand /><div><strong>SmartCampus AI</strong><span>IIT · ISB · Sfax, Tunisie</span><span>© 2026 · Orientation et admission universitaire</span></div></footer></main> }
function Auth({ mode, switchMode, success, back }) { const signup = mode === 'signup'; const [form, setForm] = useState({ email: signup ? '' : 'candidat@demo.tn', password: '', full_name: '' }); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); async function submit(event) { event.preventDefault(); setLoading(true); setError(''); try { success(signup ? await api.register(form) : await api.login(form.email, form.password)) } catch (err) { setError(err.message) } finally { setLoading(false) } } return <main className="auth-page"><div className="auth-aside"><img className="auth-image" src="/jj.jpg" alt="Étudiante dans un espace universitaire" /><div className="auth-overlay" /><div className="auth-aside-content"><button className="back-link" onClick={back}>← Retour à l'accueil</button><Brand /><div className="auth-quote"><p className="eyebrow">VOTRE PROJET MÉRITE DE LA CLARTÉ</p><h1>Chaque parcours<br /><em>commence ici.</em></h1><p>Un espace unique pour explorer, comprendre et choisir avec confiance.</p></div></div></div><div className="auth-form"><div className="form-inner"><div className="mobile-brand"><Brand /></div><p className="eyebrow">{signup ? 'CRÉER MON ESPACE' : 'BON RETOUR'}</p><h2>{signup ? 'Commencez votre parcours.' : 'Ravi de vous revoir.'}</h2><p className="muted">{signup ? 'Quelques informations pour personnaliser votre orientation.' : 'Connectez-vous pour retrouver votre projet.'}</p><form onSubmit={submit}>{signup && <label>Nom complet<input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Yasmine Ben Ali" /></label>}<label>Adresse email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vous@exemple.tn" /></label><label>Mot de passe<input required minLength="8" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="8 caractères minimum" /></label>{error && <div className="form-error">{error}</div>}<button className="button primary wide" disabled={loading}>{loading ? 'Connexion en cours…' : signup ? 'Créer mon espace →' : 'Se connecter →'}</button></form><div className="demo-box"><strong>Compte de démonstration</strong><span>{signup ? 'Ou utilisez une adresse email libre pour créer un compte.' : 'candidat@demo.tn · DemoCampus2026! (si démo activée)'}</span></div><p className="switch-auth">{signup ? 'Vous avez déjà un compte ?' : 'Pas encore de compte ?'} <button onClick={() => switchMode(signup ? 'login' : 'signup')}>{signup ? 'Se connecter' : 'Créer un compte'}</button></p></div></div></main> }
function recommendationSignature(result) {
  return (result?.recommendations || [])
    .map(item => `${item.program.id}:${item.score}`)
    .join('|')
}

function Candidate({ user, view, setView, theme, toggle, logout }) {
  const [data, setData] = useState({ programs: [], applications: [], recommendations: null })
  const [completion, setCompletion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rankingChanged, setRankingChanged] = useState(false)
  const rankingStorageKey = `smartcampus_last_seen_ranking_${user.id}`

  useEffect(() => {
    Promise.all([api.programs(), api.applications(), api.recommendations(), api.profile()])
      .then(([programs, applications, recommendations, profile]) => {
        setData({ programs, applications, recommendations })
        setCompletion(profileCompletion(profile))
        setLoadError('')
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [view])

  const handleProfileSaved = useCallback(recommendations => {
    const lastSeen = localStorage.getItem(rankingStorageKey)
    if (lastSeen && lastSeen !== recommendationSignature(recommendations)) {
      setRankingChanged(true)
    }
    setData(current => ({ ...current, recommendations }))
  }, [rankingStorageKey])

  const handleProfileChange = useCallback(profile => {
    setCompletion(profileCompletion(profile))
  }, [])

  const handleConsultation = useCallback(() => {
    localStorage.setItem(rankingStorageKey, recommendationSignature(data.recommendations))
  }, [data.recommendations, rankingStorageKey])

  return (
    <div className={`app-shell ${view === 'dashboard' ? 'dashboard-shell' : ''}`}>
      <aside className="sidebar">
        <Brand />
        <div className="side-label">ESPACE CANDIDAT</div>
        <nav>{nav.map(item => <button className={view === item.id ? 'active' : ''} key={item.id} onClick={() => setView(item.id)}><span><Icon name={item.icon} /></span>{item.label}{item.id === 'profile' && <small className="profile-completion-badge">{completion === null ? '—' : `${completion}%`}</small>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="support"><span>?</span><div><strong>Besoin d'aide ?</strong><small>Parler à un conseiller</small></div></div><button className="logout" onClick={logout}>↪ Déconnexion</button></div>
      </aside>
      <main className="workspace">
        <header className={`app-header ${view === 'dashboard' ? 'dashboard-header' : ''}`}>
          <div className="mobile-brand"><Brand /></div>
          <div className={view === 'assistant' ? 'assistant-page-title' : ''}>{view === 'assistant' ? <><span className="header-assistant-orb">✦</span><div><h1>Assistant IA</h1><p>Votre compagnon intelligent pour répondre à toutes vos questions sur SmartCampus.</p></div></> : <><p className="date-label"></p><h1>{nav.find(item => item.id === view)?.label || 'Mon profil'}</h1></>}</div>
          <div className="header-actions"><Theme theme={theme} onClick={toggle} /><button className="notification" aria-label="Notifications"><Icon name="bell" /><i /></button><button className="profile-trigger" onClick={() => setView('profile')}><span className="avatar">{user.full_name?.slice(0, 1).toUpperCase() || 'C'}</span><span><strong>{user.full_name?.split(' ')[0] || 'Candidat'}</strong><small>Candidat</small></span></button></div>
        </header>
        <div className="content">
          {loading ? <div className="loading"><span />Chargement de votre espace…</div> : loadError ? <div className="form-error">{loadError}</div> : view === 'dashboard' ? <Dashboard user={user} data={data} setView={setView} /> : view === 'programs' ? <Programs programs={data.programs} /> : view === 'orientation' ? <Orientation data={data} setView={setView} rankingChanged={rankingChanged} onConsultation={handleConsultation} /> : view === 'application' ? <Application data={data} setData={setData} /> : view === 'profile' ? <Profile user={user} onProfileChange={handleProfileChange} onProfileSaved={(recommendations, profile) => { setCompletion(profileCompletion(profile)); handleProfileSaved(recommendations) }} /> : <Assistant />}
        </div>
      </main>
    </div>
  )
}

const DEFAULT_INTERESTS = [
  { id: 'ai_data', label: 'Intelligence Artificielle & Data', icon: '🤖' },
  { id: 'software_web', label: 'Génie Logiciel & Web', icon: '💻' },
  { id: 'cybersecurity', label: 'Cybersécurité & Réseaux', icon: '🔒' },
  { id: 'cloud_devops', label: 'Cloud & DevOps', icon: '☁️' },
  { id: 'embedded_iot', label: 'Systèmes Embarqués & IoT', icon: '⚙️' },
  { id: 'management', label: 'Management & Entrepreneuriat', icon: '📈' },
  { id: 'finance', label: 'Finance & Banque', icon: '📊' },
  { id: 'marketing', label: 'Marketing Digital & Business', icon: '🎯' },
  { id: 'math_physics', label: 'Mathématiques & Sciences', icon: '📐' },
  { id: 'commerce', label: 'Commerce International', icon: '🌐' },
]

const DEFAULT_CAMPUSES = [
  { value: 'Campus El Ons', label: 'Campus El Ons (IIT)' },
  { value: 'Campus Mharza', label: 'Campus Mharza (IIT)' },
  { value: 'Campus El OnsISB', label: 'Campus El Ons (ISB)' },
]

const SUBJECT_LABELS = {
  mathematiques: 'Mathématiques',
  physique: 'Sciences physiques (physique et chimie)',
  svt: 'Sciences de la vie et de la Terre (SVT)',
  informatique: 'Informatique',
  technique: 'Technologie',
  tp_technologie: 'Travaux pratiques de technologie',
  economie: 'Économie',
  gestion: 'Gestion',
  francais: 'Français',
  anglais: 'Anglais',
  arabe: 'Arabe',
  philosophie: 'Philosophie',
  histoire_geographie: 'Histoire-géographie',
  sport: 'Éducation physique',
  algo_prog: 'Algorithmique et programmation',
  sti: "Sciences et technologies de l'informatique (STI)",
  informatique_pratique: 'Informatique pratique',
  pensee_islamique: 'Pensée islamique',
  sciences_biologiques: 'Sciences biologiques',
  sport_theorique: 'Sport théorique',
  sport_pratique: 'Sport pratique',
}

const DEFAULT_SECTION_SUBJECTS = {
  mathematiques: [
    'mathematiques', 'physique', 'svt', 'informatique',
    'arabe', 'francais', 'anglais', 'philosophie', 'sport',
  ],
  sciences_experimentales: [
    'svt', 'physique', 'mathematiques', 'informatique',
    'arabe', 'francais', 'anglais', 'philosophie', 'sport',
  ],
  informatique: [
    'algo_prog', 'mathematiques', 'sti', 'physique',
    'informatique_pratique', 'arabe', 'francais', 'anglais',
    'philosophie', 'sport',
  ],
  sciences_techniques: [
    'technique', 'mathematiques', 'physique', 'tp_technologie',
    'informatique', 'arabe', 'francais', 'anglais', 'philosophie', 'sport',
  ],
  economie_gestion: [
    'economie', 'gestion', 'mathematiques', 'histoire_geographie',
    'informatique', 'arabe', 'francais', 'anglais', 'philosophie', 'sport',
  ],
  lettres: [
    'arabe', 'philosophie', 'histoire_geographie', 'francais',
    'anglais', 'pensee_islamique', 'informatique', 'sport',
  ],
  sport: [
    'sciences_biologiques', 'francais', 'philosophie', 'anglais',
    'mathematiques', 'physique', 'arabe', 'sport_theorique',
    'sport_pratique', 'sport',
  ],
}

function Profile({ user, onProfileChange, onProfileSaved }) {
  const [form, setForm] = useState({
    academic_level: '',
    interests: '',
    goals: '',
    preferred_language: 'fr',
    bac_section: '',
    bac_year: '',
    bac_average: '',
    subject_grades: {},
    max_budget: '',
    study_duration: '',
    city: '',
    learning_style: '',
    optional_subject_name: '',
  })
  const [options, setOptions] = useState({
    bac_sections: [],
    subjects: [],
    section_subjects: {},
    learning_styles: [],
    campuses: DEFAULT_CAMPUSES,
    cities: [],
    popular_interests: DEFAULT_INTERESTS,
  })
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.profile(), api.profileOptions()])
      .then(([profile, opts]) => {
        setOptions(opts)
        setForm({
          ...profile,
          bac_section: profile.bac_section || '',
          bac_year: profile.bac_year ?? '',
          bac_average: profile.bac_average ?? '',
          subject_grades: Object.fromEntries(
            Object.entries(profile.subject_grades || {}).map(([k, v]) => [k, String(v)])
          ),
          max_budget: profile.max_budget ?? '',
          study_duration: profile.study_duration ? String(profile.study_duration) : '',
          city: profile.city || '',
          learning_style: profile.learning_style || '',
          optional_subject_name: profile.optional_subject_name || '',
        })
      })
      .catch(err => setStatus(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) onProfileChange(form)
  }, [form, loading, onProfileChange])

  const setGrade = (subject, value) =>
    setForm({ ...form, subject_grades: { ...form.subject_grades, [subject]: value } })

  const toggleInterest = (label) => {
    const list = (form.interests || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const exists = list.some(item => item.toLowerCase() === label.toLowerCase())
    const next = exists
      ? list.filter(item => item.toLowerCase() !== label.toLowerCase())
      : [...list, label]
    setForm({ ...form, interests: next.join(', ') })
  }

  const isInterestSelected = (label) => {
    return (form.interests || '').toLowerCase().includes(label.toLowerCase())
  }

  async function submit(event) {
    event.preventDefault()
    setStatus('')
    const toNumber = value => (value === '' || value === null ? null : Number(value))
    try {
      await api.updateProfile({
        ...form,
        bac_section: form.bac_section || null,
        bac_year: toNumber(form.bac_year),
        bac_average: toNumber(form.bac_average),
        subject_grades: Object.fromEntries(
          Object.entries(form.subject_grades)
            .filter(([, v]) => v !== '' && v !== null && !isNaN(Number(v)))
            .map(([k, v]) => [k, Number(v)])
        ),
        max_budget: toNumber(form.max_budget),
        study_duration: form.study_duration ? Number(form.study_duration) : null,
        city: form.city || null,
        learning_style: form.learning_style || null,
        optional_subject_name: form.optional_subject_name?.trim() || null,
      })
      const recommendations = await api.recommendations()
      onProfileSaved(recommendations, form)
      setStatus('Profil mis à jour avec succès. Vos recommandations ont été recalculées.')
    } catch (err) {
      setStatus(err.message)
    }
  }

  if (loading) return <div className="loading"><span />Chargement de votre profil…</div>

  const interestCards = options.popular_interests?.length ? options.popular_interests : DEFAULT_INTERESTS
  const subjectMap = new Map((options.subjects || []).map(s => [s.value, s.label]))
  const currentSectionSubjects = form.bac_section
    ? (options.section_subjects?.[form.bac_section] || DEFAULT_SECTION_SUBJECTS[form.bac_section] || [])
    : []
  const completionFields = [
    { key: 'academic_level', label: 'Niveau d’études actuel', anchor: 'profile-academic' },
    { key: 'interests', label: 'Centres d’intérêt', anchor: 'profile-interests' },
    { key: 'goals', label: 'Objectif professionnel', anchor: 'profile-goals' },
    { key: 'bac_section', label: 'Section du bac', anchor: 'profile-bac' },
    { key: 'bac_year', label: 'Année d’obtention du bac', anchor: 'profile-bac' },
    { key: 'bac_average', label: 'Moyenne du bac', anchor: 'profile-bac' },
    { key: 'subject_grades', label: 'Notes par matière', anchor: 'profile-grades' },
    { key: 'criteria', label: 'Critères de choix', anchor: 'profile-criteria' },
  ]
  const criteriaComplete = form.max_budget && form.study_duration && form.city && form.learning_style
  const isComplete = key => key === 'criteria'
    ? Boolean(criteriaComplete)
    : key === 'subject_grades'
      ? Object.keys(form.subject_grades || {}).length > 0
      : Boolean(String(form[key] ?? '').trim())
  const missingFields = completionFields.filter(field => !isComplete(field.key))
  const completion = profileCompletion(form)

  return (
    <section className="profile-page">
      <div className="page-intro">
        <p className="eyebrow">VOTRE IDENTITÉ & PROJET</p>
        <h2>Un profil qui vous<br /><em>ressemble.</em></h2>
        <p>Ces informations permettent à SmartCampus d’affiner ses recommandations et de mieux comprendre votre projet.</p>
      </div>

      <form className="panel profile-form" onSubmit={submit}>
        <div className="profile-heading">
          <div className="profile-avatar">{user.full_name?.slice(0, 1) || 'C'}</div>
          <div>
            <h3>{user.full_name}</h3>
            <p>{user.email}</p>
          </div>
        </div>

        <section className="profile-completion" aria-labelledby="profile-completion-title">
          <div className="profile-completion-head">
            <div>
              <p className="eyebrow">VOTRE PROGRESSION</p>
              <h3 id="profile-completion-title">Complétion du profil</h3>
            </div>
            <strong>{completion}%</strong>
          </div>
          <div className="completion-track" aria-label={`${completion}% du profil complété`}>
            <span style={{ width: `${completion}%` }} />
          </div>
          {missingFields.length > 0 ? (
            <div className="completion-missing">
              <p>Il vous reste {missingFields.length} élément{missingFields.length > 1 ? 's' : ''} à renseigner :</p>
              <ul>
                {missingFields.map(field => (
                  <li key={field.key}>
                    <a href={`#${field.anchor}`}> {field.label} <span aria-hidden="true">→</span></a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="completion-success">Votre profil est complet. Vous pouvez maintenant affiner vos recommandations.</p>
          )}
        </section>

        {/* Informations générales */}
        <div className="profile-grid" id="profile-academic">
          <label>
            Niveau d’études actuel
            <input
              value={form.academic_level}
              onChange={e => setForm({ ...form, academic_level: e.target.value })}
              placeholder="Ex. Bac, Licence 1, Bac+2..."
            />
          </label>
          <label>
            Langue préférée pour l'orientation
            <select
              value={form.preferred_language}
              onChange={e => setForm({ ...form, preferred_language: e.target.value })}
            >
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </label>
        </div>

        {/* Centres d'intérêt sous forme de cartes cliquables */}
        <div className="profile-section" id="profile-interests">
          <div className="section-head-with-badge">
            <div>
              <p className="eyebrow">CENTRES D’INTÉRÊT</p>
              <h3>Sélectionnez vos centres d'intérêt</h3>
            </div>
            <span className="badge-pill">Cartes cliquables</span>
          </div>
          <p className="profile-hint">Cliquez sur les cartes pour ajouter ou retirer des domaines d'affinité. Vous pouvez aussi compléter le champ texte ci-dessous.</p>
          <div className="interest-cards-grid">
            {interestCards.map(item => {
              const selected = isInterestSelected(item.label)
              return (
                <button
                  type="button"
                  key={item.id || item.label}
                  className={`interest-card ${selected ? 'selected' : ''}`}
                  onClick={() => toggleInterest(item.label)}
                >
                  <span className="interest-icon">{item.icon || '✦'}</span>
                  <span className="interest-label">{item.label}</span>
                  <span className="interest-badge">{selected ? '✓ Sélectionné' : '+ Ajouter'}</span>
                </button>
              )
            })}
          </div>
          <label className="interests-custom-field">
            Centres d'intérêt saisis (complétez librement)
            <textarea
              value={form.interests}
              onChange={e => setForm({ ...form, interests: e.target.value })}
              placeholder="Sélectionnez des cartes ci-dessus ou ajoutez d'autres mots-clés : IA, Big Data, Robotique..."
            />
          </label>
        </div>

        {/* Champ libre pour l'objectif professionnel, exploité par l'assistant */}
        <div className="profile-section" id="profile-goals">
          <div className="section-head-with-badge">
            <div>
              <p className="eyebrow">OBJECTIF PROFESSIONNEL</p>
              <h3>Quel est votre projet de carrière ?</h3>
            </div>
            <span className="badge-ai">✦ Exploité par l'assistant IA</span>
          </div>
          <p className="profile-hint">
            Décrivez en quelques phrases le métier, le rôle ou le projet d'avenir que vous visez (ex : ingénieur en IA, créateur de startup, expert en cybersécurité, consultant financier...). L'assistant IA exploitera directement ce texte pour orienter ses réponses et ses propositions.
          </p>
          <label>
            Objectif professionnel (champ libre)
            <textarea
              className="goals-textarea"
              value={form.goals}
              onChange={e => setForm({ ...form, goals: e.target.value })}
              placeholder="Ex : Je veux devenir ingénieur en intelligence artificielle pour concevoir des applications intelligentes et rejoindre un centre de recherche ou une entreprise innovante..."
            />
          </label>
        </div>

        {/* Contraintes de budget, durée, lieu et pédagogie */}
        <div className="profile-section" id="profile-criteria">
          <div className="section-head-with-badge">
            <div>
              <p className="eyebrow">CONTRAINTES & PRÉFÉRENCES</p>
              <h3>Budget, durée d'études, lieu et pédagogie</h3>
            </div>
            <span className="badge-pill">Filtres & Pondérations</span>
          </div>
          <p className="profile-hint">
            Ces critères permettent d'éliminer d'emblée les cursus hors de votre portée financière ou géographique, et de pondérer le score de recommandation en fonction de votre style d'apprentissage.
          </p>
          <div className="profile-grid four">
            <label>
              Budget annuel max (DT)
              <input
                type="number"
                min="0"
                step="100"
                value={form.max_budget}
                onChange={e => setForm({ ...form, max_budget: e.target.value })}
                placeholder="Ex. 6000"
              />
              <small className="field-hint">Frais de scolarité annuels max (DT)</small>
            </label>
            <label>
              Durée d'études souhaitée
              <select
                value={form.study_duration}
                onChange={e => setForm({ ...form, study_duration: e.target.value })}
              >
                <option value="">— Indifférente —</option>
                <option value="2">2 ans (Prépa)</option>
                <option value="3">3 ans (Licence)</option>
                <option value="3">3 ans (Cycle d'ingénieur)</option>
              </select>
              <small className="field-hint">Durée visée du parcours</small>
            </label>
            <label>
              Ville / Campus
              <select
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
              >
                <option value="">— Indifférent (Tous les campus) —</option>
                {(options.campuses?.length ? options.campuses : DEFAULT_CAMPUSES).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <small className="field-hint">Campus ou ville souhaitée</small>
            </label>
            <label>
              Préférence pédagogique
              <select
                value={form.learning_style}
                onChange={e => setForm({ ...form, learning_style: e.target.value })}
              >
                <option value="">— Indifférente —</option>
                <option value="pratique">🛠️ Pratique (projets, TP, tech)</option>
                <option value="theorique">📚 Théorique (sciences, concepts)</option>
                <option value="mixte">⚖️ Équilibré (mixte)</option>
              </select>
              <small className="field-hint">Style d'apprentissage</small>
            </label>
          </div>
        </div>

        {/* Baccalauréat */}
        <div className="profile-section" id="profile-bac">
          <p className="eyebrow">BACCALAURÉAT</p>
          <p className="profile-hint">Votre section et votre moyenne permettent de ne proposer que des parcours accessibles avec votre niveau réel.</p>
          <div className="profile-grid three">
            <label>
              Section du bac
              <select
                value={form.bac_section}
                onChange={e => setForm({ ...form, bac_section: e.target.value })}
              >
                <option value="">— Choisir —</option>
                {options.bac_sections.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label>
              Année d’obtention
              <input
                type="number"
                min="1980"
                max={CURRENT_YEAR + 1}
                value={form.bac_year}
                onChange={e => setForm({ ...form, bac_year: e.target.value })}
                placeholder={String(CURRENT_YEAR)}
              />
            </label>
            <label>
              Moyenne (/20)
              <input
                type="number"
                min="0"
                max="20"
                step="0.01"
                value={form.bac_average}
                onChange={e => setForm({ ...form, bac_average: e.target.value })}
                placeholder="Ex. 13.75"
              />
            </label>
          </div>
        </div>

        {/* Notes par matière */}
        <div className="profile-section" id="profile-grades">
          <p className="eyebrow">NOTES PAR MATIÈRE</p>
          <p className="profile-hint">
            Renseignez les matières de votre section du baccalauréat (sur 20). Les notes ≥ 14 sont considérées comme des points forts.
          </p>
          {!form.bac_section ? (
            <div className="section-empty-hint">
              <span className="hint-icon">ℹ️</span>
              <span>Veuillez sélectionner votre <strong>Section du bac</strong> ci-dessus pour afficher la liste des matières correspondantes.</span>
            </div>
          ) : (
            <>
              <div className="grades-grid">
                {currentSectionSubjects
                  .filter(subKey => subKey !== 'matiere_optionnelle')
                  .map(subKey => {
                    const label = subjectMap.get(subKey) || SUBJECT_LABELS[subKey] || subKey
                    return (
                      <label key={subKey}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.25"
                          value={form.subject_grades[subKey] ?? ''}
                          onChange={e => setGrade(subKey, e.target.value)}
                          placeholder="—"
                        />
                      </label>
                    )
                  })}
              </div>

              <div className="optional-subject-box">
                <div className="optional-subject-header">
                  <strong>Langue étrangère ou matière optionnelle</strong>
                  <small>Selon l'épreuve choisie (ex : Italien, Allemand, Espagnol, Chinois, Musique...)</small>
                </div>
                <div className="optional-subject-fields">
                  <label>
                    Nom de l'option ou de la langue
                    <input
                      type="text"
                      value={form.optional_subject_name || ''}
                      onChange={e => setForm({ ...form, optional_subject_name: e.target.value })}
                      placeholder="Ex. Italien, Allemand, Espagnol, Musique..."
                    />
                  </label>
                  <label>
                    Note (/20)
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.25"
                      value={form.subject_grades['matiere_optionnelle'] ?? ''}
                      onChange={e => setGrade('matiere_optionnelle', e.target.value)}
                      placeholder="—"
                    />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {status && (
          <div className={status.includes('succès') ? 'success-box' : 'form-error'}>
            {status}
          </div>
        )}

        <button className="button primary">Enregistrer mon profil <span>→</span></button>
      </form>
    </section>
  )
}
function Dashboard({ user, data, setView }) { const firstName = user.full_name?.split(' ')[0] || 'à vous'; const recommendationCount = data.recommendations?.recommendations?.length || 0; return <><div className="dashboard-intro"><p className="eyebrow">TABLEAU DE BORD</p><h2>Vue d’ensemble</h2></div><section className="welcome"><div className="welcome-copy"><span className="welcome-wave">✦</span><div><h2>Bonjour <em>{firstName}</em></h2><p>Votre parcours prend forme. Voici ce qui mérite votre attention aujourd'hui.</p></div></div><button className="button primary" onClick={() => setView('orientation')}><Icon name="spark" size={16} /> Voir mon orientation <span>→</span></button></section><div className="dashboard-grid"><div className="panel progress-panel"><div className="panel-heading"><div><p className="eyebrow">PARCOURS D’ADMISSION</p><h3>Votre progression</h3></div><strong>25%</strong></div><div className="progress-track"><span /></div><div className="steps"><div className="done"><b>✓</b><span>Profil<small>Terminé</small></span></div><div className="current"><b>02</b><span>Orientation<small>En cours</small></span></div><div><b>03</b><span>Candidature<small>À venir</small></span></div><div><b>04</b><span>Admission<small>À venir</small></span></div></div></div><div className="next-panel panel"><div className="next-panel-icon"><Icon name="spark" size={18} /></div><p className="eyebrow">PROCHAINE ÉTAPE</p><h3>Explorez vos options</h3><p>Votre profil est prêt. Consultez les recommandations préparées pour vous.</p><button className="text-button" onClick={() => setView('orientation')}>Continuer l'orientation <span>→</span></button></div></div><div className="section-title"><div><p className="eyebrow">EN UN COUP D’ŒIL</p><h3>Votre parcours</h3></div><button className="text-button" onClick={() => setView('orientation')}>Voir tout <span>→</span></button></div><div className="quick-grid"><article className="quick-card"><div className="quick-card-top"><span className="quick-icon violet">✦</span><button onClick={() => setView('orientation')} aria-label="Voir les recommandations">→</button></div><strong>{recommendationCount}</strong><span>recommandations</span><p>Découvrez les parcours qui correspondent le mieux à votre profil.</p></article><article className="quick-card"><div className="quick-card-top"><span className="quick-icon green">✓</span><button onClick={() => setView('application')} aria-label="Voir ma candidature">→</button></div><strong>{data.applications.length ? 'En cours' : 'À commencer'}</strong><span>ma candidature</span><p>Complétez votre dossier pour passer à l’étape suivante.</p></article><article className="quote-card"><span>“</span><p>Les bonnes décisions deviennent plus simples quand on a les bonnes informations.</p><small>SmartCampus AI</small><b>✦</b></article></div></> }
function Programs({ programs }) {
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">IIT × ISB</p>
        <h2>Des formations qui ouvrent<br /><em>plusieurs chemins.</em></h2>
        <p>Explorez les programmes actuellement publiés par nos établissements partenaires avec leurs critères et caractéristiques.</p>
      </div>
      <div className="program-grid">
        {programs.map(program => (
          <article className="program-card" key={program.id}>
            <div className="program-top">
              <span className={`tag ${program.institution === 'IIT' ? '' : 'orange'}`}>{program.institution}</span>
              <span className="arrow">↗</span>
            </div>
            <h3>{program.name}</h3>
            <p>{program.description || 'Un parcours conçu pour développer vos compétences et votre projet professionnel.'}</p>
            <div className="program-features-row">
              {program.annual_tuition && <span className="feature-pill">💰 {program.annual_tuition} DT/an</span>}
              {program.duration_years && <span className="feature-pill">⏱️ {program.duration_years} ans</span>}
              {program.city && <span className="feature-pill">📍 {program.city}</span>}
              {program.learning_style && <span className="feature-pill capitalize">🎓 {program.learning_style}</span>}
            </div>
            <div className="program-meta">
              <span>{program.category}</span>
              <span>→</span>
            </div>
          </article>
        ))}
      </div>
      {!programs.length && <Empty text="Aucun programme publié pour le moment." />}
    </>
  )
}

function Orientation({ data, setView, rankingChanged, onConsultation }) {
  const result = data.recommendations || {}
  const recommendations = result.recommendations || []
  const excluded = result.excluded || []
  const missing = result.missing_profile_fields || []
  useEffect(() => {
    onConsultation()
  }, [onConsultation, data.recommendations])
  const hasConstraintsScore = recommendations.some(r => r.breakdown?.constraints > 0)
  const parts = [
    ['interests', 'Intérêts & projet', 40],
    ['subjects', 'Matières clés', 40],
    ['average', 'Moyenne du bac', 20],
    ...(hasConstraintsScore ? [['constraints', 'Contraintes & préférences', 20]] : []),
  ]

  return (
    <>
      {rankingChanged && (
        <div className="ranking-changed" role="status">
          <strong>Votre classement a changé.</strong>
          <span>Vos recommandations ont été recalculées depuis votre dernière consultation.</span>
        </div>
      )}
      <div className="page-intro split">
        <div>
          <p className="eyebrow">ORIENTATION PERSONNALISÉE</p>
          <h2>Des pistes pour<br /><em>vous projeter.</em></h2>
        </div>
        <div className="disclaimer">✦ <span>Recommandations calculées à partir de vos centres d'intérêt, objectif professionnel, notes et contraintes (budget, durée, ville, pédagogie).</span></div>
      </div>
      {missing.length > 0 && (
        <div className="profile-missing">
          <span>Pour une compatibilité plus précise, complétez : <strong>{missing.join(', ')}</strong>.</span>
          <button className="text-button" onClick={() => setView('profile')}>Compléter mon profil <span>→</span></button>
        </div>
      )}
      <div className="recommendation-grid">
        {recommendations.map((item, i) => (
          <article className="recommendation panel" key={item.program.id}>
            <div className="recommendation-head">
              <span className="rank">0{i + 1}</span>
              <span className="tag">{item.program.institution}</span>
            </div>
            <h3>{item.program.name}</h3>
            <p>{item.program.description}</p>
            <div className="program-features-row">
              {item.program.annual_tuition && <span className="feature-pill">💰 {item.program.annual_tuition} DT/an</span>}
              {item.program.duration_years && <span className="feature-pill">⏱️ {item.program.duration_years} ans</span>}
              {item.program.city && <span className="feature-pill">📍 {item.program.city}</span>}
              {item.program.learning_style && <span className="feature-pill capitalize">🎓 {item.program.learning_style}</span>}
            </div>
            <div className="score">
              <div className="score-ring"><strong>{item.score}%</strong></div>
              <span>compatibilité<br /><small>indicative & pondérée</small></span>
            </div>
            <div className="score-breakdown">
              {parts.map(([key, label, max]) => (
                <div key={key}>
                  <span>{label}<b>{item.breakdown[key] ?? 0}/{max}</b></span>
                  <i><em style={{ width: `${Math.min(100, ((item.breakdown[key] ?? 0) / max) * 100)}%` }} /></i>
                </div>
              ))}
            </div>
            <div className="keywords">
              {item.strengths.map(s => <span key={s}>✓ {s.startsWith('✓') ? s.replace(/^✓\s*/, '') : s}</span>)}
              {item.weaknesses.map(s => <span className="weak" key={s}>! À renforcer : {s}</span>)}
              {(item.matching_keywords.length ? item.matching_keywords : ['profil général']).slice(0, 3).map(word => <span key={word}>✓ {word}</span>)}
            </div>
          </article>
        ))}
      </div>
      {!recommendations.length && (
        <Empty text={excluded.length ? 'Aucun parcours publié ne correspond à vos critères ou à votre budget actuel.' : 'Complétez votre profil pour recevoir des recommandations.'} />
      )}
      {excluded.length > 0 && (
        <div className="excluded-list panel">
          <p className="eyebrow">PARCOURS NON PROPOSÉS (CONTRAINTES OU PRÉREQUIS)</p>
          {excluded.map(item => (
            <div key={item.program.id}>
              <strong>{item.program.institution} — {item.program.name}</strong>
              <span>{item.reasons.join(' · ')}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Application({ data, setData }) {
  const [selected, setSelected] = useState(data.programs[0]?.id || '')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault()
    try {
      const result = await api.apply(Number(selected), phone)
      setData({ ...data, applications: [result, ...data.applications] })
      setMessage('Votre candidature a bien été enregistrée.')
    } catch (err) {
      setMessage(err.message)
    }
  }
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">PRÉINSCRIPTION</p>
        <h2>Construisez votre<br /><em>prochaine étape.</em></h2>
        <p>Choisissez un programme pour commencer votre dossier. Vous pourrez compléter les informations ensuite.</p>
      </div>
      <div className="application-layout">
        <form className="panel application-form" onSubmit={submit}>
          <div className="form-step">
            <span>01</span>
            <div>
              <h3>Votre programme</h3>
              <p>Quel parcours souhaitez-vous explorer ?</p>
            </div>
          </div>
          <label>
            Formation
            <select required value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">Sélectionner une formation</option>
              {data.programs.map(program => (
                <option key={program.id} value={program.id}>{program.institution} · {program.name}</option>
              ))}
            </select>
          </label>
          <label>
            Téléphone
            <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+216 20 000 000" />
          </label>
          <label className="consent">
            <input type="checkbox" required />
            <span>J'accepte le traitement de mes données pour mon orientation et ma candidature.</span>
          </label>
          {message && <div className={message.includes('bien') ? 'success-box' : 'form-error'}>{message}</div>}
          <button className="button primary wide">Enregistrer ma candidature →</button>
        </form>
        <aside className="application-aside">
          <span className="aside-number">02</span>
          <div className="application-illustration" aria-hidden="true">
            <svg viewBox="0 0 160 112" role="presentation">
              <path className="illustration-glow" d="M35 72c-14-10-15-29-2-39 8-6 18-7 27-3 6-17 29-22 42-10 9 8 11 20 7 30 16-2 30 10 30 26 0 15-12 27-27 27H55c-15 0-27-11-27-26 0-3 1-4 7-5Z" />
              <rect className="illustration-paper" x="55" y="18" width="51" height="66" rx="5" />
              <path className="illustration-line" d="M65 57h31M65 66h24" />
              <circle className="illustration-avatar" cx="81" cy="37" r="8" />
              <path className="illustration-check" d="m111 72 6 6 11-13" />
            </svg>
          </div>
          <h3>Un dossier, étape par étape.</h3>
          <p>Après cette première étape, vous pourrez renseigner votre profil, déposer vos documents et demander un rendez-vous.</p>
          <div className="mini-steps">
            <span className="active">✓</span>
            <span>Profil</span>
            <span>→</span>
            <span>Documents</span>
          </div>
        </aside>
      </div>
    </>
  )
}

function Assistant() {
  const [conversationId, setConversationId] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [messages, setMessages] = useState([
    { sender: 'assistant', text: 'Bonjour ! Je suis votre assistant SmartCampus. Posez-moi vos questions sur les formations IIT/ISB ou sur votre projet professionnel.' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [candidateProfile, setCandidateProfile] = useState(null)

  useEffect(() => {
    api.conversations()
      .then(items => {
        if (items.length) {
          setConversationId(items[0].id)
          setMessages(items[0].messages)
        }
      })
      .catch(err => setMessages([{ sender: 'assistant', text: err.message }]))
      .finally(() => setHistoryLoading(false))

    api.profile()
      .then(setCandidateProfile)
      .catch(() => {})
  }, [])

  async function send(text = input) {
    if (!text.trim() || sending || historyLoading) return
    setMessages(current => [...current, { sender: 'user', text }])
    setInput('')
    setSending(true)
    try {
      const result = await api.chat(text, conversationId)
      setConversationId(result.conversation_id)
      setMessages(current => [...current, { sender: 'assistant', text: result.reply }])
    } catch (err) {
      setMessages(current => [...current, { sender: 'assistant', text: err.message }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="assistant-layout">
      <div className="chat panel">
        <div className="chat-head">
          <div className="chat-title">
            <span className="assistant-orb">✦</span>
            <div>
              <p className="eyebrow">ASSISTANT SMARTCAMPUS</p>
              <h2>Votre espace d'orientation interactive <span>👋</span></h2>
              <p>Posez vos questions : l'assistant exploite votre profil, votre objectif professionnel et les formations officielles.</p>
            </div>
          </div>
          <span className="online"><i /> En ligne</span>
        </div>
        <div className="messages">
          {messages.map((message, i) => (
            <div dir="auto" className={`message ${message.sender}`} key={i}>
              <span>{message.sender === 'assistant' ? '✦' : 'Vous'}</span>
              <div>
                <p>{message.text}</p>
                {message.sender === 'assistant' && <small>Assistant SmartCampus</small>}
              </div>
            </div>
          ))}
          {historyLoading && <div className="typing">Chargement de la conversation…</div>}
          {sending && <div className="typing">L'assistant réfléchit en exploitant votre profil…</div>}
        </div>
        <div className="suggestions">
          {[
            candidateProfile?.goals ? `Comment atteindre mon objectif : ${candidateProfile.goals.slice(0, 30)}... ?` : 'Quelle formation correspond à mon projet ?',
            'Comparer prépa et licence',
            'Quels sont les frais et conditions ?',
          ].map(suggestion => (
            <button key={suggestion} disabled={sending || historyLoading} onClick={() => send(suggestion)}>
              <span>✦</span> {suggestion}
            </button>
          ))}
        </div>
        <form className="chat-input" onSubmit={event => { event.preventDefault(); send() }}>
          <span className="attach" aria-hidden="true">↗</span>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Posez une question sur votre projet ou votre formation…" />
          <button disabled={sending || historyLoading} aria-label="Envoyer">➤</button>
        </form>
      </div>

      <aside className="assistant-aside">
        <div className="profile-side">
          <p className="eyebrow">PROFIL ANALYSÉ PAR L'IA</p>
          {candidateProfile?.goals ? (
            <>
              <h3>Objectif professionnel ciblé</h3>
              <div className="assistant-goal-card">
                <span className="goal-icon">🎯</span>
                <p className="goal-text">« {candidateProfile.goals} »</p>
              </div>
              <button
                className="profile-complete"
                onClick={() => send(`Selon mon objectif professionnel (« ${candidateProfile.goals} »), quelles sont les formations les plus adaptées ?`)}
              >
                Explorer mon objectif <span>→</span>
              </button>
            </>
          ) : (
            <>
              <h3>Votre projet se précise.</h3>
              <p>Renseignez votre objectif professionnel dans votre profil pour que l'assistant formule des réponses ultra-ciblées.</p>
              <button className="profile-complete" onClick={() => window.location.pathname = '/candidat/profil'}>
                Définir mon objectif <span>→</span>
              </button>
            </>
          )}
        </div>
        <div className="source-list">
          <strong>▣ &nbsp; Catalogues & Critères officiels</strong>
          <span>↗ &nbsp; Formations IIT publiées (Ingénierie & Prépa) <b>›</b></span>
          <span>↗ &nbsp; Formations ISB publiées (Licences & Finance) <b>›</b></span>
        </div>
        <div className="assistant-campus">
          <img src="/iit3.jpg" alt="Campus IIT" />
          <strong>Ton avenir<br /><em>commence ici</em></strong>
          <span>⌁</span>
        </div>
      </aside>
    </div>
  )
}
function Admin({ user, theme, toggle, logout }) { const [data, setData] = useState(null); useEffect(() => { api.dashboard().then(setData).catch(() => setData({ applications: [], total_applications: 0, status_counts: {} })) }, []); return <div className="admin-shell"><header className="public-header"><Brand /><div className="admin-user"><span className="tag">ADMINISTRATION</span><span>{user.full_name}</span><Theme theme={theme} onClick={toggle} /><button className="button ghost" onClick={logout}>Déconnexion</button></div></header><main className="admin-content"><div className="page-intro"><p className="eyebrow">PILOTAGE · {user.role.replace('_', ' ')}</p><h2>La vue d'ensemble<br /><em>de vos admissions.</em></h2></div><div className="admin-kpis"><div><span>CANDIDATURES</span><strong>{data?.total_applications ?? '—'}</strong><small>Total reçu</small></div><div><span>STATUTS ACTIFS</span><strong>{data ? Object.values(data.status_counts).reduce((a, b) => a + b, 0) : '—'}</strong><small>À traiter</small></div><div><span>PROGRAMMES</span><strong>2</strong><small>IIT · ISB</small></div></div><div className="admin-table panel"><div className="panel-heading"><div><p className="eyebrow">FLUX RÉCENT</p><h3>Dernières candidatures</h3></div><button className="button ghost">Exporter CSV</button></div>{data?.applications?.length ? <table><thead><tr><th>ID</th><th>Programme</th><th>Statut</th><th>Créée le</th></tr></thead><tbody>{data.applications.map(application => <tr key={application.id}><td>#{String(application.id).padStart(4, '0')}</td><td>Application #{application.program_id}</td><td><span className="status">{application.status}</span></td><td>{new Date(application.created_at).toLocaleDateString('fr-FR')}</td></tr>)}</tbody></table> : <Empty text="Les candidatures apparaîtront ici dès leur réception." />}</div></main></div> }
function Empty({ text }) { return <EmptyState message={text} /> }
