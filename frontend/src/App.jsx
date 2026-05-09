import { useState, useEffect } from 'react'
import StrategyEditor from './StrategyEditor'
import DryRunChart from './DryRunChart'

const API_URL = 'http://127.0.0.1:8000/api/v1'

const PIPELINE_STEPS = [
  { key: 'pending',     label: 'Queued',      icon: '⏳' },
  { key: 'parsing',    label: 'Parsing',     icon: '🔍' },
  { key: 'validating', label: 'Validating',  icon: '🛡️' },
  { key: 'generating', label: 'Generating',  icon: '✨' },
  { key: 'compiling',  label: 'Compiling',   icon: '⚙️' },
  { key: 'backtesting',label: 'Backtesting', icon: '📊' },
  { key: 'completed',  label: 'Done',        icon: '✅' },
]

const STEP_INDEX = Object.fromEntries(PIPELINE_STEPS.map((s, i) => [s.key, i]))

function PipelineTracker({ status }) {
  const current = STEP_INDEX[status] ?? 0
  const isFailed = status === 'failed'
  return (
    <div className="pipeline-tracker">
      {PIPELINE_STEPS.map((step, i) => {
        const done = i < current
        const active = i === current && !isFailed
        return (
          <div key={step.key} className={`pipeline-step ${done ? 'done' : ''} ${active ? 'active' : ''} ${isFailed && i === current ? 'failed-step' : ''}`}>
            <div className="step-dot">
              <span>{done ? '✓' : step.icon}</span>
            </div>
            <span className="step-label">{step.label}</span>
            {i < PIPELINE_STEPS.length - 1 && <div className={`step-line ${done ? 'done' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('smartTradeToken') || '')
  const [username, setUsername] = useState(localStorage.getItem('smartTradeUser') || '')
  const [isLogin, setIsLogin] = useState(true)

  const [authUsername, setAuthUsername] = useState('')
  const [authEmail, setAuthEmail]       = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError]       = useState('')
  const [authLoading, setAuthLoading]   = useState(false)

  const [prompt, setPrompt]             = useState('')
  const [loading, setLoading]           = useState(false)
  const [jobs, setJobs]                 = useState([])
  const [fixingStrategy, setFixingStrategy] = useState(null)
  const [expandedJob, setExpandedJob]   = useState(null)
  const [showSimulation, setShowSimulation] = useState({})

  const [billing, setBilling]           = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [checkoutLoading, setCheckoutLoading]   = useState(false)

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  })

  useEffect(() => {
    if (!token) return
    fetchHistory()
    fetchBilling()
  }, [token])

  const fetchBilling = async () => {
    try {
      const res = await fetch(`${API_URL}/billing/status`, { headers: authHeaders() })
      if (res.ok) setBilling(await res.json())
    } catch {}
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/results/history`, { headers: authHeaders() })
      if (res.ok) setJobs(await res.json())
      else if (res.status === 401) handleLogout()
    } catch {}
  }

  useEffect(() => {
    if (!token) return
    const active = jobs.filter(j => j.status !== 'completed' && j.status !== 'failed')
    if (!active.length) return
    const id = setInterval(async () => {
      const updated = await Promise.all(jobs.map(async (job) => {
        if (job.status === 'completed' || job.status === 'failed') return job
        try {
          const res = await fetch(`${API_URL}/results/${job.job_id}`, { headers: authHeaders() })
          if (res.ok) return { ...job, ...await res.json() }
        } catch {}
        return job
      }))
      setJobs(updated)
    }, 2000)
    return () => clearInterval(id)
  }, [jobs, token])

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    const endpoint = isLogin ? '/auth/login' : '/auth/register'
    const body = isLogin
      ? { username: authUsername, password: authPassword }
      : { username: authUsername, email: authEmail, password: authPassword }
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('smartTradeToken', data.token)
        localStorage.setItem('smartTradeUser', data.username)
        setToken(data.token); setUsername(data.username)
        setAuthUsername(''); setAuthEmail(''); setAuthPassword('')
      } else {
        setAuthError(data.detail || 'Authentication failed')
      }
    } catch {
      setAuthError('Cannot connect to server')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('smartTradeToken')
    localStorage.removeItem('smartTradeUser')
    setToken(''); setUsername(''); setJobs([]); setBilling(null)
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    try {
      const res = await fetch(`${API_URL}/billing/create-checkout`, { method: 'POST', headers: authHeaders() })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      alert('Failed to initiate checkout')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const submitPrompt = async (promptText, label) => {
    if (billing && !billing.is_pro && billing.tries_remaining <= 0) {
      setShowUpgradeModal(true); return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prompt: promptText })
      })
      if (res.ok) {
        const data = await res.json()
        setJobs(prev => [{ job_id: data.job_id, status: 'pending', prompt: label }, ...prev])
        setPrompt('')
        fetchBilling()
      } else if (res.status === 429) {
        setShowUpgradeModal(true)
      } else if (res.status === 401) {
        handleLogout()
      }
    } catch {
      alert('Failed to connect to the backend!')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim()) return
    submitPrompt(prompt, prompt)
  }

  const handleSubmitFixedStrategy = async (jsonString) => {
    setFixingStrategy(null)
    await submitPrompt(jsonString, '🛡️ Fixed Strategy')
  }

  // ── AUTH SCREEN ───────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-glow" />
        <div className="auth-box">
          <div className="auth-logo">
            <span className="logo-icon">⚡</span>
            <h1>SmartTrade</h1>
          </div>
          <p className="auth-tagline">AI-Powered MQL5 Expert Advisor Generator</p>

          <div className="auth-tabs">
            <button className={isLogin ? 'tab active' : 'tab'} onClick={() => { setIsLogin(true); setAuthError('') }}>Sign In</button>
            <button className={!isLogin ? 'tab active' : 'tab'} onClick={() => { setIsLogin(false); setAuthError('') }}>Register</button>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            <div className="field-group">
              <label>Username</label>
              <input type="text" placeholder="your_username" value={authUsername} onChange={e => setAuthUsername(e.target.value)} required />
            </div>
            {!isLogin && (
              <div className="field-group">
                <label>Email</label>
                <input type="email" placeholder="you@email.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
              </div>
            )}
            <div className="field-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={8} />
            </div>
            {!isLogin && <p className="hint-text">Min 8 characters · 1 letter · 1 number · 1 special character</p>}
            {authError && <div className="auth-error">{authError}</div>}
            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? <span className="spinner" /> : (isLogin ? 'Sign In →' : 'Create Account →')}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── STRATEGY EDITOR OVERLAY ───────────────────────────────────────────
  if (fixingStrategy) {
    return (
      <div className="page-wrap">
        <StrategyEditor
          initialData={fixingStrategy}
          onSubmit={handleSubmitFixedStrategy}
          onCancel={() => setFixingStrategy(null)}
        />
      </div>
    )
  }

  // ── MAIN DASHBOARD ────────────────────────────────────────────────────
  const usedCount = billing?.daily_used ?? 0
  const usedMax   = 5
  const isPro     = billing?.is_pro ?? false

  return (
    <div className="page-wrap">

      {/* ── NAV ── */}
      <nav className="topnav">
        <div className="nav-brand">
          <span className="logo-icon">⚡</span>
          <span className="nav-title">SmartTrade</span>
        </div>
        <div className="nav-right">
          {isPro
            ? <span className="badge-pro">PRO</span>
            : <span className="usage-pill">{usedCount}/{usedMax} today</span>
          }
          {billing?.has_portal && (
            <button className="btn-ghost" onClick={async () => {
              const res = await fetch(`${API_URL}/billing/create-portal`, { method: 'POST', headers: authHeaders() })
              const data = await res.json()
              if (data.url) window.location.href = data.url
            }}>Billing</button>
          )}
          <span className="nav-user">👤 {username}</span>
          <button className="btn-ghost danger" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {/* ── HERO / PROMPT ── */}
      <section className="hero-section">
        <div className="hero-glow" />
        <h2 className="hero-title">Generate Your Expert Advisor</h2>
        <p className="hero-sub">Describe your trading strategy in plain English and our AI will generate, compile, and backtest MQL5 code instantly.</p>

        <form onSubmit={handleSubmit} className="prompt-form">
          <div className="prompt-wrapper">
            <textarea
              className="prompt-input"
              placeholder="e.g. Buy XAUUSD when RSI(14) drops below 30, close when RSI rises above 70. Use 0.01 lot size."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={loading}
              rows={4}
            />
            <button type="submit" className="btn-generate" disabled={loading || !prompt.trim()}>
              {loading
                ? <><span className="spinner" /> Submitting…</>
                : <><span>✨</span> Generate Strategy</>
              }
            </button>
          </div>
          {!isPro && (
            <div className="usage-bar-wrap">
              <div className="usage-bar">
                <div className="usage-fill" style={{ width: `${(usedCount / usedMax) * 100}%` }} />
              </div>
              <span className="usage-label">{usedMax - usedCount} generations remaining today</span>
              <button type="button" className="btn-upgrade-inline" onClick={() => setShowUpgradeModal(true)}>Upgrade →</button>
            </div>
          )}
        </form>
      </section>

      {/* ── JOB CARDS ── */}
      {jobs.length > 0 && (
        <section className="jobs-section">
          <div className="section-header">
            <h3>Your Algorithms</h3>
            <span className="count-badge">{jobs.length} / 5</span>
          </div>

          <div className="jobs-list">
            {jobs.map(job => {
              const isExpanded = expandedJob === job.job_id
              const isFailed   = job.status === 'failed'
              const isDone     = job.status === 'completed'
              const isActive   = !isFailed && !isDone

              return (
                <div key={job.job_id} className={`job-card ${isFailed ? 'card-failed' : ''} ${isDone ? 'card-done' : ''}`}>

                  {/* Card Header */}
                  <div className="card-top" onClick={() => setExpandedJob(isExpanded ? null : job.job_id)}>
                    <div className="card-meta">
                      <span className="card-id">#{job.job_id.substring(0, 8)}</span>
                      <p className="card-prompt">{job.prompt}</p>
                    </div>
                    <div className="card-right">
                      <span className={`status-pill status-${job.status}`}>
                        {job.status === 'failed' ? '✗ Failed' :
                         job.status === 'completed' ? '✓ Done' :
                         job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                      <span className="expand-arrow">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Pipeline tracker (always visible for active jobs) */}
                  {isActive && <PipelineTracker status={job.status} />}

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="card-body">

                      {/* Failed state */}
                      {isFailed && (
                        <div className="error-panel">
                          <div className="error-panel-header">
                            <span className="error-icon">⚠️</span>
                            <strong>Validation Failed</strong>
                          </div>
                          {job.error_message && (
                            <pre className="error-text">{job.error_message}</pre>
                          )}
                          {job.compile_log && (
                            <div className="compile-log">
                              <strong>Compilation Log:</strong>
                              <pre>{job.compile_log}</pre>
                            </div>
                          )}
                          {job.parsed_strategy && (
                            <button className="btn-fix" onClick={() => setFixingStrategy(job.parsed_strategy)}>
                              🛡️ Make Strategy Safe
                            </button>
                          )}
                        </div>
                      )}

                      {/* Completed state */}
                      {isDone && (
                        <div className="success-panel">
                          {job.backtest_result && (
                            <div className="backtest-box">
                              <div className="backtest-header">📊 Backtest Metrics</div>
                              <pre className="backtest-text">{job.backtest_result}</pre>
                            </div>
                          )}
                          <div className="code-header">
                            <span>⚙️ MQL5 Source Code</span>
                            <button className="btn-copy" onClick={() => navigator.clipboard.writeText(job.script_content)}>Copy</button>
                          </div>
                          <pre className="code-viewer">{job.script_content}</pre>

                          {/* Dry Run Simulation */}
                          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showSimulation[job.job_id] ? '12px' : '0' }}>
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '.95rem' }}>🧪 Mock Dry-Run Simulation</p>
                                <p style={{ fontSize: '.78rem', color: '#64748b', marginTop: '2px' }}>Visually test how your SL & TP levels hold in different market conditions.</p>
                              </div>
                              <button
                                style={{
                                  padding: '8px 18px', borderRadius: '10px', fontFamily: 'Inter,sans-serif',
                                  fontWeight: 700, fontSize: '.85rem', cursor: 'pointer',
                                  background: showSimulation[job.job_id] ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#818cf8,#6366f1)',
                                  border: showSimulation[job.job_id] ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                  color: showSimulation[job.job_id] ? '#64748b' : '#fff',
                                  transition: 'all .2s',
                                  boxShadow: showSimulation[job.job_id] ? 'none' : '0 0 16px rgba(99,102,241,0.4)'
                                }}
                                onClick={() => setShowSimulation(prev => ({ ...prev, [job.job_id]: !prev[job.job_id] }))}
                              >
                                {showSimulation[job.job_id] ? '✕ Hide' : '▶ Run Simulation'}
                              </button>
                            </div>
                            {showSimulation[job.job_id] && (
                              <DryRunChart job={job} token={token} />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Still running state in expanded */}
                      {isActive && (
                        <div className="running-msg">
                          <PipelineTracker status={job.status} />
                          <p>Pipeline running… this may take a few minutes.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── UPGRADE MODAL ── */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🚀</div>
            <h2>Upgrade to Pro</h2>
            <p>You've used all 5 free generations for today.</p>
            <ul className="feature-list">
              <li>✅ Unlimited script generations</li>
              <li>✅ Priority compilation queue</li>
              <li>✅ Full backtesting reports</li>
              <li>✅ Advanced risk management features</li>
            </ul>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowUpgradeModal(false)}>Maybe Later</button>
              <button className="btn-pro" onClick={handleCheckout} disabled={checkoutLoading}>
                {checkoutLoading ? <span className="spinner" /> : 'Upgrade · $9.99 / mo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
