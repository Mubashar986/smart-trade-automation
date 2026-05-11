import { ArrowUpIcon, ChevronDownIcon, PlusIcon, SparkIcon } from '../../BrandSystem'

export default function ChatComposer({
  prompt,
  onPromptChange,
  onSubmit,
  loading,
  modelLabel,
  onOpenModelPicker,
}) {
  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      <button type="button" className="chat-composer__add" aria-label="New strategy attachment placeholder">
        <PlusIcon />
      </button>

      <div className="chat-composer__main">
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe your strategy, ask follow-up questions, or refine the current approach..."
          rows={2}
          disabled={loading}
        />
        <div className="chat-composer__footer">
          <button type="button" className="chat-composer__model" onClick={onOpenModelPicker}>
            <SparkIcon />
            <span>{modelLabel}</span>
            <ChevronDownIcon />
          </button>
          <button type="submit" className="chat-composer__submit" disabled={loading || !prompt.trim()} aria-label={loading ? 'Sending strategy prompt' : 'Send strategy prompt'}>
            {loading ? '...' : <ArrowUpIcon />}
          </button>
        </div>
      </div>
    </form>
  )
}
