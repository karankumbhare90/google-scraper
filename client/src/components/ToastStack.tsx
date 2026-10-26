// ─── Toast Notification Stack ─────────────────────────────────────────────────
import { CheckCircle, XCircle, X } from 'lucide-react'
import type { Toast } from '../types'

interface ToastStackProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success'
            ? <CheckCircle size={15} color="var(--green)" />
            : <XCircle size={15} color="var(--red)" />
          }
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
