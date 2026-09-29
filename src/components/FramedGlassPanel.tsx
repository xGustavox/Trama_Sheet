import type { ReactNode } from 'react'
import { tintSvgDataUri } from '../lib/tintSvg'
import './FramedGlassPanel.css'

type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface FramedGlassPanelProps {
  children: ReactNode
  className?: string
  contentClassName?: string
  cornerSvg: string
  frameColor: string
}

const corners: CornerPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export function FramedGlassPanel({ children, className = '', contentClassName = '', cornerSvg, frameColor }: FramedGlassPanelProps) {
  const cornerStyle = { backgroundImage: `url("${tintSvgDataUri(cornerSvg, frameColor)}")` }

  return (
    <div className={`framed-glass-panel ${className}`.trim()}>
      <div aria-hidden="true" className="framed-glass-panel__glass" style={{ borderColor: frameColor }} />
      <div className={`framed-glass-panel__content ${contentClassName}`.trim()}>{children}</div>
      {corners.map((corner) => (
        <div
          aria-hidden="true"
          className={`framed-glass-panel__corner framed-glass-panel__corner--${corner}`}
          key={corner}
          style={cornerStyle}
        />
      ))}
    </div>
  )
}
