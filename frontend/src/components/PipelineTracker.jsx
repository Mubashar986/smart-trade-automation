const PIPELINE_STEPS = [
  { key: 'pending', label: 'Queued', icon: 'Q' },
  { key: 'parsing', label: 'Parsing', icon: 'I' },
  { key: 'validating', label: 'Validating', icon: 'V' },
  { key: 'generating', label: 'Generating', icon: 'G' },
  { key: 'compiling', label: 'Compiling', icon: 'C' },
  { key: 'backtesting', label: 'Backtesting', icon: 'B' },
  { key: 'completed', label: 'Done', icon: 'D' },
]

const STEP_INDEX = Object.fromEntries(PIPELINE_STEPS.map((s, i) => [s.key, i]))

export default function PipelineTracker({ status }) {
  const current = STEP_INDEX[status] ?? 0
  const isFailed = status === 'failed'

  return (
    <div className="pipeline-tracker">
      {PIPELINE_STEPS.map((step, i) => {
        const done = i < current
        const active = i === current && !isFailed
        return (
          <div
            key={step.key}
            className={`pipeline-step ${done ? 'done' : ''} ${active ? 'active' : ''} ${
              isFailed && i === current ? 'failed-step' : ''
            }`}
          >
            <div className="step-dot">
              <span>{done ? 'OK' : step.icon}</span>
            </div>
            <span className="step-label">{step.label}</span>
            {i < PIPELINE_STEPS.length - 1 && <div className={`step-line ${done ? 'done' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

