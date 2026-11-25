export default function ChartPlaceholder({ title, description = 'Les données apparaîtront lorsque le backend statistique sera disponible.' }) {
  return <article className="panel chart-placeholder"><p className="eyebrow">STATISTIQUES</p><h3>{title}</h3><p>{description}</p><div aria-hidden="true"><span /><span /><span /><span /><span /></div></article>
}
