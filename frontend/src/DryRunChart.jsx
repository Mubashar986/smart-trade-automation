import { useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const SCENARIOS = [
  { key: 'bullish', label: 'Bullish', colorClass: 'is-bullish' },
  { key: 'bearish', label: 'Bearish', colorClass: 'is-bearish' },
  { key: 'sideways', label: 'Sideways', colorClass: 'is-sideways' },
  { key: 'random', label: 'Random', colorClass: 'is-random' },
]

const SYMBOL_PRICES = {
  XAUUSD: 3350,
  EURUSD: 1.1350,
  GBPUSD: 1.3300,
  USDJPY: 145.5,
  USDCHF: 0.8950,
  AUDUSD: 0.6450,
  BTCUSD: 95000,
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="dryrun-tooltip">
      <small>{label}s</small>
      <strong>{Number(payload[0].value).toFixed(4)}</strong>
    </div>
  )
}

function parseStrategy(job, entryOverride) {
  try {
    const parsed = typeof job.parsed_strategy === 'string' ? JSON.parse(job.parsed_strategy) : job.parsed_strategy
    const symbol = (parsed?.symbol ?? 'XAUUSD').toUpperCase()
    const direction = parsed?.entry?.action?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY'
    const symbolDefault = SYMBOL_PRICES[symbol] ?? 1000
    const entryPrice = entryOverride && !Number.isNaN(parseFloat(entryOverride)) ? parseFloat(entryOverride) : symbolDefault

    return {
      symbol,
      direction,
      entry_price: entryPrice,
      stop_loss_points: parsed?.risk?.stop_loss_points ?? 300,
      take_profit_points: parsed?.risk?.take_profit_points ?? 600,
      lot_size: parsed?.risk?.lot_size ?? 0.01,
    }
  } catch {
    return {
      symbol: 'XAUUSD',
      direction: 'BUY',
      entry_price: entryOverride && !Number.isNaN(parseFloat(entryOverride)) ? parseFloat(entryOverride) : 3350,
      stop_loss_points: 300,
      take_profit_points: 600,
      lot_size: 0.01,
    }
  }
}

export default function DryRunChart({ job, token }) {
  const [scenario, setScenario] = useState(null)
  const [entryOverride, setEntryOverride] = useState('')
  const [simulation, setSimulation] = useState(null)
  const [visibleData, setVisibleData] = useState([])
  const [loading, setLoading] = useState(false)
  const [animating, setAnimating] = useState(false)
  const intervalRef = useRef(null)

  const runSimulation = async (nextScenario) => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    setScenario(nextScenario)
    setSimulation(null)
    setVisibleData([])
    setLoading(true)

    const payload = parseStrategy(job, entryOverride)
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...payload,
          scenario: nextScenario,
          duration_seconds: 60,
          point_size: 1.0,
        }),
      })

      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSimulation(data)
      animatePath(data.price_path)
    } catch {
      alert('Simulation failed. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const animatePath = (path) => {
    setAnimating(true)
    let i = 0
    intervalRef.current = setInterval(() => {
      i += 1
      setVisibleData(path.slice(0, i))
      if (i >= path.length) {
        clearInterval(intervalRef.current)
        setAnimating(false)
      }
    }, 35)
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const parsedDefaults = parseStrategy(job, entryOverride)
  const result = simulation?.result
  const resultTone =
    result === 'TAKE_PROFIT_HIT'
      ? 'is-positive'
      : result === 'STOP_LOSS_HIT'
        ? 'is-negative'
        : 'is-neutral'

  return (
    <div className="dryrun-shell">
      <div className="dryrun-shell__top">
        <div className="dryrun-shell__entry">
          <label htmlFor="dryrun-entry">Entry</label>
          <input
            id="dryrun-entry"
            type="number"
            step="any"
            value={entryOverride}
            onChange={(event) => setEntryOverride(event.target.value)}
            placeholder={`${parsedDefaults.entry_price}`}
          />
        </div>
        <div className="dryrun-shell__scenarios">
          {SCENARIOS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dryrun-chip ${scenario === item.key ? `active ${item.colorClass}` : ''}`}
              onClick={() => runSimulation(item.key)}
              disabled={loading || animating}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="dryrun-loading">Running simulation...</div>}

      {simulation && !loading && (
        <div className="dryrun-result">
          <div className="dryrun-result__summary">
            <div>
              <span className="chat-thread__kicker">Simulation</span>
              <h4>
                {simulation.symbol} · {simulation.direction} · {scenario}
              </h4>
              <p>
                Entry {simulation.entry_price} · SL {simulation.stop_loss_price} · TP {simulation.take_profit_price}
              </p>
            </div>
            <div className={`dryrun-outcome ${resultTone}`}>
              <strong>{result === 'TAKE_PROFIT_HIT' ? 'Take Profit Hit' : result === 'STOP_LOSS_HIT' ? 'Stop Loss Hit' : 'No Exit Yet'}</strong>
              <small>{simulation.note}</small>
            </div>
          </div>

          <div className="dryrun-chart-frame">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={visibleData} margin={{ top: 4, right: 12, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: '#6f839d', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6f839d', fontSize: 11 }} width={64} tickFormatter={(value) => value.toFixed(2)} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={simulation.entry_price} stroke="#6f839d" strokeDasharray="5 5" />
                <ReferenceLine y={simulation.stop_loss_price} stroke="#ef4444" strokeDasharray="4 4" />
                <ReferenceLine y={simulation.take_profit_price} stroke="#19d2b0" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={result === 'STOP_LOSS_HIT' ? '#ef4444' : '#19d2b0'}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="dryrun-metrics">
            <div>
              <small>P/L Points</small>
              <strong>{simulation.pnl_points >= 0 ? `+${simulation.pnl_points}` : simulation.pnl_points}</strong>
            </div>
            <div>
              <small>Risk / Reward</small>
              <strong>1 : {simulation.risk_reward_ratio ?? '-'}</strong>
            </div>
            <div>
              <small>Exit</small>
              <strong>{simulation.exit_time ? `${simulation.exit_time}s` : 'Open'}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
