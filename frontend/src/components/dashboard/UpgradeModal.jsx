export default function UpgradeModal({ checkoutLoading, onClose, onCheckout }) {
  return (
    <div className="workspace-modal-overlay" onClick={onClose}>
      <div className="workspace-modal workspace-modal--narrow" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-modal__header">
          <div>
            <span className="workspace-kicker">Upgrade</span>
            <h2>Upgrade to Pro</h2>
          </div>
          <button type="button" className="workspace-modal__close" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="workspace-modal__body-copy">
          You have used all free generations for today. Upgrade when you need more strategy attempts and a smoother workflow.
        </p>

        <ul className="workspace-feature-list">
          <li>Unlimited script generations</li>
          <li>Priority compilation queue</li>
          <li>Full backtesting reports</li>
          <li>Advanced risk management features</li>
        </ul>

        <div className="workspace-modal__actions">
          <button type="button" className="workspace-secondary-action" onClick={onClose}>
            Maybe Later
          </button>
          <button type="button" className="workspace-primary-action" onClick={onCheckout} disabled={checkoutLoading}>
            {checkoutLoading ? 'Loading...' : 'Upgrade · $9.99 / mo'}
          </button>
        </div>
      </div>
    </div>
  )
}
