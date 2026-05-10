import { BrandLockup } from '../../BrandSystem'

export default function DashboardTopNav({
  username,
  isPro,
  usedCount,
  usedMax,
  onJumpToComposer,
  onJumpToJobs,
  onOpenBilling,
  onOpenHelp,
  onLogout,
}) {
  return (
    <nav className="workspace-topnav">
      <div className="workspace-topnav__inner">
        <div className="workspace-topnav__brand">
          <BrandLockup label="SmartTrade AI" />
        </div>

        <div className="workspace-topnav__center">
          <button type="button" className="workspace-topnav__link" onClick={onJumpToComposer}>
            Workspace
          </button>
          <button type="button" className="workspace-topnav__link" onClick={onJumpToJobs}>
            Algorithms
          </button>
        </div>

        <div className="workspace-topnav__actions">
          {isPro ? <span className="workspace-plan-badge pro">PRO</span> : <span className="workspace-plan-badge">{usedCount}/{usedMax} today</span>}
          <button type="button" className="workspace-topnav__ghost" onClick={onOpenBilling}>
            Billing
          </button>
          <button type="button" className="workspace-topnav__ghost" onClick={onOpenHelp}>
            Help
          </button>
          <span className="workspace-user">{username}</span>
          <button type="button" className="workspace-topnav__ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

