export default function ThemeToggle({ theme, onToggle }) {
  return <button className="icon-button" onClick={onToggle} aria-label="Changer de thème">{theme === 'light' ? '☾' : '☀'}</button>
}
