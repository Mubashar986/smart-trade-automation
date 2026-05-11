import { ChevronDownIcon, CheckCircleIcon, CodeBracketsIcon, DocumentIcon, ShieldIcon } from '../../BrandSystem'

const ACTIVE_STATUSES = new Set(['pending', 'parsing', 'validating', 'generating', 'compiling', 'backtesting'])

function getStatusLabel(status) {
  if (!status) return 'Pending'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDuration(createdAt, updatedAt, status) {
  if (!createdAt) return ''
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return ''
  const end = ACTIVE_STATUSES.has(status) ? new Date() : updatedAt ? new Date(updatedAt) : new Date(createdAt)
  const diff = Math.max(0, Math.floor((end.getTime() - created.getTime()) / 1000))
  const minutes = Math.floor(diff / 60)
  const seconds = diff % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function StatusGlyph({ status }) {
  if (status === 'completed') return <CheckCircleIcon />
  if (status === 'validating') return <ShieldIcon />
  if (status === 'generating' || status === 'compiling') return <CodeBracketsIcon />
  return <DocumentIcon />
}

function getStatusNote(status) {
  if (status === 'failed') return 'Review details'
  if (status === 'completed') return 'Artifacts ready'
  if (status === 'validating') return 'Checking rules'
  if (status === 'generating') return 'Building logic'
  if (status === 'compiling') return 'Compiling code'
  if (status === 'backtesting') return 'Preparing result'
  if (status === 'parsing') return 'Reading prompt'
  return 'Queued'
}

export default function RunStatusInline({
  run,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
}) {
  const statusLabel = getStatusLabel(run.status)
  const elapsed = formatDuration(run.created_at, run.updated_at, run.status)
  const statusNote = getStatusNote(run.status)

  return (
    <div className={`run-inline ${selected ? 'selected' : ''}`}>
      <button type="button" className="run-inline__compact" onClick={onSelect}>
        <span className="run-inline__main">
          <span className={`run-inline__status ${run.status}`}>
            <StatusGlyph status={run.status} />
          </span>
          <span className="run-inline__copy">
            <strong>{statusLabel}</strong>
            <small>{statusNote}</small>
          </span>
        </span>
        <span className="run-inline__meta">
          <small>{elapsed ? `${elapsed}` : 'now'}</small>
        </span>
      </button>
      <button type="button" className="run-inline__expand" onClick={onToggleExpand} aria-expanded={expanded}>
        <ChevronDownIcon className={expanded ? 'rotated' : ''} />
      </button>

      {expanded && (
        <div className="run-inline__details">
          <span className="run-inline__detail-chip">Provider run</span>
          <span className="run-inline__detail-chip">{statusLabel}</span>
          {elapsed && <span className="run-inline__detail-chip">{elapsed}</span>}
        </div>
      )}
    </div>
  )
}
