import { useMemo, useState } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'
import './SpellSelectionDrawer.css'

export type SpellOption = { name: string; level: number }

export function SpellSelectionDrawer({
  open,
  title,
  description,
  options,
  selectedSpells,
  selectionCount,
  theme,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  options: SpellOption[]
  selectedSpells: string[]
  selectionCount: number
  theme: 'light' | 'dark'
  onClose: () => void
  onConfirm: (spells: string[]) => void
}) {
  const [draft, setDraft] = useState(selectedSpells)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<number | null>(null)
  const levels = useMemo(() => [...new Set(options.map(({ level }) => level))].sort((first, second) => first - second), [options])
  const normalizedSearch = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const filteredOptions = options.filter(({ name, level }) =>
    (levelFilter === null || level === levelFilter)
    && (!normalizedSearch || name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(normalizedSearch)))

  function toggleSpell(name: string) {
    setDraft((current) => current.includes(name)
      ? current.filter((spell) => spell !== name)
      : current.length < selectionCount ? [...current, name] : current)
  }

  return <Modal open={open} title={title} theme={theme} onClose={onClose} variant="drawer" footer={<>
    <Button onClick={onClose} variant="secondary">Cancelar</Button>
    <Button disabled={draft.length !== selectionCount} onClick={() => onConfirm(draft)}>Confirmar ({draft.length}/{selectionCount})</Button>
  </>}>
    <div className="spell-selection-drawer">
      <p>{description}</p>
      <label className="spell-selection-drawer__search">
        <span aria-hidden="true" className="material-symbols-rounded">search</span>
        <input aria-label="Pesquisar magias" onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar magias" type="search" value={search} />
      </label>
      <div aria-label="Filtrar por nível da magia" className="spell-selection-drawer__filters" role="group">
        <button aria-pressed={levelFilter === null} onClick={() => setLevelFilter(null)} type="button">Todos</button>
        {levels.map((level) => <button aria-pressed={levelFilter === level} key={level} onClick={() => setLevelFilter(level)} type="button">{level === 0 ? 'Truques' : `${level}º nível`}</button>)}
      </div>
      <div aria-label="Magias disponíveis" className="spell-selection-drawer__options">
        {filteredOptions.map(({ name, level }) => <label className="spell-selection-drawer__option" key={name}>
          <input checked={draft.includes(name)} disabled={!draft.includes(name) && draft.length >= selectionCount} onChange={() => toggleSpell(name)} type="checkbox" />
          <span><strong>{name}</strong><small>{level === 0 ? 'Truque' : `${level}º nível`}</small></span>
        </label>)}
        {filteredOptions.length === 0 && <p className="spell-selection-drawer__empty">Nenhuma magia encontrada.</p>}
      </div>
    </div>
  </Modal>
}
