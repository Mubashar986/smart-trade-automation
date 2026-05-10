export default function HelpModal({ onClose }) {
  return (
    <div className="workspace-modal-overlay" onClick={onClose}>
      <div className="workspace-modal workspace-modal--narrow" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-modal__header">
          <div>
            <span className="workspace-kicker">Help</span>
            <h2>How to write a better strategy prompt</h2>
          </div>
          <button type="button" className="workspace-modal__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="workspace-help-list">
          <div>
            <strong>Include market context</strong>
            <p>Mention the symbol and timeframe you want the strategy to operate on.</p>
          </div>
          <div>
            <strong>Describe entry and exit logic</strong>
            <p>Say what should trigger a trade, and what should close it.</p>
          </div>
          <div>
            <strong>Add risk expectations</strong>
            <p>Include lot size, stop loss, take profit, or daily limits when possible.</p>
          </div>
          <div>
            <strong>Do not worry about MQL5 syntax</strong>
            <p>Focus on strategy behavior. SmartTrade AI handles the structural transformation and pipeline visibility.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

