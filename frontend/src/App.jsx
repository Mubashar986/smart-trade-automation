import { useCallback, useEffect, useState } from 'react'
import LandingPage from './LandingPage'
import AuthPage from './pages/AuthPage'
import ChatWorkspacePage from './pages/ChatWorkspacePage'

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
  const [billing, setBilling] = useState(null)

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
    setBilling(null)
    navigate('/')
  }, [navigate])

  const fetchBilling = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/billing/status`, { headers: authHeaders() })
      if (res.ok) setBilling(await res.json())
    } catch {
      // Ignore temporary billing refresh failures until the next successful request.
    }
  }, [authHeaders, token])

  useEffect(() => {
    async function bootstrapBilling() {
      await fetchBilling()
    }

    bootstrapBilling()
  }, [fetchBilling])

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

  return (
    <ChatWorkspacePage
      token={token}
      username={username}
      billing={billing}
      onRefreshBilling={fetchBilling}
      onOpenBillingPortal={openBillingPortal}
      onCheckout={openCheckout}
      onLogout={handleLogout}
    />
  )
}
