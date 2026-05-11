export default function ModelCatalogModal({
  open,
  catalog,
  selectedModel,
  onClose,
  onSelect,
}) {
  if (!open) return null

  const providers = catalog?.providers?.length
    ? catalog.providers
    : [
        {
          id: selectedModel.providerId || 'gemini',
          label: selectedModel.providerLabel || 'Google Gemini',
          models: [
            {
              id: selectedModel.modelId || 'gemini-2.5-flash',
              label: selectedModel.modelLabel || 'Gemini 2.5 Flash',
              quality_modes: ['balanced'],
            },
          ],
        },
      ]

  return (
    <div className="workspace-modal-overlay" onClick={onClose}>
      <div className="workspace-modal workspace-modal--narrow" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-modal__header">
          <div>
            <span className="workspace-kicker">Model picker</span>
            <h2>Choose a provider and model</h2>
          </div>
          <button type="button" className="workspace-modal__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="model-catalog">
          {providers.map((provider) => (
            <section key={provider.id} className="model-catalog__provider">
              <h3>{provider.label}</h3>
              <div className="model-catalog__models">
                {provider.models.map((model) => {
                  const active = selectedModel.providerId === provider.id && selectedModel.modelId === model.id
                  return (
                    <button
                      key={`${provider.id}-${model.id}`}
                      type="button"
                      className={`model-catalog__model ${active ? 'active' : ''}`}
                      onClick={() =>
                        onSelect({
                          providerId: provider.id,
                          providerLabel: provider.label,
                          modelId: model.id,
                          modelLabel: model.label,
                          qualityMode: 'balanced',
                        })
                      }
                    >
                      <strong>{model.label}</strong>
                      <small>Balanced</small>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="workspace-modal__note">Model choices come from backend-supported capabilities. Quality mode stays fixed to Balanced for now.</p>
      </div>
    </div>
  )
}

