import { useMemo, useState } from 'react'

const PARAM_DETAILS = {
  lot_size: {
    rule: 'Rule 5',
    title: 'Lot Size',
    detail: 'Controls position size. Smaller lot sizes reduce exposure and are safer for initial strategy attempts.',
  },
  stop_loss_points: {
    rule: 'Rule 6',
    title: 'Stop-Loss',
    detail: 'Protects the account by closing the trade when price moves too far in the wrong direction.',
  },
  take_profit_points: {
    rule: 'Recommended',
    title: 'Take Profit',
    detail: 'Defines a target for exiting the trade at a profit and improves risk-reward structure.',
  },
  max_trades_per_day: {
    rule: 'Rule 8',
    title: 'Max Trades / Day',
    detail: 'Limits overtrading and helps keep the strategy from opening too many positions in one session.',
  },
  max_drawdown_percent: {
    rule: 'Rule 9 Guard',
    title: 'Max Drawdown (%)',
    detail: 'Adds a hard risk cap to stop the strategy if losses reach an unsafe level.',
  },
}

function normalizeInitialData(initialData) {
  try {
    const data = typeof initialData === 'string' ? JSON.parse(initialData) : initialData
    return {
      symbol: data.symbol || 'XAUUSD',
      timeframe: data.timeframe || 'H1',
      strategy_type: data.strategy_type || 'RSI',
      entry: {
        indicator: data.entry?.indicator || 'RSI',
        period: data.entry?.period || 14,
        operator: data.entry?.operator || '<',
        value: data.entry?.value || 30,
        action: data.entry?.action || 'BUY',
      },
      exit: {
        indicator: data.exit?.indicator || 'RSI',
        period: data.exit?.period || 14,
        operator: data.exit?.operator || '>',
        value: data.exit?.value || 70,
        action: data.exit?.action || 'CLOSE',
      },
      risk: {
        lot_size: data.risk?.lot_size ?? 0.01,
        stop_loss_points: data.risk?.stop_loss_points ?? 300,
        take_profit_points: data.risk?.take_profit_points ?? 600,
        max_trades_per_day: data.risk?.max_trades_per_day ?? 3,
        max_drawdown_percent: data.risk?.max_drawdown_percent ?? 5.0,
        max_consecutive_losses: data.risk?.max_consecutive_losses ?? 3,
        trailing_stop_points: data.risk?.trailing_stop_points ?? 100,
        slippage_points: data.risk?.slippage_points ?? 30,
      },
    }
  } catch {
    return null
  }
}

function ParamRow({ fieldKey, value, step, onAdjust, onUpdate, expanded, onToggle }) {
  const info = PARAM_DETAILS[fieldKey]
  return (
    <div className="safety-editor__row">
      <div className="safety-editor__row-head">
        <div>
          <h4>{info.title}</h4>
          <span>{info.rule}</span>
        </div>
        <button type="button" className="safety-editor__detail-toggle" onClick={() => onToggle(fieldKey)}>
          {expanded ? 'Hide' : 'Why?'}
        </button>
      </div>

      <div className="safety-editor__stepper">
        <button type="button" onClick={() => onAdjust(false)} aria-label={`Decrease ${info.title}`}>
          –
        </button>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(event) =>
            onUpdate(
              fieldKey,
              step < 1 ? parseFloat(event.target.value || '0') : parseInt(event.target.value || '0', 10)
            )
          }
        />
        <button type="button" onClick={() => onAdjust(true)} aria-label={`Increase ${info.title}`}>
          +
        </button>
      </div>

      {expanded && <p className="safety-editor__detail">{info.detail}</p>}
    </div>
  )
}

export default function StrategyEditor({ initialData, onSubmit, onCancel, embedded = false }) {
  const [formData, setFormData] = useState(() => normalizeInitialData(initialData))
  const [expandedDetail, setExpandedDetail] = useState(null)

  const params = useMemo(
    () => [
      { key: 'lot_size', step: 0.01, adjust: 0.01 },
      { key: 'stop_loss_points', step: 1, adjust: 50 },
      { key: 'take_profit_points', step: 1, adjust: 50 },
      { key: 'max_trades_per_day', step: 1, adjust: 1 },
      { key: 'max_drawdown_percent', step: 0.5, adjust: 0.5 },
    ],
    []
  )

  if (!formData) {
    return <div className="safety-editor__invalid">Invalid strategy data.</div>
  }

  const updateRisk = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      risk: {
        ...prev.risk,
        [key]: value,
      },
    }))
  }

  const adjustRisk = (key, increment, amount) => {
    setFormData((prev) => {
      let next = parseFloat(prev.risk[key] || 0) + (increment ? amount : -amount)

      if (key === 'lot_size') next = Math.max(0.01, Math.min(1.0, parseFloat(next.toFixed(2))))
      else if (key === 'max_drawdown_percent') next = Math.max(0.5, Math.min(10.0, parseFloat(next.toFixed(1))))
      else if (key === 'max_trades_per_day') next = Math.max(1, Math.min(10, Math.round(next)))
      else next = Math.max(0, Math.round(next))

      return {
        ...prev,
        risk: {
          ...prev.risk,
          [key]: next,
        },
      }
    })
  }

  const shell = (
    <div className={`safety-editor ${embedded ? 'embedded' : ''}`}>
      <div className="safety-editor__hero">
        <div className="safety-editor__icon">🛡</div>
        <span className="safety-editor__eyebrow">Recovery modal</span>
        <h2>Make Strategy Safe</h2>
        <p>Your strategy hit validation safeguards. Adjust the recoverable risk parameters below and retry inside the same conversation.</p>
      </div>

      <div className="safety-editor__rules">
        <span className="safety-editor__rules-title">Current rule coverage</span>
        <div className="safety-editor__chips">
          {[
            'R1 Symbol required',
            'R2 Timeframe required',
            'R3 Entry condition',
            'R4 Exit condition',
            'R5 Lot size range',
            'R6 Stop-loss recommended',
            'R7 No conflicting logic',
            'R8 Max trades limited',
            'R9 No martingale',
            'R10 No infinite positions',
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="safety-editor__body">
        <div className="safety-editor__summary">
          <div>
            <small>Symbol</small>
            <strong>{formData.symbol}</strong>
          </div>
          <div>
            <small>Timeframe</small>
            <strong>{formData.timeframe}</strong>
          </div>
          <div>
            <small>Strategy</small>
            <strong>{formData.strategy_type}</strong>
          </div>
        </div>

        <div className="safety-editor__panel">
          <div className="safety-editor__panel-head">
            <h3>Recoverable risk parameters</h3>
            <p>These controls are currently focused on the risk values the system can safely repair inline.</p>
          </div>

          <div className="safety-editor__grid">
            {params.map(({ key, step, adjust }) => (
              <ParamRow
                key={key}
                fieldKey={key}
                value={formData.risk[key]}
                step={step}
                expanded={expandedDetail === key}
                onToggle={(field) => setExpandedDetail((current) => (current === field ? null : field))}
                onAdjust={(inc) => adjustRisk(key, inc, adjust)}
                onUpdate={updateRisk}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="safety-editor__actions">
        <button type="button" className="safety-editor__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="safety-editor__submit" onClick={() => onSubmit(JSON.stringify(formData))}>
          Submit Fixed Strategy
        </button>
      </div>
    </div>
  )

  if (embedded) return shell
  return <div className="page-wrap">{shell}</div>
}
