import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext, type ToastKind } from './ToastContext'
import './ToastProvider.css'

type ToastMessage = { id: number; kind: ToastKind; message: string }

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 5000)
    return () => window.clearTimeout(timeout)
  }, [onDismiss, toast.id])

  const role = toast.kind === 'error' ? 'alert' : 'status'
  const icon = toast.kind === 'error' ? 'error' : toast.kind === 'success' ? 'check_circle' : 'info'

  return <div aria-atomic="true" aria-live={toast.kind === 'error' ? 'assertive' : 'polite'} className={`app-toast app-toast--${toast.kind}`} role={role}>
    <span aria-hidden="true" className="material-symbols-rounded app-toast__icon">{icon}</span>
    <p>{toast.message}</p>
    <button aria-label="Fechar notificação" className="app-toast__close" onClick={() => onDismiss(toast.id)} type="button">
      <span aria-hidden="true" className="material-symbols-rounded">close</span>
    </button>
  </div>
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextId = useRef(0)
  const viewportRef = useRef<HTMLDialogElement>(null)

  const show = useCallback((kind: ToastKind, message: string) => {
    const normalizedMessage = message.trim()
    if (!normalizedMessage) return
    const toast = { id: ++nextId.current, kind, message: normalizedMessage }
    setToasts((current) => {
      if (current.some((toast) => toast.kind === kind && toast.message === normalizedMessage)) return current
      return [...current, toast].slice(-3)
    })
  }, [])
  const success = useCallback((message: string) => show('success', message), [show])
  const error = useCallback((message: string) => show('error', message), [show])
  const info = useCallback((message: string) => show('info', message), [show])
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (toasts.length > 0 && !viewport.open) viewport.show()
    else if (toasts.length === 0 && viewport.open) viewport.close()
  }, [toasts.length])

  const api = useMemo(() => ({ success, error, info }), [error, info, success])

  return <ToastContext.Provider value={api}>
    {children}
    {createPortal(<dialog aria-label="Notificações" className="app-toast-viewport" onCancel={(event) => event.preventDefault()} ref={viewportRef}>
      <div className="app-toast-viewport__list">
        {toasts.map((toast) => <ToastItem key={toast.id} onDismiss={dismiss} toast={toast} />)}
      </div>
    </dialog>, document.body)}
  </ToastContext.Provider>
}
