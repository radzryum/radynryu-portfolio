import Modal from './Modal'
import Button from './Button'

function ClientSubmissionConfirmation({
  open,
  onCancel,
  onConfirm,
  submitting = false,
  title = 'Confirm submission',
  confirmLabel = 'Yes, submit',
}) {
  if (!open) return null

  return (
    <Modal
      title={title}
      onClose={submitting ? undefined : onCancel}
      maxWidth="max-w-md"
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Review Again
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Submitting...' : confirmLabel}
          </Button>
        </div>
      )}
    >
      <div className="text-sm text-slate-700 dark:text-slate-300">
        <div className="font-semibold text-purple-900 dark:text-purple-200">Are you sure about the information you entered?</div>
      </div>
    </Modal>
  )
}

export default ClientSubmissionConfirmation
