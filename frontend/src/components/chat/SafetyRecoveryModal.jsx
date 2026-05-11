import StrategyEditor from '../../StrategyEditor'

export default function SafetyRecoveryModal({
  open,
  initialData,
  onClose,
  onSubmit,
}) {
  if (!open || !initialData) return null

  return (
    <div className="workspace-modal-overlay" onClick={onClose}>
      <div className="workspace-modal workspace-modal--wide" onClick={(event) => event.stopPropagation()}>
        <StrategyEditor
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={onClose}
          embedded
        />
      </div>
    </div>
  )
}

