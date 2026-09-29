import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addInventoryItem, addPack, equipmentDetails, formatPrice, normalizeEquipment, readInventory, reconcileEquipment, type EquipmentCatalog, type EquipmentItem, type Inventory, type InventoryEntry } from '../lib/equipment'
import { loadEquipmentCatalog } from '../lib/equipmentRepository'
import { startingEquipmentPlan, type EquipmentContext } from '../lib/startingEquipment'
import { Button } from './Button'
import './EquipmentEditor.css'

const categories: { id: EquipmentItem['category']; name: string; icon: string }[] = [
  { id: 'armor', name: 'Armaduras e escudos', icon: 'shield' },
  { id: 'weapons', name: 'Armas', icon: 'swords' },
  { id: 'tools', name: 'Ferramentas e kits', icon: 'handyman' },
  { id: 'instruments', name: 'Instrumentos', icon: 'music_note' },
  { id: 'gear', name: 'Equipamento de aventura e itens pessoais', icon: 'inventory_2' },
]

function ExpandableSearch({ label, value, onChange, open, onOpenChange }: {
  label: string
  value: string
  onChange: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return <div className={`equipment__search${open ? ' equipment__search--open' : ''}`} role="search">
    {open
      ? <>
        <span aria-hidden="true" className="material-symbols-rounded">search</span>
        <input autoFocus className="equipment__search-input" type="search" aria-label={label} placeholder={label} value={value} onChange={event => onChange(event.target.value)} />
        <Button variant="ghost" size="icon" type="button" aria-label={`Fechar ${label.toLowerCase()}`} onClick={() => { onChange(''); onOpenChange(false) }}><span aria-hidden="true" className="material-symbols-rounded">close</span></Button>
      </>
      : <Button variant="ghost" size="icon" type="button" aria-label={`Pesquisar ${label.toLowerCase()}`} onClick={() => onOpenChange(true)}><span aria-hidden="true" className="material-symbols-rounded">search</span></Button>}
  </div>
}

function EquipmentDisclosure({ name, lines, catalog, note }: {
  name: ReactNode
  lines: { itemId: string; quantity: number | null }[]
  catalog: EquipmentCatalog
  note?: string
}) {
  return <details className="equipment__kit">
    <summary><span>{name}</span><span aria-hidden="true" className="material-symbols-rounded">expand_more</span></summary>
    <ul>{lines.map((line, index) => <li key={`${line.itemId}-${index}`}>{line.quantity ?? '—'} × {catalog.items.find(item => item.id === line.itemId)?.name ?? line.itemId}</li>)}</ul>
    {note && <small>{note}</small>}
  </details>
}

function EquipmentFilters({ label, options, selected, onChange }: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const filterRef = useRef<HTMLDetailsElement>(null)
  const allSelected = selected.length === 0
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (filterRef.current?.open && !filterRef.current.contains(event.target as Node)) filterRef.current.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && filterRef.current?.open) filterRef.current.open = false
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])
  return <details className="equipment__filter-popover" ref={filterRef}>
    <summary className="equipment__filter-trigger"><span aria-hidden="true" className="material-symbols-rounded">filter_list</span>Filtrar</summary>
    <div className="equipment__filter-menu" aria-label={label}>
      {options.map(option => {
        const checked = allSelected ? option.id === 'all' : selected.includes(option.id)
        return <label className="equipment__filter-option" key={option.id}>
          <input type="checkbox" checked={checked} onChange={() => {
            if (option.id === 'all') onChange([])
            else onChange(checked ? selected.filter(id => id !== option.id) : [...selected, option.id])
          }} />
          <span>{option.label}</span>
        </label>
      })}
    </div>
  </details>
}

function toggleDisclosureRow(event: ReactMouseEvent<HTMLTableRowElement>) {
  const target = event.target
  if (!(target instanceof Element) || target.closest('button, input, summary, details, a')) return
  const disclosure = event.currentTarget.querySelector<HTMLDetailsElement>('.equipment__kit')
  if (disclosure) disclosure.open = !disclosure.open
}

function sortInventoryEntries(entries: InventoryEntry[], catalog: EquipmentCatalog) {
  const rank = (entry: InventoryEntry) => {
    const category = catalog.items.find(item => item.id === entry.itemId)?.category
    if (category === 'weapons') return 0
    if (category === 'armor') return 1
    if (category === 'instruments') return 2
    return 3
  }
  return [...entries].sort((first, second) => rank(first) - rank(second))
}

