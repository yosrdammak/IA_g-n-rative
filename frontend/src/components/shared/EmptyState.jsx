export default function EmptyState({ message, action, onAction }) {
  return <div className="empty" role="status"><span>○</span><p>{message}</p>{action && <button className="text-button" onClick={onAction}>{action} →</button>}</div>
}
