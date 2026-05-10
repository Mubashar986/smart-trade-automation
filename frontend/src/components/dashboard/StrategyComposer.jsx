import { ChevronDownIcon, IconChip, SparkIcon } from '../../BrandSystem'

const promptExamples = [
  'Buy XAUUSD when RSI(14) drops below 30 and close when RSI rises above 70. Use 0.01 lot size.',
  'Buy EURUSD when price crosses above the 50 EMA and risk 1% per trade with 1:2 reward ratio.',
  'Create a trend-following strategy for GBPUSD on H1 with stop loss, take profit, and max 3 trades per day.',
]

export default function StrategyComposer({
  prompt,
  onPromptChange,
  onSubmit,
  loading,
  selectedModel,
  onOpenModelPicker,
  onUseExample,
}) {
  return (
    <section className="composer-card" id="workspace-composer">
      <div className="composer-card__header">
        <div>
          <span className="workspace-kicker">Workspace</span>
          <h1>Generate Your Expert Advisor</h1>
          <p>
            Describe your trading strategy in plain English and SmartTrade AI will generate,
            validate, compile, and backtest MQL5 logic with clearer workflow visibility.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="composer-form">
        <div className="composer-toolbar">
          <button type="button" className="composer-model-trigger" onClick={onOpenModelPicker}>
            <SparkIcon />
            <span>{selectedModel.provider} · {selectedModel.model}</span>
            <ChevronDownIcon />
          </button>
          <span className="composer-mode-chip">{selectedModel.quality}</span>
        </div>

        <textarea
          className="composer-textarea"
          placeholder="e.g. Buy XAUUSD when RSI(14) drops below 30, close when RSI rises above 70. Use 0.01 lot size."
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={6}
          disabled={loading}
        />

        <div className="composer-footer">
          <div className="composer-footer__hints">
            <IconChip tone="teal">Natural Language to MQL5</IconChip>
            <IconChip tone="cyan">Validation-First Workflow</IconChip>
            <IconChip tone="blue">Transparent Pipeline States</IconChip>
          </div>
          <button type="submit" className="composer-submit" disabled={loading || !prompt.trim()}>
            {loading ? 'Submitting...' : 'Generate Strategy'}
          </button>
        </div>
      </form>

      <div className="composer-examples">
        <div className="composer-examples__header">
          <h2>Example prompts</h2>
          <p>Start with one of these examples and adapt it to your trading logic.</p>
        </div>
        <div className="composer-examples__grid">
          {promptExamples.map((example) => (
            <button
              key={example}
              type="button"
              className="composer-example-card"
              onClick={() => onUseExample(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

