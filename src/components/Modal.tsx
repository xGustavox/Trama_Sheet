import { useEffect, useId, useRef, type ReactNode } from 'react'
import './Modal.css'

type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  footer?: ReactNode
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
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      aria-label={showHeader ? undefined : title}
      aria-labelledby={showHeader ? titleId : undefined}
      className={`app-modal app-modal--${variant}`}
      data-theme={theme}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      ref={dialogRef}
    >
      {showHeader && (
        <header className="app-modal__header">
          <h2 id={titleId}>{title}</h2>
          {showCloseButton && (
            <button aria-label="Fechar modal" className="app-modal__close" onClick={onClose} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button>
          )}
        </header>
      )}
      <div className="app-modal__content">{children}</div>
      {footer && <footer className="app-modal__footer">{footer}</footer>}
    </dialog>
  )
}
