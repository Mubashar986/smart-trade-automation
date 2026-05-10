import DryRunChart from '../../DryRunChart'
import PipelineTracker from '../PipelineTracker'

export default function JobCard({
  job,
  isExpanded,
  onToggle,
  onFixStrategy,
  showSimulation,
  onToggleSimulation,
  token,
}) {
  const isFailed = job.status === 'failed'
  const isDone = job.status === 'completed'
  const isActive = !isFailed && !isDone

  return (
    <article className={`job-card ${isFailed ? 'card-failed' : ''} ${isDone ? 'card-done' : ''}`}>
      <div className="card-top" onClick={onToggle}>
        <div className="card-meta">
          <span className="card-id">#{job.job_id.substring(0, 8)}</span>
          <p className="card-prompt">{job.prompt}</p>
        </div>
        <div className="card-right">
          <span className={`status-pill status-${job.status}`}>
            {job.status === 'failed'
              ? 'Failed'
              : job.status === 'completed'
                ? 'Done'
                : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
          <span className="expand-arrow">{isExpanded ? 'Hide' : 'Open'}</span>
        </div>
      </div>

      {isActive && <PipelineTracker status={job.status} />}

      {isExpanded && (
        <div className="card-body">
          {isFailed && (
            <div className="error-panel">
              <div className="error-panel-header">
                <strong>Validation Failed</strong>
              </div>
              {job.error_message && <pre className="error-text">{job.error_message}</pre>}
              {job.compile_log && (
                <div className="compile-log">
                  <strong>Compilation Log:</strong>
                  <pre>{job.compile_log}</pre>
                </div>
              )}
              {job.parsed_strategy && (
                <button className="btn-fix" onClick={() => onFixStrategy(job.parsed_strategy)}>
                  Make Strategy Safe
                </button>
              )}
            </div>
          )}

          {isDone && (
            <div className="success-panel">
              {job.backtest_result && (
                <div className="backtest-box">
                  <div className="backtest-header">Backtest Metrics</div>
                  <pre className="backtest-text">{job.backtest_result}</pre>
                </div>
              )}
              <div className="code-header">
                <span>MQL5 Source Code</span>
                <button className="btn-copy" onClick={() => navigator.clipboard.writeText(job.script_content)}>
                  Copy
                </button>
              </div>
              <pre className="code-viewer">{job.script_content}</pre>

              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: showSimulation ? '12px' : '0',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '.95rem' }}>Mock Dry-Run Simulation</p>
                    <p style={{ fontSize: '.78rem', color: '#64748b', marginTop: '2px' }}>
                      Visually test how your SL and TP levels hold in different market conditions.
                    </p>
                  </div>
                  <button
                    style={{
                      padding: '8px 18px',
                      borderRadius: '10px',
                      fontFamily: 'Inter,sans-serif',
                      fontWeight: 700,
                      fontSize: '.85rem',
                      cursor: 'pointer',
                      background: showSimulation ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#0cc8df,#0ab7c6)',
                      border: showSimulation ? '1px solid rgba(255,255,255,0.1)' : 'none',
                      color: showSimulation ? '#64748b' : '#04111f',
                      transition: 'all .2s',
                      boxShadow: showSimulation ? 'none' : '0 0 16px rgba(12,200,223,0.35)',
                    }}
                    onClick={onToggleSimulation}
                  >
                    {showSimulation ? 'Hide' : 'Run Simulation'}
                  </button>
                </div>
                {showSimulation && <DryRunChart job={job} token={token} />}
              </div>
            </div>
          )}

          {isActive && (
            <div className="running-msg">
              <PipelineTracker status={job.status} />
              <p>Pipeline running. This may take a few minutes.</p>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

