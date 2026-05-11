import { useState } from 'react'

export default function RunFailureCard({ runDetail, onOpenSafetyModal }) {
  const [showDetails, setShowDetails] = useState(false)
  if (!runDetail || runDetail.status !== 'failed') return null

  const canRecover = runDetail.failure_type === 'input_risky_recoverable' && !!runDetail.parsed_strategy
  const title =
    runDetail.failure_type === 'compile_failed'
      ? 'Compilation failed'
      : runDetail.failure_type === 'input_invalid'
        ? 'Validation failed'
        : runDetail.failure_type === 'input_risky_recoverable'
          ? 'Strategy needs safer parameters'
          : 'Run failed'

  const summary =
    runDetail.failure_type === 'input_risky_recoverable'
      ? 'Some parameters are risky or incomplete. Review the warning summary and repair them in context.'
      : runDetail.failure_type === 'input_invalid'
        ? 'This run failed because the strategy structure is invalid and needs correction.'
        : runDetail.failure_type === 'compile_failed'
          ? 'The generated code did not compile successfully in the current attempt.'
          : 'This run failed before a usable output was produced.'

  return (
    <div className="run-failure-card">
      <div className="run-failure-card__head">
        <div>
          <span className="run-failure-card__eyebrow">Run issue</span>
          <strong>{title}</strong>
        </div>
        <button type="button" className="run-failure-card__toggle" onClick={() => setShowDetails((current) => !current)}>
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>
      <p className="run-failure-card__summary">{summary}</p>
      {showDetails && (
        <>
          {runDetail.error_message && <pre className="run-failure-card__body">{runDetail.error_message}</pre>}
          {runDetail.compile_log && (
            <div className="run-failure-card__log">
              <strong>Compilation log</strong>
              <pre>{runDetail.compile_log}</pre>
            </div>
          )}
        </>
      )}
      <div className="run-failure-card__footer">
        <span className={`run-failure-card__badge ${canRecover ? 'recoverable' : 'hard'}`}>
          {canRecover ? 'Recoverable' : 'Needs manual correction'}
        </span>
        {canRecover && (
          <button type="button" className="run-failure-card__action" onClick={onOpenSafetyModal}>
            Make Strategy Safe
          </button>
        )}
      </div>
    </div>
  )
}
