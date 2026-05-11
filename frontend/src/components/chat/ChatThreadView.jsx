import RunStatusInline from './RunStatusInline'
import RunFailureCard from './RunFailureCard'

function ExamplePromptCards({ onUseExample }) {
  const examples = [
    'Buy XAUUSD when RSI(14) drops below 30 and close when RSI rises above 70. Use 0.01 lot size.',
    'Buy EURUSD when price crosses above the 50 EMA and risk 1% per trade with 1:2 reward ratio.',
    'Create a trend-following strategy for GBPUSD on H1 with stop loss, take profit, and max 3 trades per day.',
  ]

  return (
    <div className="chat-thread__examples">
      {examples.map((example) => (
        <button key={example} type="button" className="chat-thread__example" onClick={() => onUseExample(example)}>
          {example}
        </button>
      ))}
    </div>
  )
}

export default function ChatThreadView({
  thread,
  runsById,
  selectedRunId,
  runDetail,
  expandedRuns,
  onSelectRun,
  onToggleRunExpand,
  onUseExample,
  onOpenSafetyModal,
}) {
  if (!thread) {
    return (
      <section className="chat-thread empty">
        <div className="chat-thread__welcome">
          <span className="chat-thread__kicker">Chat workspace</span>
          <h1>Start a strategy conversation</h1>
          <p>
            Ask SmartTrade AI about one strategy topic in natural language. You can refine,
            retry, and inspect multiple runs inside the same conversation.
          </p>
          <ExamplePromptCards onUseExample={onUseExample} />
        </div>
      </section>
    )
  }

  if (!thread.messages?.length) {
    return (
      <section className="chat-thread empty">
        <div className="chat-thread__welcome">
          <span className="chat-thread__kicker">Conversation</span>
          <h1>{thread.title}</h1>
          <p>
            This chat is ready for strategy work. Send a prompt below or start from one of the
            suggested structures.
          </p>
          <ExamplePromptCards onUseExample={onUseExample} />
        </div>
      </section>
    )
  }

  return (
    <section className="chat-thread">
      {thread.messages.map((message) => {
        const run = message.linked_run_id ? runsById[message.linked_run_id] : null
        const isSelectedRun = run && run.id === selectedRunId
        const showFailure = isSelectedRun && runDetail?.status === 'failed'

        return (
          <article key={message.id} className={`chat-message ${message.role === 'user' ? 'user' : 'assistant'}`}>
            <div className="chat-message__bubble">
              <p>{message.content}</p>
            </div>

            {run && (
              <div className="chat-message__run">
                <RunStatusInline
                  run={run}
                  selected={isSelectedRun}
                  expanded={!!expandedRuns[run.id]}
                  onSelect={() => onSelectRun(run.id)}
                  onToggleExpand={() => onToggleRunExpand(run.id)}
                />
                {showFailure && <RunFailureCard runDetail={runDetail} onOpenSafetyModal={onOpenSafetyModal} />}
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
