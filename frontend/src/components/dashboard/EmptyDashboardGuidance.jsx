export default function EmptyDashboardGuidance() {
  return (
    <section className="workspace-empty">
      <div className="workspace-empty__intro">
        <span className="workspace-kicker">Start Here</span>
        <h2>Create Your First Strategy</h2>
        <p>
          Describe your trading logic in plain English and SmartTrade AI will walk it through
          validation, safety checks, generation, and compilation.
        </p>
      </div>

      <div className="workspace-empty__grid">
        <article className="workspace-empty-card">
          <h3>What happens next</h3>
          <ol>
            <li>Intent is parsed into structured trading parameters.</li>
            <li>Safety and validation checks run before code generation.</li>
            <li>MQL5 workflow logic is generated and moved through compilation.</li>
          </ol>
        </article>

        <article className="workspace-empty-card">
          <h3>Why this helps</h3>
          <ul>
            <li>You stay focused on strategy logic instead of syntax details.</li>
            <li>Failures become recoverable through visible workflow and guided correction.</li>
            <li>Your recent attempts and results remain visible in one workspace.</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
