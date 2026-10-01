import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import './Modal.css'

type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  footer?: ReactNode | ((requestClose: () => void) => ReactNode)
  theme: 'light' | 'dark'
  onClose: () => void
  variant?: 'default' | 'wide' | 'crop' | 'drawer'
  showHeader?: boolean
  showCloseButton?: boolean
}

export function Modal({
  open,
  title,
  children,
  footer,
  theme,
  onClose,
  variant = 'default',
  showHeader = true,
  showCloseButton = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleId = useId()
  const [closing, setClosing] = useState(false)

  function requestClose() {
    if (!open || closing) return
    setClosing(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    closeTimerRef.current = setTimeout(() => {
      onClose()
      setClosing(false)
    }, reducedMotion ? 0 : 180)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
      if (!dialog.open) dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  return (
    <dialog
      aria-label={showHeader ? undefined : title}
      aria-labelledby={showHeader ? titleId : undefined}
      className={`app-modal app-modal--${variant}${closing ? ' app-modal--closing' : ''}`}
      data-theme={theme}
      onCancel={(event) => { event.preventDefault(); requestClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose() }}
      ref={dialogRef}
    >
      {showHeader && (
        <header className="app-modal__header">
          <h2 id={titleId}>{title}</h2>
          {showCloseButton && (
            <button aria-label="Fechar modal" className="app-modal__close" onClick={requestClose} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button>
          )}
        </header>
      )}
      <div className="app-modal__content">{children}</div>
      {footer && <footer className="app-modal__footer">{typeof footer === 'function' ? footer(requestClose) : footer}</footer>}
    </dialog>
  )
}
