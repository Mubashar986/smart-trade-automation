import { useState } from 'react';

const PARAM_DETAILS = {
  lot_size: {
    rule: "Rule 5",
    title: "Lot Size (Safe Range: 0.01 – 1.0)",
    detail: "Lot Size controls how large each trade is. 0.01 is the safest minimum — it means very small risk per trade. Going above 1.0 puts an unsafe amount of capital at risk in a single trade."
  },
  stop_loss_points: {
    rule: "Rule 6",
    title: "Stop-Loss (Points)",
    detail: "Stop-Loss is the most important safety net. If the market moves against you by this many points, the trade is automatically closed to prevent further loss. 300 points (30 pips) is a safe default. Without it, a single bad trade can wipe your account."
  },
  max_trades_per_day: {
    rule: "Rule 8",
    title: "Max Trades Per Day (Limit: 1 – 10)",
    detail: "This limits how many trades the bot opens each day. Trading too frequently in volatile markets compounds losses rapidly. A safe default is 3. The maximum allowed by our system is 10."
  },
  take_profit_points: {
    rule: "Recommended",
    title: "Take Profit (Points)",
    detail: "Take Profit automatically closes the trade once it reaches a profit target. 600 points provides a healthy 1:2 risk-to-reward ratio when paired with a 300 point stop-loss."
  },
  max_drawdown_percent: {
    rule: "Rule 9 Guard",
    title: "Max Drawdown (%) — Martingale Guard",
    detail: "Setting a drawdown limit prevents unlimited martingale patterns. If your account balance drops by this percentage in a day, trading halts automatically. 5.0% is a safe default."
  }
};

