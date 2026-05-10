import { useState } from 'react'
import { BrandLockup } from '../BrandSystem'

export default function AuthPage({ mode, onModeChange, onBack, onSubmitAuth }) {
  const [authUsername, setAuthUsername] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const isLogin = mode === 'login'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    const result = await onSubmitAuth({
      mode,
      username: authUsername,
      email: authEmail,
      password: authPassword,
    })

    if (!result.ok) {
      setAuthError(result.error || 'Authentication failed')
    } else {
      setAuthUsername('')
      setAuthEmail('')
      setAuthPassword('')
    }

    setAuthLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <div className="auth-box">
        <button type="button" className="auth-backlink" onClick={onBack}>
          Back to landing
        </button>

        <div className="auth-logo auth-logo-stack">
          <BrandLockup label="SmartTrade AI" />
        </div>
        <p className="auth-tagline">
          Plain-English strategy workflows with clearer validation, generation, and compilation visibility.
        </p>

        <div className="auth-tabs">
          <button
            className={isLogin ? 'tab active' : 'tab'}
            onClick={() => {
              setAuthError('')
              onModeChange('login')
            }}
          >
            Sign In
          </button>
          <button
            className={!isLogin ? 'tab active' : 'tab'}
            onClick={() => {
              setAuthError('')
              onModeChange('register')
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="your_username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="field-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="********"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {!isLogin && (
            <p className="hint-text">Min 8 characters, 1 letter, 1 number, and 1 special character.</p>
          )}

          {authError && <div className="auth-error">{authError}</div>}
          <button type="submit" className="btn-primary" disabled={authLoading}>
            {authLoading ? <span className="spinner" /> : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