export function EquipmentEditor({ value, onChange, onRequestInitialEquipmentReset, context, heading, children }: {
  value: string
  onChange: (value: string) => void
  onRequestInitialEquipmentReset?: (change: () => void) => void
  context: EquipmentContext
  heading: ReactNode
  children: ReactNode
}) {
  const [catalog, setCatalog] = useState<EquipmentCatalog | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [catalogSearch, setCatalogSearch] = useState<Record<string, string>>({})
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [inventorySearchOpen, setInventorySearchOpen] = useState(false)
  const [catalogSearchOpen, setCatalogSearchOpen] = useState<Record<string, boolean>>({})
  const [addingItem, setAddingItem] = useState<EquipmentItem | null>(null)
  const [drawerPick, setDrawerPick] = useState<{ groupKey: string; optionId: string; pickId: string } | null>(null)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [editingNotesDraft, setEditingNotesDraft] = useState('')
  const [addQuantity, setAddQuantity] = useState('1')
  const [itemNotes, setItemNotes] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState<string[]>([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryPage, setInventoryPage] = useState(1)
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const toastCounter = useRef(0)
  const inventoryRef = useRef<Inventory>(readInventory(value))
  const quantityHoldTimeout = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const quantityHoldInterval = useRef<ReturnType<typeof window.setInterval> | null>(null)
  const quantityHoldTriggered = useRef(false)
  const modalRef = useRef<HTMLDialogElement>(null)
  const inventory = useMemo(() => readInventory(value, catalog ?? undefined), [value, catalog])
  const plan = catalog ? startingEquipmentPlan(catalog, context, inventory) : null
  const ready = Boolean(context.className && context.backgroundName)
  const initialEquipmentReady = Boolean(ready && plan && plan.missing.length === 0)
  const startingEquipmentComplete = Boolean(inventory.initialEquipmentConfirmed && initialEquipmentReady)
  const nextValue = catalog && plan && ready ? JSON.stringify(reconcileEquipment(inventory, plan.grants, catalog)) : value

  useEffect(() => {
    inventoryRef.current = inventory
  }, [inventory])

  useEffect(() => {
    let active = true
    loadEquipmentCatalog().then(data => { if (active) { setCatalog(data); setError('') } }).catch(() => {
      if (active) setError('Não foi possível carregar o catálogo. Confira a conexão e se a migração de equipamentos foi aplicada ao banco.')
    })
    return () => { active = false }
  }, [attempt])

  useEffect(() => {
    if (nextValue !== value) onChange(nextValue)
  }, [nextValue, value, onChange])

  useEffect(() => {
    const dialog = modalRef.current
    if ((addingItem || drawerPick || editingNotesId) && dialog && !dialog.open) dialog.showModal()
    else if (!addingItem && !drawerPick && !editingNotesId && dialog?.open) dialog.close()
  }, [addingItem, drawerPick, editingNotesId])

  useEffect(() => () => {
    if (quantityHoldTimeout.current !== null) window.clearTimeout(quantityHoldTimeout.current)
    if (quantityHoldInterval.current !== null) window.clearInterval(quantityHoldInterval.current)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const change = (next: Inventory) => {
    inventoryRef.current = next
    onChange(JSON.stringify(next))
  }
  const showToast = (message: string) => setToast({ message, id: ++toastCounter.current })
  const updateEntry = (id: string, patch: Partial<InventoryEntry>) => {
    const current = inventoryRef.current
    change({ ...current, entries: current.entries.map(entry => entry.id === id ? { ...entry, ...patch } : entry) })
  }
  const adjustQuantity = (id: string, amount: number) => {
    const current = inventoryRef.current
    const entry = current.entries.find(candidate => candidate.id === id)
    if (!entry) return
    const quantity = Math.max(1, entry.quantity + amount)
    const maxUses = catalog?.items.find(item => item.id === entry.itemId)?.maxUses
    updateEntry(id, { quantity, ...(maxUses ? { remainingUses: Math.min(entry.remainingUses ?? entry.quantity * maxUses, quantity * maxUses) } : {}) })
  }
  const stopQuantityHold = () => {
    if (quantityHoldTimeout.current !== null) window.clearTimeout(quantityHoldTimeout.current)
    if (quantityHoldInterval.current !== null) window.clearInterval(quantityHoldInterval.current)
    quantityHoldTimeout.current = null
    quantityHoldInterval.current = null
  }
  const startQuantityHold = (id: string, direction: -1 | 1, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    stopQuantityHold()
    quantityHoldTriggered.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    quantityHoldTimeout.current = window.setTimeout(() => {
      quantityHoldTriggered.current = true
      quantityHoldInterval.current = window.setInterval(() => adjustQuantity(id, direction * 5), 140)
    }, 400)
  }
  const remove = (id: string) => {
    const current = inventoryRef.current
    change({ ...current, entries: current.entries.filter(entry => entry.id !== id) })
  }
  const chooseOption = (groupKey: string, optionId: string, picks: { id: string }[]) => {
    if (picks.length) {
      const selectedPick = picks.find(pick => !inventory.choices[`${groupKey}/${optionId}/${pick.id}`]) ?? picks[0]
      setDrawerPick({ groupKey, optionId, pickId: selectedPick.id })
      return
    }
    const choices = { ...inventory.choices }
    for (const key of Object.keys(choices)) if (key.startsWith(`${groupKey}/`)) delete choices[key]
    choices[groupKey] = optionId
    const applyChoice = () => change({ ...inventory, choices, initialEquipmentConfirmed: false })
    if (inventory.initialEquipmentConfirmed && onRequestInitialEquipmentReset) onRequestInitialEquipmentReset(applyChoice)
    else applyChoice()
  }
  const drawerOption = drawerPick && plan?.choices.find(group => group.key === drawerPick.groupKey)?.options.find(option => option.id === drawerPick.optionId)
  const drawerSelection = drawerOption?.picks.find(pick => pick.id === drawerPick?.pickId)
  const editingNotesEntry = editingNotesId ? inventory.entries.find(entry => entry.id === editingNotesId) : undefined
  const weight = inventory.entries.reduce((sum, entry) => sum + (catalog?.items.find(item => item.id === entry.itemId)?.weightKg ?? 0) * entry.quantity, 0)
  const hasUnknownWeight = inventory.entries.some(entry => catalog?.items.find(item => item.id === entry.itemId)?.weightKg == null)
  const inventoryFilters = [
    { id: 'all', label: 'Todos' }, { id: 'weapons', label: 'Armas' }, { id: 'tools', label: 'Ferramentas' },
    { id: 'armor', label: 'Armaduras' }, { id: 'packs', label: 'Pacotes' }, { id: 'kits', label: 'Kits' },
  ]
  const filteredInventory = useMemo(() => {
    const search = normalizeEquipment(inventorySearch)
    const matches = inventory.entries.filter(entry => {
      const item = catalog?.items.find(candidate => candidate.id === entry.itemId)
      const isPack = entry.source.startsWith('pack:') || entry.source.endsWith(':pack')
      const isKit = Boolean(item?.components?.length || normalizeEquipment(item?.subcategory ?? '').includes('kit'))
      const matchesFilter = inventoryFilter.length === 0
        || inventoryFilter.includes('packs') && isPack
        || inventoryFilter.includes('kits') && isKit
        || inventoryFilter.includes('weapons') && item?.category === 'weapons'
        || inventoryFilter.includes('armor') && item?.category === 'armor'
        || inventoryFilter.includes('tools') && (item?.category === 'tools' || item?.category === 'instruments') && !isKit
      const matchesSearch = normalizeEquipment([entry.name, entry.notes, item?.subcategory ?? '', ...(item?.properties ?? [])].join(' ')).includes(search)
      return matchesFilter && matchesSearch
    })
    return catalog ? sortInventoryEntries(matches, catalog) : matches
  }, [catalog, inventory.entries, inventoryFilter, inventorySearch])
  const inventoryPageCount = Math.max(1, Math.ceil(filteredInventory.length / 10))
  const currentInventoryPage = Math.min(inventoryPage, inventoryPageCount)
  const visibleInventory = filteredInventory.slice((currentInventoryPage - 1) * 10, currentInventoryPage * 10)

  const startingEntries = plan && catalog
    ? sortInventoryEntries(reconcileEquipment(inventory, plan.grants, catalog).entries.filter(entry => plan.grants.some(grant => grant.key === entry.source)), catalog)
    : []

  const startingEquipmentSection = <section className="wizard__equipment-card" aria-labelledby="starting-equipment-title">
    <h2 id="starting-equipment-title">Defina seu equipamento inicial</h2>
    <p>Escolha uma alternativa em cada linha para montar seu inventário inicial.</p>
    {error && <p role="alert">{error} <Button variant="secondary" size="small" type="button" onClick={() => setAttempt(attempt + 1)}>Tentar novamente</Button></p>}
    {!catalog && !error && <p role="status">Carregando catálogo…</p>}
    {catalog && !ready && <p>Selecione classe e antecedente para definir o equipamento inicial.</p>}
    {ready && plan && <>
      <div className="equipment__choices">{plan.choices.map(group => <fieldset className="equipment__choice-group" key={group.key}>
        <div className="equipment__choice-options" role="group" aria-label={group.label}>
          {group.options.map((option, index) => {
            const selected = group.options.length === 1 || inventory.choices[group.key] === option.id
            const describeItem = (line: { itemId: string; quantity: number | null }) => {
              const item = catalog!.items.find(candidate => candidate.id === line.itemId)
              const matchesTitle = option.items.length === 1 && normalizeEquipment(option.label) === normalizeEquipment(item?.name ?? '')
              if (matchesTitle && item) return item.weapon || item.armor ? equipmentDetails(item) : item.description || item.subcategory
              return `${line.quantity} × ${item?.name ?? line.itemId}`
            }
            return <Fragment key={option.id}>
              {index > 0 && <span className="equipment__choice-or" aria-hidden="true">ou</span>}
              <div className={`equipment__choice-option${selected ? ' equipment__choice-option--selected' : ''}`}>
                {!selected && <Button className="equipment__choice-button" variant="ghost" type="button" onClick={() => chooseOption(group.key, option.id, option.picks)}>
                  <span aria-hidden="true" className="equipment__choice-radio" />
                  <span className="equipment__choice-label"><strong>{option.label}</strong>{!!option.items.length && <small>{option.items.map(describeItem).join(' · ')}</small>}</span>
                </Button>}
                {selected && option.picks.length === 0 && <div className="equipment__choice-fixed">
                  <span aria-hidden="true" className="equipment__choice-radio equipment__choice-radio--checked" />
                  <strong>{option.label}</strong>
                  {!!option.items.length && <small>{option.items.map(describeItem).join(' · ')}</small>}
                </div>}
                {selected && option.picks.map(pick => {
                  const selectedId = inventory.choices[`${group.key}/${option.id}/${pick.id}`]
                  const selectedItem = catalog?.items.find(item => item.id === selectedId)
                  const details = selectedItem && (selectedItem.weapon || selectedItem.armor
                    ? equipmentDetails(selectedItem)
                    : selectedItem.description || selectedItem.subcategory)
                  const weaponProperties = selectedItem?.properties.join(', ')
                  return selectedItem
                    ? <div className="equipment__pick-summary" key={pick.id}>
                      <span aria-hidden="true" className="equipment__choice-radio equipment__choice-radio--checked" />
                      <span className="equipment__pick-summary-text"><strong>{selectedItem.name}</strong>{details && <small>{selectedItem.weapon
                        ? <><strong>{selectedItem.weapon.damage} {selectedItem.weapon.damageType}</strong>{weaponProperties ? ` · ${weaponProperties}` : ''}</>
                        : details}</small>}</span>
                      <Button className="equipment__edit-button" variant="ghost" size="icon" type="button" aria-label={`Editar ${pick.label}: ${selectedItem.name}`} onClick={() => setDrawerPick({ groupKey: group.key, optionId: option.id, pickId: pick.id })}><span aria-hidden="true" className="material-symbols-rounded">edit</span></Button>
                    </div>
                    : <Button className="equipment__pick-button" variant="secondary" size="small" type="button" key={pick.id} onClick={() => setDrawerPick({ groupKey: group.key, optionId: option.id, pickId: pick.id })}>
                      <span aria-hidden="true" className="equipment__choice-radio" />
                      <span className="equipment__pick-label">Escolher {pick.label}</span>
                      <span aria-hidden="true" className="material-symbols-rounded">chevron_right</span>
                    </Button>
                })}
              </div>
            </Fragment>
          })}
        </div>
      </fieldset>)}</div>
      {plan.missing.length > 0 && <p aria-live="polite">Faltam {plan.missing.length} escolhas para completar o equipamento inicial.</p>}
      {children}
      <Button id="equipment-confirm-button" className="equipment__confirm-button" type="button" disabled={!initialEquipmentReady} onClick={() => change({ ...inventory, initialEquipmentConfirmed: true })}>Confirmar equipamento inicial</Button>
      {startingEntries.length > 0 && <div className="equipment__starting-list">
        <h3>Inventário</h3>
        <div className="wizard__barbarian-table-wrap"><table className="wizard__barbarian-table equipment__table equipment__starting-table">
          <thead><tr><th scope="col">Item</th><th scope="col">Quantidade</th></tr></thead>
          <tbody>{startingEntries.map(entry => {
            const item = catalog!.items.find(candidate => candidate.id === entry.itemId)
            return <tr key={entry.id} onClick={toggleDisclosureRow}>
              <th scope="row">{item?.components?.length
                ? <EquipmentDisclosure name={<span className="equipment__inventory-item"><span aria-hidden="true" className="material-symbols-rounded equipment__item-icon">{categories.find(category => category.id === item.category)?.icon}</span>{entry.name}</span>} lines={item.components} catalog={catalog!} note="Componentes inclusos no kit; não somam peso novamente." />
                : <span className="equipment__inventory-item">{item && <span aria-hidden="true" className="material-symbols-rounded equipment__item-icon">{categories.find(category => category.id === item.category)?.icon}</span>}{entry.name}</span>}</th><td>{entry.quantity}</td>
            </tr>
          })}</tbody>
        </table></div>
      </div>}
    </>}
  </section>

  return <div className="wizard__equipment-step">
    {heading}
    {!startingEquipmentComplete && startingEquipmentSection}
    {startingEquipmentComplete && <>
    <section className="wizard__equipment-card" aria-labelledby="inventory-title">
      <div className="wizard__equipment-title"><span aria-hidden="true" className="material-symbols-rounded">backpack</span><h2 id="inventory-title">Inventário</h2></div>
      <p className="equipment__weight">Peso conhecido: <strong>{weight.toLocaleString('pt-BR')} kg</strong>{hasUnknownWeight && ' + itens sem peso informado'}.</p>
      <div className="equipment__inventory-controls">
        <EquipmentFilters label="inventário" options={[{ id: 'all', label: 'Todos' }, ...inventoryFilters.filter(filter => filter.id !== 'all')]} selected={inventoryFilter} onChange={selected => { setInventoryFilter(selected); setInventoryPage(1) }} />
        <ExpandableSearch label="Buscar no inventário" value={inventorySearch} onChange={value => { setInventorySearch(value); setInventoryPage(1) }} open={inventorySearchOpen} onOpenChange={setInventorySearchOpen} />
      </div>
      {visibleInventory.length ? <div className="wizard__barbarian-table-wrap" tabIndex={0} role="region" aria-label="Tabela do inventário">
        <table className="wizard__barbarian-table equipment__table equipment__inventory-table equipment__remove-column-table">
          <thead><tr><th scope="col">Item</th><th scope="col">Quantidade</th><th scope="col">Anotações</th><th aria-label="Remover" scope="col" title="Remover">−</th></tr></thead>
          <tbody>{visibleInventory.map(entry => { const item = catalog?.items.find(candidate => candidate.id === entry.itemId); return <tr key={entry.id} onClick={toggleDisclosureRow}>
            <th scope="row">{item?.components?.length
              ? <EquipmentDisclosure name={<span className="equipment__inventory-item"><span aria-hidden="true" className="material-symbols-rounded equipment__item-icon">{categories.find(category => category.id === item.category)?.icon}</span>{entry.name}</span>} lines={item.components} catalog={catalog!} note="Componentes inclusos no kit; não somam peso novamente." />
              : <span className="equipment__inventory-item">{item && <span aria-hidden="true" className="material-symbols-rounded equipment__item-icon">{categories.find(category => category.id === item.category)?.icon}</span>}{entry.name}</span>}</th>
            <td><div className="equipment__quantity-control" role="group" aria-label={`Quantidade de ${entry.name}`}>
              <Button className="equipment__quantity-step" variant="ghost" size="icon" type="button" disabled={entry.quantity <= 1} aria-label={`Diminuir quantidade de ${entry.name}`} onPointerDown={event => startQuantityHold(entry.id, -1, event)} onPointerUp={stopQuantityHold} onPointerCancel={() => { stopQuantityHold(); quantityHoldTriggered.current = false }} onClick={() => {
                if (quantityHoldTriggered.current) { quantityHoldTriggered.current = false; return }
                adjustQuantity(entry.id, -1)
              }}><span aria-hidden="true" className="material-symbols-rounded">chevron_left</span></Button>
              <output aria-live="polite">{entry.quantity}</output>
              <Button className="equipment__quantity-step" variant="ghost" size="icon" type="button" aria-label={`Aumentar quantidade de ${entry.name}`} onPointerDown={event => startQuantityHold(entry.id, 1, event)} onPointerUp={stopQuantityHold} onPointerCancel={() => { stopQuantityHold(); quantityHoldTriggered.current = false }} onClick={() => {
                if (quantityHoldTriggered.current) { quantityHoldTriggered.current = false; return }
                adjustQuantity(entry.id, 1)
              }}><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></Button>
            </div></td>
            <td><div className="equipment__notes-cell"><span>{entry.notes || '—'}</span><Button className="equipment__notes-edit" variant="ghost" size="small" type="button" aria-label={`Editar anotações de ${entry.name}`} onClick={() => { setEditingNotesDraft(entry.notes); setEditingNotesId(entry.id) }}>Editar</Button></div>
              {entry.remainingUses !== undefined && <label>Usos restantes<input aria-label={`Usos restantes de ${entry.name}`} type="number" min="0" max={entry.quantity * (catalog?.items.find(item => item.id === entry.itemId)?.maxUses ?? 10)} step="1" value={entry.remainingUses} onChange={event => {
                const uses = Number(event.target.value)
                const max = entry.quantity * (catalog?.items.find(item => item.id === entry.itemId)?.maxUses ?? 10)
                if (Number.isSafeInteger(uses) && uses >= 0 && uses <= max) updateEntry(entry.id, { remainingUses: uses })
              }} /></label>}
            </td>
            <td><Button className="equipment__toggle" variant="ghost" size="icon" type="button" aria-label={`Remover ${entry.name}`} onClick={() => remove(entry.id)}><span aria-hidden="true" className="material-symbols-rounded">remove_circle</span></Button></td>
          </tr>})}</tbody>
        </table>
      </div> : <p>{filteredInventory.length ? 'Nenhum item nesta página.' : 'Nenhum item encontrado com este filtro.'}</p>}
      {filteredInventory.length > 10 && <nav className="equipment__pagination" aria-label="Paginação do inventário">
        <Button variant="secondary" size="small" type="button" disabled={currentInventoryPage === 1} onClick={() => setInventoryPage(currentInventoryPage - 1)}>Anterior</Button>
        <span>Página {currentInventoryPage} de {inventoryPageCount}</span>
        <Button variant="secondary" size="small" type="button" disabled={currentInventoryPage === inventoryPageCount} onClick={() => setInventoryPage(currentInventoryPage + 1)}>Próxima</Button>
      </nav>}
    </section>

    </>}
    {startingEquipmentComplete && catalog && <>
      <section className="wizard__equipment-card" aria-labelledby="equipment-packs-title">
        <h2 id="equipment-packs-title">Pacotes de equipamento</h2>
        <div className="wizard__barbarian-table-wrap"><table className="wizard__barbarian-table equipment__table equipment__add-column-table">
          <thead><tr><th scope="col">Pacote</th><th scope="col">Custo</th><th aria-label="Adicionar" scope="col" title="Adicionar">+</th></tr></thead>
          <tbody>{catalog.packs.map(pack => {
            return <tr key={pack.id} onClick={toggleDisclosureRow}><th scope="row"><EquipmentDisclosure name={pack.name} lines={pack.items} catalog={catalog} /></th><td>{formatPrice(pack.priceCp)}</td>
              <td><Button className="equipment__toggle" variant="ghost" size="icon" type="button" aria-label={`Adicionar ${pack.name}`} onClick={() => { change(addPack(inventory, catalog, pack.id)); showToast(`${pack.name} adicionado ao inventário.`) }}><span aria-hidden="true" className="material-symbols-rounded">add_circle</span></Button></td></tr>
          })}</tbody>
        </table></div>
      </section>
      {categories.map(category => {
        const categoryItems = catalog.items.filter(item => item.category === category.id)
        const subcategories = [...new Set(categoryItems.map(item => item.subcategory))]
        const selectedFilters = filters[category.id] ?? []
        const items = categoryItems.filter(item => (!selectedFilters.length || selectedFilters.includes(item.subcategory)) && normalizeEquipment([item.name, ...item.aliases, item.subcategory, ...item.properties].join(' ')).includes(normalizeEquipment(catalogSearch[category.id] ?? '')))
        return <section className="wizard__equipment-card" key={category.id} aria-labelledby={`equipment-${category.id}-title`}>
          <div className="wizard__equipment-title"><span aria-hidden="true" className="material-symbols-rounded">{category.icon}</span><h2 id={`equipment-${category.id}-title`}>{category.name}</h2></div>
          {['weapons', 'tools', 'gear'].includes(category.id) && <div className="equipment__catalog-controls">
            {subcategories.length > 1 && <EquipmentFilters
              label={category.name}
              options={[{ id: 'all', label: 'Todos' }, ...subcategories.map(name => ({ id: name, label: name }))]}
              selected={selectedFilters}
              onChange={selected => setFilters({ ...filters, [category.id]: selected })}
            />}
            <ExpandableSearch label={`Pesquisar em ${category.name}`} value={catalogSearch[category.id] ?? ''} onChange={value => setCatalogSearch({ ...catalogSearch, [category.id]: value })} open={Boolean(catalogSearchOpen[category.id])} onOpenChange={open => setCatalogSearchOpen({ ...catalogSearchOpen, [category.id]: open })} />
          </div>}
          <p className="equipment__scroll-hint">Deslize a tabela para ver todas as colunas.</p>
          <div className="wizard__barbarian-table-wrap" role="region" tabIndex={0} aria-label={`Tabela de ${category.name.toLowerCase()}`}><table className="wizard__barbarian-table equipment__table equipment__catalog-table equipment__add-column-table">
            <thead><tr><th scope="col">Item</th><th scope="col">Custo</th><th scope="col">Peso</th><th scope="col">{category.id === 'armor' ? 'CA / requisitos' : category.id === 'weapons' ? 'Dano / propriedades' : 'Unidade / propriedades'}</th><th aria-label="Adicionar" scope="col" title="Adicionar">+</th></tr></thead>
            <tbody>{items.map(item => <tr key={item.id} onClick={toggleDisclosureRow}><th scope="row" title={item.description}>{item.components?.length
              ? <EquipmentDisclosure name={<span>{item.name}<small>{item.subcategory}</small></span>} lines={item.components} catalog={catalog} note="Componentes inclusos no kit; não somam peso novamente." />
              : <>{item.name}<small>{item.subcategory}</small></>}</th><td>{formatPrice(item.priceCp)}</td><td>{item.weightKg === null ? '—' : `${item.weightKg.toLocaleString('pt-BR')} kg`}</td><td>{item.weapon
                ? <><strong>{item.weapon.damage} {item.weapon.damageType}</strong>{item.properties.length ? ` · ${item.properties.join(', ')}` : ''}</>
                : equipmentDetails(item)}</td><td><Button className="equipment__toggle" variant="ghost" size="icon" type="button" aria-label={`Adicionar ${item.name}`} onClick={() => { setAddingItem(item); setAddQuantity('1'); setItemNotes('') }}><span aria-hidden="true" className="material-symbols-rounded">add_circle</span></Button></td></tr>)}{!items.length && <tr><td colSpan={5}>Nenhum equipamento encontrado.</td></tr>}</tbody>
          </table></div>
        </section>
      })}
    </>}
    <dialog ref={modalRef} className={drawerPick ? 'equipment__drawer' : editingNotesId ? 'equipment__notes-dialog' : 'equipment__add-dialog'} aria-labelledby={drawerPick ? 'equipment-drawer-title' : editingNotesId ? 'equipment-notes-title' : 'equipment-add-title'} onClick={event => { if (event.target === event.currentTarget) { setAddingItem(null); setDrawerPick(null); setEditingNotesId(null) } }} onCancel={event => { event.preventDefault(); setAddingItem(null); setDrawerPick(null); setEditingNotesId(null) }}>
      {drawerPick && drawerSelection && catalog && <div className="equipment__drawer-content">
        <header><div><h2 id="equipment-drawer-title">Escolher {drawerSelection.label}</h2></div><Button variant="ghost" size="icon" type="button" aria-label="Fechar painel" onClick={() => setDrawerPick(null)}><span aria-hidden="true" className="material-symbols-rounded">close</span></Button></header>
        <div className="equipment__drawer-items">{drawerSelection.itemIds.map(itemId => {
          const item = catalog.items.find(candidate => candidate.id === itemId)
          if (!item) return null
          const key = `${drawerPick.groupKey}/${drawerPick.optionId}/${drawerPick.pickId}`
          const selected = inventory.choices[key] === itemId
          return <Button className="equipment__drawer-item" variant="ghost" type="button" key={itemId} aria-pressed={selected} onClick={() => {
            const choices = { ...inventory.choices }
            if (choices[drawerPick.groupKey] !== drawerPick.optionId) {
              for (const choiceKey of Object.keys(choices)) if (choiceKey.startsWith(`${drawerPick.groupKey}/`)) delete choices[choiceKey]
              choices[drawerPick.groupKey] = drawerPick.optionId
            }
            choices[key] = itemId
            const applyChoice = () => {
              change({ ...inventory, choices, initialEquipmentConfirmed: false })
              setDrawerPick(null)
            }
            if (inventory.initialEquipmentConfirmed && onRequestInitialEquipmentReset) onRequestInitialEquipmentReset(applyChoice)
            else applyChoice()
          }}>
            <span><strong>{item.name}</strong><small>{item.subcategory}{item.weapon ? <> · <strong>{item.weapon.damage} {item.weapon.damageType}</strong>{item.properties.length ? ` · ${item.properties.join(', ')}` : ''}</> : ''}</small></span>
            <span aria-hidden="true" className="material-symbols-rounded">{selected ? 'check_circle' : 'chevron_right'}</span>
          </Button>
        })}</div>
      </div>}
      {editingNotesEntry && !addingItem && !drawerPick && <form className="equipment__notes-form" onSubmit={event => {
        event.preventDefault()
        updateEntry(editingNotesEntry.id, { notes: editingNotesDraft })
        setEditingNotesId(null)
      }}>
        <h2 id="equipment-notes-title">Editar anotações</h2>
        <p>{editingNotesEntry.name}</p>
        <label className="wizard__field"><span>Anotações</span><textarea autoFocus aria-label={`Anotações de ${editingNotesEntry.name}`} value={editingNotesDraft} onChange={event => setEditingNotesDraft(event.target.value)} /></label>
        <div className="equipment__dialog-actions"><Button variant="secondary" type="button" onClick={() => setEditingNotesId(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>}
      {addingItem && !drawerPick && <form onSubmit={event => {
        event.preventDefault()
        const quantity = Number(addQuantity)
        if (!Number.isSafeInteger(quantity) || quantity < 1) return
        const next = addInventoryItem(inventory, addingItem, quantity, `manual:${crypto.randomUUID()}`)
        const added = next.entries.at(-1)!
        change({ ...next, entries: next.entries.map(entry => entry.id === added.id ? { ...entry, notes: itemNotes } : entry) })
        showToast(`${quantity} × ${addingItem.name} adicionado ao inventário.`)
        setAddingItem(null)
      }}>
        <h2 id="equipment-add-title">Adicionar {addingItem.name}</h2>
        <label className="wizard__field"><span>Quantidade</span><input autoFocus aria-label="Quantidade a adicionar" type="number" min="1" step="1" value={addQuantity} onChange={event => setAddQuantity(event.target.value)} /></label>
        <label className="wizard__field"><span>Anotações</span><textarea aria-label="Anotações do item" value={itemNotes} onChange={event => setItemNotes(event.target.value)} /></label>
        <div className="equipment__dialog-actions"><Button variant="secondary" type="button" onClick={() => setAddingItem(null)}>Cancelar</Button><Button type="submit" disabled={!Number.isSafeInteger(Number(addQuantity)) || Number(addQuantity) < 1}>Adicionar ao inventário</Button></div>
      </form>}
    </dialog>
    {createPortal(<div className={`equipment__toast${toast ? ' equipment__toast--visible' : ''}`} role="status" aria-live="polite">{toast?.message}</div>, document.body)}
  </div>
}
