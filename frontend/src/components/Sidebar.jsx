import { useEffect, useRef, useState } from 'react'
import './Sidebar.css'

const iconPaths = {
  home: <><path d="m3 10 6-7 6 7" /><path d="M5 9v7h8V9M8 16v-4h3v4" /></>,
  profile: <><circle cx="9" cy="6" r="3" /><path d="M3.5 16a5.5 5.5 0 0 1 11 0" /></>,
  grid: <><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="10" y="3" width="5" height="5" rx="1" /><rect x="3" y="10" width="5" height="5" rx="1" /><rect x="10" y="10" width="5" height="5" rx="1" /></>,
  dots: <><circle cx="4" cy="4" r="1" /><circle cx="9" cy="4" r="1" /><circle cx="14" cy="4" r="1" /><circle cx="4" cy="9" r="1" /><circle cx="9" cy="9" r="1" /><circle cx="14" cy="9" r="1" /><circle cx="4" cy="14" r="1" /><circle cx="9" cy="14" r="1" /><circle cx="14" cy="14" r="1" /></>,
  spark: <path d="M9 2.5 10.7 7.3 15.5 9l-4.8 1.7L9 15.5l-1.7-4.8L2.5 9l4.8-1.7L9 2.5Z" />,
  check: <><path d="M9 2.5 14.5 5v4.2c0 3.2-2.2 5.6-5.5 7.3-3.3-1.7-5.5-4.1-5.5-7.3V5L9 2.5Z" /><path d="m6.5 9 1.7 1.7L11.8 7" /></>,
  chat: <><path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h7A2.5 2.5 0 0 1 15 4.5v4a2.5 2.5 0 0 1-2.5 2.5H8l-4 3v-3.5A2.5 2.5 0 0 1 3 9V4.5Z" /><circle cx="7" cy="6.5" r=".65" fill="currentColor" stroke="none" /><circle cx="11" cy="6.5" r=".65" fill="currentColor" stroke="none" /><path d="M7.5 8.5a2 2 0 0 0 3 0" /></>,
  collapse: <><path d="m11 4-5 5 5 5" /><path d="M15 4v10" /></>,
  menu: <><path d="M3 5h12M3 9h12M3 13h12" /></>,
  close: <><path d="m4 4 10 10M14 4 4 14" /></>,
  help: <><circle cx="9" cy="9" r="7" /><path d="M7.2 6.8a1.9 1.9 0 1 1 3.1 1.5c-.9.6-1.3 1-1.3 2M9 13.2h.01" /></>,
  logout: <><path d="M8 3H3v12h5M11 6l4 3-4 3M6 9h9" /></>,
}

function SidebarIcon({ name, size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  )
}

