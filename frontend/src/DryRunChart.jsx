import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from 'recharts';

const SCENARIOS = [
  { key: 'bullish',  label: 'Bullish',  icon: '📈', color: '#00d4a0' },
  { key: 'bearish',  label: 'Bearish',  icon: '📉', color: '#ef4444' },
  { key: 'sideways', label: 'Sideways', icon: '↔',  color: '#a78bfa' },
  { key: 'random',   label: 'Random',   icon: '🎲', color: '#f59e0b' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'rgba(5,13,26,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px', padding: '10px 14px', fontSize: '.82rem'
    }}>
      <p style={{ color: '#64748b', marginBottom: 4 }}>t = {label}s</p>
      <p style={{ color: d.color, fontWeight: 700 }}>Price: {Number(d.value).toFixed(5)}</p>
    </div>
  );
};

// Realistic current market prices per symbol (simulation baseline)
const SYMBOL_PRICES = {
  XAUUSD: 3350,    // Gold
  EURUSD: 1.1350,  // Euro
  GBPUSD: 1.3300,  // British Pound
  USDJPY: 145.50,  // Yen
  USDCHF: 0.8950,  // Swiss Franc
  AUDUSD: 0.6450,  // Australian Dollar
  BTCUSD: 95000,   // Bitcoin (for fun)
};

