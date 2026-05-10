import { CheckCircleIcon, EyeIcon, IconChip, ShieldIcon, WarningIcon } from '../../BrandSystem'

export default function DashboardSideRail({
  billing,
  remainingCount,
  usedCount,
  usedMax,
  onOpenBilling,
  onOpenHelp,
}) {
  const isPro = billing?.is_pro ?? false

  return (
    <aside className="workspace-rail">
      <section className="workspace-rail-card plan-card">
        <div className="workspace-rail-card__header">
          <span className="workspace-kicker">Plan</span>
          {isPro ? <span className="workspace-status-chip pro">PRO</span> : <span className="workspace-status-chip">{usedCount}/{usedMax} today</span>}
        </div>
        <h3>{isPro ? 'Unlimited strategy generation' : `${remainingCount} generations remaining today`}</h3>
        <p>
          {isPro
            ? 'Your account can continue generating strategies without the daily free-tier cap.'
            : 'Upgrade when you need more attempts, deeper workflow usage, and a smoother billing path.'}
        </p>
        <div className="workspace-rail-card__actions">
          <button type="button" className="workspace-secondary-action" onClick={onOpenBilling}>
            Billing
          </button>
          <button type="button" className="workspace-secondary-action" onClick={onOpenHelp}>
            Help
          </button>
        </div>
      </section>

      <section className="workspace-rail-card">
        <div className="workspace-rail-card__header">
          <span className="workspace-kicker">What Happens Next</span>
        </div>
        <div className="workspace-flow-list">
          <div>
            <span><CheckCircleIcon /></span>
            <div>
              <strong>Intent is parsed</strong>
              <p>Your prompt is translated into structured trading logic.</p>
            </div>
          </div>
          <div>
            <span><ShieldIcon /></span>
            <div>
              <strong>Validation runs</strong>
              <p>Safety rules and required parameters are checked before deeper execution.</p>
            </div>
          </div>
          <div>
            <span><EyeIcon /></span>
            <div>
              <strong>Pipeline becomes visible</strong>
              <p>You can follow generating, compiling, and recovery states in one place.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace-rail-card">
        <div className="workspace-rail-card__header">
          <span className="workspace-kicker">Quick Tips</span>
        </div>
        <div className="workspace-tip-list">
          <IconChip tone="teal">Mention symbol and timeframe</IconChip>
          <IconChip tone="cyan">Describe entry and exit rules</IconChip>
          <IconChip tone="blue">Include basic risk limits</IconChip>
        </div>
        <div className="workspace-rail-note">
          <WarningIcon />
          <p>If your strategy is unsafe or incomplete, SmartTrade AI can route you into guided recovery instead of failing silently.</p>
        </div>
      </section>
    </aside>
  )
}

