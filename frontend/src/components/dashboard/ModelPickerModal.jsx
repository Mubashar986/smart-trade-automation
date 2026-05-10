const options = [
  {
    provider: 'Google Gemini',
    model: 'Gemini 2.5 Flash',
    quality: 'Balanced',
    note: 'Good default for fast structured generation.',
  },
  {
    provider: 'Google Gemini',
    model: 'Gemini 2.5 Pro',
    quality: 'High quality',
    note: 'Stronger reasoning-oriented option for more complex prompts.',
  },
  {
    provider: 'Azure OpenAI',
    model: 'GPT-5.4 Mini',
    quality: 'Fast',
    note: 'Alternative provider direction for structured generation.',
  },
]

export default function ModelPickerModal({ selectedModel, onSelect, onClose }) {
  return (
    <div className="workspace-modal-overlay" onClick={onClose}>
      <div className="workspace-modal workspace-modal--narrow" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-modal__header">
          <div>
            <span className="workspace-kicker">Model Controls</span>
            <h2>Choose a model and provider</h2>
          </div>
          <button type="button" className="workspace-modal__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="model-picker-list">
          {options.map((option) => {
            const active = option.provider === selectedModel.provider && option.model === selectedModel.model
            return (
              <button
                key={`${option.provider}-${option.model}`}
                type="button"
                className={`model-picker-card ${active ? 'active' : ''}`}
                onClick={() => onSelect(option)}
              >
                <div className="model-picker-card__top">
                  <strong>{option.model}</strong>
                  <span>{option.quality}</span>
                </div>
                <p>{option.provider}</p>
                <small>{option.note}</small>
              </button>
            )
          })}
        </div>

        <p className="workspace-modal__note">
          This selection is currently a composer-side UI preview until backend model switching is added to the generation request.
        </p>
      </div>
    </div>
  )
}