export default function DryRunChart({ job, token }) {
  const [scenario, setScenario]     = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [visibleData, setVisibleData] = useState([]);
  const [animating, setAnimating]   = useState(false);
  const [done, setDone]             = useState(false);
  const [entryOverride, setEntryOverride] = useState(''); // user can manually set entry
  const intervalRef = useRef(null);

  // Extract params from parsed_strategy
  const getParsedParams = () => {
    try {
      const p = typeof job.parsed_strategy === 'string'
        ? JSON.parse(job.parsed_strategy)
        : job.parsed_strategy;

      const symbol    = p?.symbol ?? 'XAUUSD';
      const direction = p?.entry?.action?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY';

      // entry.value is an INDICATOR threshold (RSI level, price level etc.), NOT the live market price.
      // Use symbol-based realistic price or user's manual override.
      const symbolDefault = SYMBOL_PRICES[symbol.toUpperCase()] ?? 1000;
      const entryPrice    = entryOverride && !isNaN(parseFloat(entryOverride))
        ? parseFloat(entryOverride)
        : symbolDefault;

      const slPoints  = p?.risk?.stop_loss_points   ?? 300;
      const tpPoints  = p?.risk?.take_profit_points ?? 600;

      return {
        symbol,
        direction,
        entry_price:        entryPrice,
        stop_loss_points:   slPoints,
        take_profit_points: tpPoints,
        lot_size:           p?.risk?.lot_size ?? 0.01,
      };
    } catch {
      const fallbackPrice = entryOverride && !isNaN(parseFloat(entryOverride))
        ? parseFloat(entryOverride) : 3350;
      return { symbol: 'XAUUSD', direction: 'BUY', entry_price: fallbackPrice, stop_loss_points: 300, take_profit_points: 600, lot_size: 0.01 };
    }
  };

  const runSimulation = async (sc) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setScenario(sc);
    setSimulation(null);
    setVisibleData([]);
    setDone(false);
    setLoading(true);

    const params = getParsedParams();
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...params, scenario: sc, duration_seconds: 60, point_size: 1.0 })
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSimulation(data);
      animatePath(data.price_path);
    } catch {
      alert('Simulation failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const animatePath = (path) => {
    setAnimating(true);
    setDone(false);
    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      setVisibleData(path.slice(0, i));
      if (i >= path.length) {
        clearInterval(intervalRef.current);
        setAnimating(false);
        setDone(true);
      }
    }, 35); // ~35ms per point = ~2.1s for 60 points
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const result = simulation?.result;
  const isWin  = result === 'TAKE_PROFIT_HIT';
  const isLoss = result === 'STOP_LOSS_HIT';

  return (
    <div style={{ marginTop: '20px' }}>

      {/* Entry Price Override */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '.82rem', color: '#64748b', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Simulation Entry Price
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="number"
            step="any"
            placeholder={`Default: ${SYMBOL_PRICES[(() => { try { const p = typeof job.parsed_strategy === 'string' ? JSON.parse(job.parsed_strategy) : job.parsed_strategy; return (p?.symbol ?? 'XAUUSD').toUpperCase(); } catch { return 'XAUUSD'; } })()] ?? 3350}`}
            value={entryOverride}
            onChange={e => setEntryOverride(e.target.value)}
            style={{
              width: '180px', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
              padding: '9px 14px', color: '#e2e8f0',
              fontFamily: 'Inter,sans-serif', fontSize: '.9rem', outline: 'none',
            }}
          />
          <span style={{ fontSize: '.78rem', color: '#64748b' }}>
            💡 The strategy's indicator value (RSI/price threshold) is not the market price.
            Enter the current market price here for a realistic simulation.
          </span>
        </div>
      </div>

      {/* Scenario buttons */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '.82rem', color: '#64748b', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Choose Market Scenario
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SCENARIOS.map(sc => (
            <button
              key={sc.key}
              onClick={() => runSimulation(sc.key)}
              disabled={loading || animating}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: `1px solid ${scenario === sc.key ? sc.color : 'rgba(255,255,255,0.1)'}`,
                background: scenario === sc.key ? `${sc.color}20` : 'rgba(255,255,255,0.03)',
                color: scenario === sc.key ? sc.color : '#94a3b8',
                fontFamily: 'Inter,sans-serif',
                fontWeight: 700,
                fontSize: '.85rem',
                cursor: loading || animating ? 'not-allowed' : 'pointer',
                transition: 'all .2s',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: scenario === sc.key ? `0 0 14px ${sc.color}40` : 'none',
              }}
            >
              {sc.icon} {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px', animation: 'spin 1s linear infinite', display:'inline-block' }}>⚙️</div>
          <p>Running simulation…</p>
        </div>
      )}

      {/* Chart */}
      {simulation && !loading && (
        <div style={{
          background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px', padding: '20px', animation: 'fadeUp .3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: '1rem' }}>
                {simulation.symbol} · {simulation.direction} · {SCENARIOS.find(s=>s.key===scenario)?.icon} {SCENARIOS.find(s=>s.key===scenario)?.label}
              </p>
              <p style={{ fontSize: '.8rem', color: '#64748b', marginTop: '2px' }}>
                Entry: <strong style={{ color: '#e2e8f0' }}>{simulation.entry_price}</strong>
                &nbsp;·&nbsp; SL: <strong style={{ color: '#ef4444' }}>{simulation.stop_loss_price}</strong>
                &nbsp;·&nbsp; TP: <strong style={{ color: '#00d4a0' }}>{simulation.take_profit_price}</strong>
              </p>
            </div>
            {animating && (
              <span style={{
                background: 'rgba(0,212,160,0.15)', border: '1px solid rgba(0,212,160,0.3)',
                color: '#00d4a0', fontSize: '.75rem', fontWeight: 700,
                padding: '4px 12px', borderRadius: '20px', animation: 'dotPulse 1.2s infinite'
              }}>● LIVE</span>
            )}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={visibleData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="time"
                label={{ value: 'Seconds', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#64748b', fontSize: 11 }}
                width={75}
                tickFormatter={v => v.toFixed(2)}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={simulation.entry_price}     label={{ value: 'Entry', fill: '#818cf8', fontSize: 11 }} stroke="#818cf8" strokeDasharray="5 3" />
              <ReferenceLine y={simulation.stop_loss_price} label={{ value: 'SL',    fill: '#ef4444', fontSize: 11 }} stroke="#ef4444" strokeDasharray="5 3" />
              <ReferenceLine y={simulation.take_profit_price} label={{ value: 'TP',  fill: '#00d4a0', fontSize: 11 }} stroke="#00d4a0" strokeDasharray="5 3" />
              <Line
                type="monotone"
                dataKey="price"
                stroke={isWin ? '#00d4a0' : isLoss ? '#ef4444' : '#a78bfa'}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Result Card */}
          {done && (
            <div style={{
              marginTop: '16px',
              background: isWin ? 'rgba(0,212,160,0.08)' : isLoss ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${isWin ? 'rgba(0,212,160,0.3)' : isLoss ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              animation: 'fadeUp .4s ease',
              boxShadow: isWin ? '0 0 20px rgba(0,212,160,0.15)' : isLoss ? '0 0 20px rgba(239,68,68,0.15)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2rem' }}>{isWin ? '✅' : isLoss ? '❌' : '⏳'}</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: '1.05rem', color: isWin ? '#00d4a0' : isLoss ? '#ef4444' : '#f59e0b' }}>
                    {isWin ? 'Take Profit Hit!' : isLoss ? 'Stop Loss Hit' : 'Time Expired (No Exit)'}
                  </p>
                  <p style={{ fontSize: '.8rem', color: '#64748b', marginTop: '2px' }}>
                    {simulation.note}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '20px', fontSize: '.9rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#64748b', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.5px' }}>P/L Points</p>
                  <p style={{ fontWeight: 800, color: simulation.pnl_points >= 0 ? '#00d4a0' : '#ef4444', fontSize: '1.15rem' }}>
                    {simulation.pnl_points >= 0 ? '+' : ''}{simulation.pnl_points}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#64748b', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.5px' }}>Risk:Reward</p>
                  <p style={{ fontWeight: 800, color: '#e2e8f0', fontSize: '1.15rem' }}>
                    1 : {simulation.risk_reward_ratio ?? '—'}
                  </p>
                </div>
                {simulation.exit_time && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#64748b', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.5px' }}>Exit At</p>
                    <p style={{ fontWeight: 800, color: '#e2e8f0', fontSize: '1.15rem' }}>
                      {simulation.exit_time}s
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
