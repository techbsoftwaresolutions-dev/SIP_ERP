import Modal from "./Modal";

export default function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
  confirming = false,
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ margin: "0 0 20px", color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.5 }}>{message}</p>
      <div className="add-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? "btn btn-danger" : "btn btn-primary"}
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirming ? "Deleting..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