function Mascot() {
  return (
    <svg className="sidebar-mascot" viewBox="0 0 220 190" role="img" aria-label="Mascotte robot SmartCampus">
      <path d="M28 34h75a11 11 0 0 1 11 11v35a11 11 0 0 1-11 11H70L50 107V91h-8a14 14 0 0 1-14-14V45a11 11 0 0 1 11-11Z" fill="var(--sidebar-bubble)" />
      <path d="M47 54h37M47 67h49M47 80h35" stroke="var(--sidebar-bubble-line)" strokeWidth="4" strokeLinecap="round" />
      <path d="M75 143c0-15 12-27 27-27h55c15 0 27 12 27 27v25H75v-25Z" fill="var(--sidebar-robot)" />
      <path d="M91 125c-8 7-13 18-13 29v14h17v-16c0-6 2-11 6-15" fill="var(--sidebar-robot-shade)" />
      <rect x="89" y="50" width="83" height="77" rx="30" fill="var(--sidebar-robot)" />
      <rect x="101" y="66" width="59" height="46" rx="18" fill="var(--sidebar-face)" />
      <path d="M112 85c5-8 10-8 15 0M135 85c5-8 10-8 15 0M119 97c6 6 13 6 19 0" fill="none" stroke="var(--sidebar-cyan)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M127 51 115 38l28-8 36 11-26 10Z" fill="var(--sidebar-cap-blue)" />
      <path d="m115 38 1 10 28 9 1-16" fill="var(--sidebar-cap-light)" />
      <path d="M164 109c8 2 14 9 17 18l7 18 9-4-7-22c-4-13-14-22-26-24" fill="var(--sidebar-robot)" />
      <path d="m183 146 16-8 4 10-16 8Z" fill="var(--sidebar-robot)" />
      <circle cx="183" cy="154" r="3" fill="var(--sidebar-cyan)" />
      <path d="M87 169h98" stroke="var(--sidebar-mascot-base)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar({ items, activeView, onNavigate, onLogout, collapsed, onCollapseChange }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const previousDesktopState = useRef(window.innerWidth >= 1024)

  useEffect(() => {
    function handleResize() {
      const desktop = window.innerWidth >= 1024
      if (desktop !== previousDesktopState.current) {
        onCollapseChange(!desktop)
        previousDesktopState.current = desktop
      }
      if (window.innerWidth >= 768) setMobileOpen(false)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onCollapseChange])

  useEffect(() => {
    if (!mobileOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  function navigate(view) {
    onNavigate(view)
    setMobileOpen(false)
  }

  return (
    <>
      <button
        className="sidebar-mobile-trigger"
        type="button"
        aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(open => !open)}
      >
        <SidebarIcon name={mobileOpen ? 'close' : 'menu'} />
      </button>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar sidebar-redesign${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}
        style={{ '--sidebar-width': mobileOpen ? '256px' : collapsed ? '72px' : '256px' }}
      >
        <div className="sidebar-header">
          <a className="sidebar-brand" href="/candidat" onClick={event => { event.preventDefault(); navigate('dashboard') }} aria-label="SmartCampus, vue d’ensemble">
            <img className="sidebar-logo-mark" src="/smartCampus%20logo.png" alt="" />
            <span className="sidebar-brand-copy">
              <span className="sidebar-brand-name"><strong>Smart</strong><b>Campus</b></span>
              <span className="sidebar-tagline">Apprendre • Explorer • Réussir</span>
            </span>
          </a>
          <button
            className="sidebar-collapse"
            type="button"
            aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            aria-expanded={!collapsed}
            data-tooltip={collapsed ? 'Développer le menu' : 'Réduire le menu'}
            onClick={() => onCollapseChange(!collapsed)}
          >
            <SidebarIcon name="collapse" />
          </button>
          <button className="sidebar-mobile-close" type="button" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}>
            <SidebarIcon name="close" />
          </button>
        </div>
        <div className="sidebar-section-label">
          <SidebarIcon name="dots" size={16} />
          <span>ESPACE CANDIDAT</span>
        </div>
        <nav className="sidebar-nav" aria-label="Navigation candidat">
          {items.map(item => (
            <button
              className={`sidebar-nav-item${activeView === item.id ? ' active' : ''}${item.id === 'assistant' ? ' assistant-nav-item' : ''}`}
              key={item.id}
              type="button"
              aria-current={activeView === item.id ? 'page' : undefined}
              data-tooltip={item.label}
              title={collapsed ? item.label : undefined}
              onClick={() => navigate(item.id)}
            >
              <span className="sidebar-nav-icon"><SidebarIcon name={item.icon} /></span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.id === 'assistant' && <span className="sidebar-nav-sparkle" aria-hidden="true">✨</span>}
            </button>
          ))}
        </nav>
        <Mascot />
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="sidebar-help-icon"><SidebarIcon name="help" size={19} /></span>
            <span className="sidebar-help-copy"><strong>Besoin d'aide ?</strong><small>Parler à un conseiller</small></span>
            <span className="sidebar-help-chevron" aria-hidden="true">›</span>
          </div>
          <button className="sidebar-logout" type="button" onClick={onLogout} data-tooltip="Déconnexion">
            <SidebarIcon name="logout" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}
