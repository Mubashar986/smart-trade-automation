import { useCallback, useEffect, useState } from 'react'
import LandingPage from './LandingPage'
import StrategyEditor from './StrategyEditor'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'

const API_URL = 'http://127.0.0.1:8000/api/v1'

function normalizeRoute(pathname) {
  if (pathname === '/login' || pathname === '/register' || pathname === '/app') {
    return pathname
  }
  return '/'
}

export default function App() {
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname))
  const [token, setToken] = useState(localStorage.getItem('smartTradeToken') || '')
  const [username, setUsername] = useState(localStorage.getItem('smartTradeUser') || '')
  const [jobs, setJobs] = useState([])
  const [billing, setBilling] = useState(null)
  const [fixingStrategy, setFixingStrategy] = useState(null)

  const navigate = useCallback((nextRoute) => {
    const normalized = normalizeRoute(nextRoute)
    if (normalized === normalizeRoute(window.location.pathname)) return
    window.history.pushState({}, '', normalized)
    setRoute(normalized)
  }, [])

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token])

  useEffect(() => {
    const onPopState = () => setRoute(normalizeRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const resolvedRoute = token ? '/app' : route === '/app' ? '/login' : route

  const handleLogout = useCallback(() => {
    localStorage.removeItem('smartTradeToken')
    localStorage.removeItem('smartTradeUser')
    setToken('')
    setUsername('')
    setJobs([])
    setBilling(null)
    navigate('/')
  }, [navigate])

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/status`, { headers: authHeaders() })
      if (res.ok) setBilling(await res.json())
    } catch {
      // Ignore temporary billing failures until a later successful refresh.
    }
  }, [authHeaders])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/results/history`, { headers: authHeaders() })
      if (res.ok) setJobs(await res.json())
      else if (res.status === 401) handleLogout()
    } catch {
      // Ignore temporary history failures until polling or manual retry succeeds.
    }
  }, [authHeaders, handleLogout])

  useEffect(() => {
    if (!token) return

    async function bootstrapDashboard() {
      await fetchBilling()
      await fetchHistory()
    }

    bootstrapDashboard()
  }, [fetchBilling, fetchHistory, token])

  useEffect(() => {
    if (!token) return
    const activeJobs = jobs.filter((job) => job.status !== 'completed' && job.status !== 'failed')
    if (!activeJobs.length) return

    const id = setInterval(async () => {
      const updated = await Promise.all(
        jobs.map(async (job) => {
          if (job.status === 'completed' || job.status === 'failed') return job
          try {
            const res = await fetch(`${API_URL}/results/${job.job_id}`, { headers: authHeaders() })
            if (res.ok) return { ...job, ...(await res.json()) }
          } catch {
            // Keep the last known state when a poll request fails.
          }
          return job
        })
      )
      setJobs(updated)
    }, 2000)

    return () => clearInterval(id)
  }, [authHeaders, jobs, token])

  const submitAuth = useCallback(async ({ mode, username: authUsername, email, password }) => {
    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
    const body =
      mode === 'login'
        ? { username: authUsername, password }
        : { username: authUsername, email, password }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        return { ok: false, error: data.detail || 'Authentication failed' }
      }

      localStorage.setItem('smartTradeToken', data.token)
      localStorage.setItem('smartTradeUser', data.username)
      setToken(data.token)
      setUsername(data.username)
      navigate('/app')
      return { ok: true }
    } catch {
      return { ok: false, error: 'Cannot connect to server' }
    }
  }, [navigate])

  const generatePrompt = useCallback(async (promptText, label) => {
    if (billing && !billing.is_pro && billing.tries_remaining <= 0) {
      return { ok: false, reason: 'upgrade' }
    }

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prompt: promptText }),
      })

      if (res.ok) {
        const data = await res.json()
        setJobs((prev) => [{ job_id: data.job_id, status: 'pending', prompt: label }, ...prev])
        fetchBilling()
        return { ok: true }
      }

      if (res.status === 429) return { ok: false, reason: 'upgrade' }
      if (res.status === 401) {
        handleLogout()
        return { ok: false, reason: 'unauthorized' }
      }

      return { ok: false, reason: 'error', message: 'Failed to submit strategy.' }
    } catch {
      return { ok: false, reason: 'error', message: 'Failed to connect to the backend.' }
    }
  }, [authHeaders, billing, fetchBilling, handleLogout])

  const openBillingPortal = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/create-portal`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      alert('Unable to open the billing portal right now.')
    }
  }, [authHeaders])

  const openCheckout = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/create-checkout`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      alert('Failed to initiate checkout')
    }
  }, [authHeaders])

  const submitFixedStrategy = async (jsonString) => {
    setFixingStrategy(null)
    await generatePrompt(jsonString, 'Fixed Strategy')
  }

  if (!token && resolvedRoute === '/') {
    return <LandingPage onSignIn={() => navigate('/login')} onGetStarted={() => navigate('/register')} />
  }

  if (!token) {
    return (
      <AuthPage
        mode={resolvedRoute === '/register' ? 'register' : 'login'}
        onModeChange={(nextMode) => navigate(nextMode === 'register' ? '/register' : '/login')}
        onBack={() => navigate('/')}
        onSubmitAuth={submitAuth}
      />
    )
  }

  if (fixingStrategy) {
    return (
      <div className="page-wrap">
        <StrategyEditor
          initialData={fixingStrategy}
          onSubmit={submitFixedStrategy}
          onCancel={() => setFixingStrategy(null)}
        />
      </div>
    )
  }

  return (
    <DashboardPage
      username={username}
      billing={billing}
      jobs={jobs}
      token={token}
      onGeneratePrompt={generatePrompt}
      onOpenBillingPortal={openBillingPortal}
      onOpenFixStrategy={setFixingStrategy}
      onCheckout={openCheckout}
      onLogout={handleLogout}
    />
  )
}
