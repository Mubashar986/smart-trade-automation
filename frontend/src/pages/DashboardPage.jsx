import { useMemo, useState } from 'react'
import DashboardTopNav from '../components/dashboard/DashboardTopNav'
import StrategyComposer from '../components/dashboard/StrategyComposer'
import DashboardSideRail from '../components/dashboard/DashboardSideRail'
import EmptyDashboardGuidance from '../components/dashboard/EmptyDashboardGuidance'
import JobsSection from '../components/dashboard/JobsSection'
import HelpModal from '../components/dashboard/HelpModal'
import ModelPickerModal from '../components/dashboard/ModelPickerModal'
import UpgradeModal from '../components/dashboard/UpgradeModal'
import '../dashboard.css'

const DEFAULT_MODEL = {
  provider: 'Google Gemini',
  model: 'Gemini 2.5 Flash',
  quality: 'Balanced',
}

function scrollToSection(id) {
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function DashboardPage({
  username,
  billing,
  jobs,
  token,
  onGeneratePrompt,
  onOpenBillingPortal,
  onOpenFixStrategy,
  onCheckout,
  onLogout,
}) {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedJob, setExpandedJob] = useState(null)
  const [showSimulation, setShowSimulation] = useState({})
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showModelModal, setShowModelModal] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)

  const usedCount = billing?.daily_used ?? 0
  const usedMax = 5
  const isPro = billing?.is_pro ?? false
  const remainingCount = isPro ? 'Unlimited' : Math.max(0, usedMax - usedCount)

  const hasJobs = jobs.length > 0

  const activeSummary = useMemo(() => {
    if (!jobs.length) return 'No active strategy yet'
    const active = jobs.find((job) => job.status !== 'completed' && job.status !== 'failed')
    return active ? `Latest active stage: ${active.status}` : 'No active strategy right now'
  }, [jobs])

  const handleGenerate = async (event) => {
    event.preventDefault()
    if (!prompt.trim()) return

    setSubmitting(true)
    const result = await onGeneratePrompt(prompt, prompt)
    setSubmitting(false)

    if (result.ok) {
      setPrompt('')
      return
    }

    if (result.reason === 'upgrade') {
      setShowUpgradeModal(true)
      return
    }

    if (result.reason === 'unauthorized') {
      return
    }

    alert(result.message || 'Something went wrong while submitting your strategy.')
  }

  const handleBilling = async () => {
    if (billing?.has_portal) {
      await onOpenBillingPortal()
    } else {
      setShowUpgradeModal(true)
    }
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    await onCheckout()
    setCheckoutLoading(false)
  }

  return (
    <div className="workspace-page">
      <DashboardTopNav
        username={username}
        isPro={isPro}
        usedCount={usedCount}
        usedMax={usedMax}
        onJumpToComposer={() => scrollToSection('workspace-composer')}
        onJumpToJobs={() => scrollToSection('workspace-jobs')}
        onOpenBilling={handleBilling}
        onOpenHelp={() => setShowHelpModal(true)}
        onLogout={onLogout}
      />

      <main className="workspace-shell">
        <div className="workspace-grid">
          <div className="workspace-main">
            <StrategyComposer
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleGenerate}
              loading={submitting}
              selectedModel={selectedModel}
              onOpenModelPicker={() => setShowModelModal(true)}
              onUseExample={setPrompt}
            />

            <div className="workspace-usage-strip">
              <div className="workspace-usage-strip__bar">
                <div className="workspace-usage-strip__fill" style={{ width: `${Math.min((usedCount / usedMax) * 100, 100)}%` }} />
              </div>
              <div className="workspace-usage-strip__copy">
                <span>{isPro ? 'Unlimited usage on your current plan' : `${remainingCount} generations remaining today`}</span>
                <button type="button" className="workspace-inline-link" onClick={handleBilling}>
                  {billing?.has_portal ? 'Billing' : 'Upgrade'}
                </button>
              </div>
            </div>

            {!hasJobs && <EmptyDashboardGuidance />}
          </div>

          <DashboardSideRail
            billing={billing}
            remainingCount={remainingCount}
            usedCount={usedCount}
            usedMax={usedMax}
            onOpenBilling={handleBilling}
            onOpenHelp={() => setShowHelpModal(true)}
          />
        </div>

        <JobsSection
          jobs={jobs}
          expandedJob={expandedJob}
          onToggleJob={(jobId) => setExpandedJob((current) => (current === jobId ? null : jobId))}
          showSimulation={showSimulation}
          onToggleSimulation={(jobId) =>
            setShowSimulation((current) => ({
              ...current,
              [jobId]: !current[jobId],
            }))
          }
          onFixStrategy={onOpenFixStrategy}
          token={token}
        />
      </main>

      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
      {showModelModal && (
        <ModelPickerModal
          selectedModel={selectedModel}
          onSelect={(option) => {
            setSelectedModel(option)
            setShowModelModal(false)
          }}
          onClose={() => setShowModelModal(false)}
        />
      )}
      {showUpgradeModal && (
        <UpgradeModal
          checkoutLoading={checkoutLoading}
          onClose={() => setShowUpgradeModal(false)}
          onCheckout={handleCheckout}
        />
      )}

      <div className="workspace-screenreader-note" aria-hidden="true">
        {activeSummary}
      </div>
    </div>
  )
}
