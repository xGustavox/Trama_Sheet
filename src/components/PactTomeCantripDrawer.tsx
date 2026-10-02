import { useMemo, useState } from 'react'
import { cantripsByClass } from '../lib/spellCatalog'
import { getSpellDetails } from '../lib/spellDetails'
import { normalizePactTomeCantripName, pactTomeCantripCount } from '../lib/pactTome'
import { Button } from './Button'
import { Modal } from './Modal'
import './PactTomeCantripDrawer.css'

const spellcastingClasses = [
  ['bardo', 'Bardo'],
  ['bruxo', 'Bruxo'],
  ['clerigo', 'Clérigo'],
  ['druida', 'Druida'],
  ['feiticeiro', 'Feiticeiro'],
  ['mago', 'Mago'],
] as const

type Props = {
  open: boolean
  selectedCantrips: string[]
  knownCantrips: string[]
  theme: 'light' | 'dark'
  onClose: () => void
  onConfirm: (cantrips: string[]) => void
}

export function PactTomeCantripDrawer({ open, selectedCantrips, knownCantrips, theme, onClose, onConfirm }: Props) {
  const [classFilter, setClassFilter] = useState<string | null>(null)
  const [draft, setDraft] = useState<string[]>(() => [...new Set(selectedCantrips)].slice(0, pactTomeCantripCount))
  const [search, setSearch] = useState('')
  const allCantrips = useMemo(() => [...new Set(Object.values(cantripsByClass).flat())], [])
  const knownCantripNames = new Set(knownCantrips.map(normalizePactTomeCantripName))

  const availableCantrips = classFilter
    ? cantripsByClass[classFilter] ?? []
    : allCantrips
  const normalizedSearch = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filteredCantrips = availableCantrips.filter((name) =>
    !normalizedSearch || name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalizedSearch))

  return <Modal open={open} title="Truques do Livro das Sombras" theme={theme} variant="drawer" showHeader={false} onClose={onClose}>
    <div className="tome-cantrip-drawer">
      <header>
        <div><h2>Truques do Livro das Sombras</h2><p>Escolha três truques de listas de quaisquer classes. Eles não contam no limite de truques conhecidos do bruxo.</p></div>
        <button aria-label="Fechar painel" className="tome-cantrip-drawer__close" onClick={onClose} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button>
      </header>
      <p className="tome-cantrip-drawer__count" aria-live="polite">{draft.length} de {pactTomeCantripCount} truques escolhidos</p>
      <div aria-label="Filtrar truques por classe" className="tome-cantrip-drawer__filters" role="group">
        <button aria-pressed={classFilter === null} className={classFilter === null ? 'tome-cantrip-drawer__filter tome-cantrip-drawer__filter--active' : 'tome-cantrip-drawer__filter'} onClick={() => setClassFilter(null)} type="button">Todas</button>
        {spellcastingClasses.map(([id, label]) => <button aria-pressed={classFilter === id} className={classFilter === id ? 'tome-cantrip-drawer__filter tome-cantrip-drawer__filter--active' : 'tome-cantrip-drawer__filter'} key={id} onClick={() => setClassFilter(id)} type="button">{label}</button>)}
      </div>
      <label className="tome-cantrip-drawer__search">
        <span aria-hidden="true" className="material-symbols-rounded">search</span>
        <input aria-label="Pesquisar truques" onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar truques" type="search" value={search} />
      </label>
      <div aria-label="Truques disponíveis" className="tome-cantrip-drawer__options" role="group">
        {filteredCantrips.map((name) => {
          const selected = draft.includes(name)
          const alreadyKnown = knownCantripNames.has(normalizePactTomeCantripName(name))
          const details = getSpellDetails(name)
          const sourceClasses = spellcastingClasses.filter(([id]) => cantripsByClass[id]?.includes(name)).map(([, label]) => label)
          return <label className="tome-cantrip-drawer__option" key={name}>
            <input checked={selected} disabled={(alreadyKnown && !selected) || (!selected && draft.length >= pactTomeCantripCount)} onChange={() => setDraft((current) => selected
              ? current.filter((cantrip) => cantrip !== name)
              : current.length < pactTomeCantripCount ? [...current, name] : current)} type="checkbox" />
            <span className="tome-cantrip-drawer__spell"><strong>{name}</strong><small>Lista: {sourceClasses.join(', ')}</small>{details && <small>Conjuração: {details.castingTime} · Alcance: {details.range}</small>}</span>
          </label>
        })}
        {filteredCantrips.length === 0 && <p>{availableCantrips.length === 0 ? 'Nenhum truque disponível para esta classe.' : 'Nenhum truque encontrado.'}</p>}
      </div>
      <footer><Button onClick={onClose} type="button" variant="secondary">Cancelar</Button><Button disabled={draft.length !== pactTomeCantripCount} onClick={() => onConfirm(draft)} type="button">Confirmar seleção</Button></footer>
    </div>
  </Modal>
}
