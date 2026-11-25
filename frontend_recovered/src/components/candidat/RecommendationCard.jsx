import StatusBadge from '../shared/StatusBadge'

export default function RecommendationCard({ recommendation, rank = 1 }) {
  const program = recommendation.program
  const score = Math.min(98, 64 + recommendation.score * 12)
  return <article className="recommendation panel"><div className="recommendation-head"><span className="rank">0{rank}</span><StatusBadge status="orienté" /></div><h3>{program.name}</h3><p>{program.description}</p><div className="score"><div className="score-ring"><strong>{score}%</strong></div><span>compatibilité<br /><small>exploratoire</small></span></div><div className="keywords">{(recommendation.matching_keywords.length ? recommendation.matching_keywords : ['profil général']).slice(0, 3).map(word => <span key={word}>✓ {word}</span>)}</div></article>
}