// Helper to build a param row
function ParamRow({ fieldKey, label, value, step, onAdjust, onUpdate, expandedKey, onToggle }) {
  const info = PARAM_DETAILS[fieldKey];
  const isExpanded = expandedKey === fieldKey;

  return (
    <div className="param-item">
      <div className="param-header">
        <div>
          <label>{label}</label>
          {info?.rule && <span className="rule-tag">{info.rule}</span>}
        </div>
        <button className="detail-btn" onClick={() => onToggle(fieldKey)}>?</button>
      </div>
      <div className="param-controls">
        <button onClick={() => onAdjust(false)}>−</button>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onUpdate(fieldKey, step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        />
        <button onClick={() => onAdjust(true)}>+</button>
      </div>
      {isExpanded && (
        <div className="param-detail">
          <strong style={{ color: 'var(--amber)', display: 'block', marginBottom: '4px' }}>{info?.title}</strong>
          {info?.detail}
        </div>
      )}
    </div>
  );
}

export default function StrategyEditor({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => {
    try {
      const data = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
      return {
        symbol: data.symbol || 'XAUUSD',
        timeframe: data.timeframe || 'H1',
        strategy_type: data.strategy_type || 'RSI',
        entry: {
          indicator: data.entry?.indicator || 'RSI',
          period: data.entry?.period || 14,
          operator: data.entry?.operator || '<',
          value: data.entry?.value || 30,
          action: data.entry?.action || 'BUY'
        },
        exit: {
          indicator: data.exit?.indicator || 'RSI',
          period: data.exit?.period || 14,
          operator: data.exit?.operator || '>',
          value: data.exit?.value || 70,
          action: data.exit?.action || 'CLOSE'
        },
        risk: {
          lot_size: data.risk?.lot_size ?? 0.01,
          stop_loss_points: data.risk?.stop_loss_points ?? 300,
          take_profit_points: data.risk?.take_profit_points ?? 600,
          max_trades_per_day: data.risk?.max_trades_per_day ?? 3,
          max_drawdown_percent: data.risk?.max_drawdown_percent ?? 5.0,
          max_consecutive_losses: data.risk?.max_consecutive_losses ?? 3,
          trailing_stop_points: data.risk?.trailing_stop_points ?? 100,
          slippage_points: data.risk?.slippage_points ?? 30
        }
      };
    } catch {
      return null;
    }
  });

  const [expandedDetail, setExpandedDetail] = useState(null);

  if (!formData) return <div className="glass-card">Invalid strategy data.</div>;

  const toggleDetail = (key) => setExpandedDetail(expandedDetail === key ? null : key);

  const updateRisk = (key, value) => {
    setFormData(prev => ({ ...prev, risk: { ...prev.risk, [key]: value } }));
  };

  const adjustRisk = (key, increment, step) => {
    setFormData(prev => {
      let next = parseFloat(prev.risk[key] || 0) + (increment ? step : -step);
      if (key === 'lot_size') next = Math.max(0.01, Math.min(1.0, parseFloat(next.toFixed(2))));
      else if (key === 'max_drawdown_percent') next = Math.max(0.5, Math.min(10.0, parseFloat(next.toFixed(1))));
      else if (key === 'max_trades_per_day') next = Math.max(1, Math.min(10, next));
      else next = Math.max(0, next);
      return { ...prev, risk: { ...prev.risk, [key]: next } };
    });
  };

  const params = [
    { key: 'lot_size',              label: 'Lot Size',              step: 0.01,  adjStep: 0.01 },
    { key: 'stop_loss_points',      label: 'Stop-Loss (Points)',    step: 1,     adjStep: 50   },
    { key: 'take_profit_points',    label: 'Take Profit (Points)',  step: 1,     adjStep: 50   },
    { key: 'max_trades_per_day',    label: 'Max Trades / Day',      step: 1,     adjStep: 1    },
    { key: 'max_drawdown_percent',  label: 'Max Drawdown (%)',      step: 0.5,   adjStep: 0.5  },
  ];

  return (
    <div className="page-wrap">
      <div style={{
        background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:'20px',padding:'36px',maxWidth:'760px',margin:'40px auto',
        animation:'fadeUp .4s ease'
      }}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{fontSize:'2.5rem',marginBottom:'8px'}}>🛡️</div>
          <h2 style={{fontSize:'1.6rem',fontWeight:800,marginBottom:'8px',
            background:'linear-gradient(135deg,#fff 30%,#00d4a0)',
            WebkitBackgroundClip:'text',backgroundClip:'text',WebkitTextFillColor:'transparent'
          }}>Make Strategy Safe</h2>
          <p style={{color:'#64748b',fontSize:'.9rem'}}>Your strategy failed validation. Adjust the parameters below to meet all 10 safety rules.</p>
        </div>

      {/* Rules checklist */}
        <div style={{
          background:'rgba(0,212,160,0.04)',border:'1px solid rgba(0,212,160,0.12)',
          borderRadius:'12px',padding:'16px 20px',marginBottom:'24px'
        }}>
          <strong style={{display:'block',color:'#00d4a0',fontSize:'.8rem',
            textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>
            Safety Rules Checklist
          </strong>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
            {[
              "Symbol is required","Timeframe is required","Entry condition",
              "Exit condition","Lot size range","Stop-loss recommended",
              "No conflicting logic","Max trades limited","No martingale","No infinite positions"
            ].map((r,i)=>(
              <span key={i} style={{
                background:'rgba(0,212,160,0.08)',border:'1px solid rgba(0,212,160,0.2)',
                color:'#64748b',fontSize:'.72rem',padding:'3px 9px',borderRadius:'20px'
              }}>✓ R{i+1}: {r}</span>
            ))}
          </div>
        </div>

        <div style={{
          background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:'12px',padding:'20px',marginBottom:'20px'
        }}>
          <h3 style={{fontSize:'1rem',fontWeight:700,color:'#00d4a0',marginBottom:'16px'}}>Risk Parameters</h3>
          <div className="params-grid">
          {params.map(({ key, label, step, adjStep }) => (
            <ParamRow
              key={key}
              fieldKey={key}
              label={label}
              value={formData.risk[key]}
              step={step}
              onAdjust={(inc) => adjustRisk(key, inc, adjStep)}
              onUpdate={updateRisk}
              expandedKey={expandedDetail}
              onToggle={toggleDetail}
            />
          ))}
          </div>
        </div>

        <div style={{display:'flex',gap:'14px',marginTop:'4px'}}>
          <button style={{
            flex:1,padding:'12px',background:'transparent',
            border:'1px solid rgba(255,255,255,0.1)',color:'#64748b',
            borderRadius:'12px',cursor:'pointer',fontFamily:'Inter,sans-serif',
            fontSize:'.9rem',transition:'all .2s'
          }} onClick={onCancel}>← Cancel</button>
          <button style={{
            flex:2,padding:'12px',
            background:'linear-gradient(135deg,#00d4a0,#00b386)',
            color:'#050d1a',border:'none',borderRadius:'12px',
            cursor:'pointer',fontFamily:'Inter,sans-serif',
            fontSize:'.95rem',fontWeight:700,
            boxShadow:'0 0 20px rgba(0,212,160,0.3)',transition:'all .25s'
          }} onClick={() => onSubmit(JSON.stringify(formData))}>
            Submit Fixed Strategy →
          </button>
        </div>
      </div>
    </div>
  );
}
