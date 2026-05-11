import { DownloadIcon, PanelRightIcon } from '../../BrandSystem'
import DryRunChart from '../../DryRunChart'
import PipelineTracker from '../PipelineTracker'

function slugifyName(title = 'strategy') {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function CodePanel({ runDetail }) {
  const downloadCode = () => {
    const blob = new Blob([runDetail.script_content || ''], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slugifyName(runDetail.prompt || 'strategy')}.mq5`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="context-panel__content">
      <div className="context-panel__actions">
        <button type="button" className="context-panel__action" onClick={() => navigator.clipboard.writeText(runDetail.script_content || '')}>
          Copy code
        </button>
        <button type="button" className="context-panel__action" onClick={downloadCode}>
          <DownloadIcon />
          Download .mq5
        </button>
      </div>
      {runDetail.script_content ? (
        <pre className="context-panel__code">{runDetail.script_content}</pre>
      ) : (
        <div className="context-panel__empty">Code will appear here when generation reaches a usable state.</div>
      )}
      {runDetail.compile_log && (
        <div className="context-panel__subsection">
          <h4>Compile log</h4>
          <pre className="context-panel__log">{runDetail.compile_log}</pre>
        </div>
      )}
    </div>
  )
}

function DryRunPanel({ runDetail, token }) {
  if (!runDetail?.parsed_strategy) {
    return <div className="context-panel__empty">Dry run will become available when parsed strategy data exists for this run.</div>
  }

  return (
    <div className="context-panel__content">
      <DryRunChart
        job={{
          parsed_strategy: runDetail.parsed_strategy,
        }}
        token={token}
      />
    </div>
  )
}

export default function ContextDrawer({
  open,
  onToggle,
  selectedRun,
  token,
  activeTab,
  onTabChange,
}) {
  return (
    <>
      {!open && (
        <button type="button" className="context-drawer-toggle" onClick={onToggle}>
          <PanelRightIcon />
          <span>Artifacts</span>
        </button>
      )}

      <aside className={`context-drawer ${open ? 'open' : 'closed'}`}>
        <div className="context-drawer__header">
          <div>
            <span className="chat-thread__kicker">Selected run</span>
            <h3>{selectedRun ? selectedRun.status.charAt(0).toUpperCase() + selectedRun.status.slice(1) : 'No run selected'}</h3>
          </div>
          <button type="button" className="context-drawer__close" onClick={onToggle}>
            {open ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="context-drawer__tabs">
          <button type="button" className={activeTab === 'code' ? 'active' : ''} onClick={() => onTabChange('code')}>
            Code
          </button>
          <button type="button" className={activeTab === 'dry-run' ? 'active' : ''} onClick={() => onTabChange('dry-run')}>
            Dry Run
          </button>
          <button type="button" className="disabled" disabled title="Coming later">
            Backtest
          </button>
        </div>

        {!selectedRun ? (
          <div className="context-panel__empty large">
            Select a run in the conversation to inspect its code, dry-run view, and future result artifacts.
          </div>
        ) : (
          <>
            <div className="context-run-overview">
              <div className="context-run-overview__row">
                <span>Status</span>
                <strong>{selectedRun.status}</strong>
              </div>
              <div className="context-run-overview__row">
                <span>Model</span>
                <strong>{selectedRun.model}</strong>
              </div>
              <div className="context-run-overview__row">
                <span>Mode</span>
                <strong>{selectedRun.quality_mode}</strong>
              </div>
            </div>

            <div className="context-pipeline">
              <div className="context-pipeline__head">
                <span className="chat-thread__kicker">Pipeline</span>
              </div>
              <PipelineTracker status={selectedRun.status} />
            </div>

            {activeTab === 'code' ? <CodePanel runDetail={selectedRun} /> : <DryRunPanel runDetail={selectedRun} token={token} />}
          </>
        )}
      </aside>
    </>
  )
}
