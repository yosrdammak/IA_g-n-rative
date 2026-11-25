export default function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-intro"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>
}
