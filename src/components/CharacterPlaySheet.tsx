import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { classFeatures, getSpellSlotsAtClassLevel } from '../lib/classFeatures'
import type { CharacterDetails, CharacterPlayState } from '../lib/characterData'
import { addInventoryItem, calculateArmorClass, equipmentCatalog, equipOneInventoryUnit, getWeaponAttackModifier, isEquippable, readInventory, type EquipmentItem, type InventoryEntry } from '../lib/equipment'
import { availableSpellSlotLevels, availableSpellSlots, getInitialCharacterPlayState, recoverFromLongRest, recoverFromShortRest, toggleSpellSlot } from '../lib/characterPlay'
import { getSpellDetails } from '../lib/spellDetails'
import { tintSvgDataUri } from '../lib/tintSvg'
import { leveledSpellsByClass } from '../lib/spellCatalog'
import { FramedGlassPanel } from './FramedGlassPanel'
import './CharacterPlaySheet.css'

type SheetTab = 'Habilidades' | 'Características' | 'Inventário' | 'Magias' | 'Sobre'
type Skill = { name: string; ability: string }
type SpellToCast = { name: string; level: number }

const tabs: SheetTab[] = ['Habilidades', 'Características', 'Inventário', 'Magias', 'Sobre']
const inventoryCategories: { id: EquipmentItem['category']; label: string }[] = [
  { id: 'weapons', label: 'Armas' },
  { id: 'armor', label: 'Armaduras' },
  { id: 'tools', label: 'Ferramentas' },
  { id: 'instruments', label: 'Instrumentos' },
  { id: 'gear', label: 'Gerais' },
]
const frameSvgPaths = {
  ability: '/images/character-sheet/SVG/habilidades.svg',
  defaultStat: '/images/character-sheet/SVG/retangulo.svg',
  armorClass: '/images/character-sheet/SVG/escudo.svg',
  corner: '/images/character-sheet/SVG/cantov2.svg',
} as const
type FrameSvg = keyof typeof frameSvgPaths
const frameColorStorageKey = 'trama-sheet-frame-color'
const defaultFrameColor = '#000000'
const darkModeStorageKey = 'trama-sheet-dark-mode'
const tabIcons: Record<SheetTab, string> = {
  Habilidades: 'checklist',
  Características: 'auto_awesome',
  Inventário: 'backpack',
  Magias: 'auto_fix_high',
  Sobre: 'info',
}
const abilities = [
  ['strength', 'Força', 'For'], ['dexterity', 'Destreza', 'Des'], ['constitution', 'Constituição', 'Con'],
  ['intelligence', 'Inteligência', 'Int'], ['wisdom', 'Sabedoria', 'Sab'], ['charisma', 'Carisma', 'Car'],
] as const
const skills: Skill[] = [
  { name: 'Acrobacia', ability: 'dexterity' }, { name: 'Adestrar Animais', ability: 'wisdom' },
  { name: 'Arcanismo', ability: 'intelligence' }, { name: 'Atletismo', ability: 'strength' },
  { name: 'Atuação', ability: 'charisma' }, { name: 'Enganação', ability: 'charisma' },
  { name: 'Furtividade', ability: 'dexterity' }, { name: 'História', ability: 'intelligence' },
  { name: 'Intimidação', ability: 'charisma' }, { name: 'Intuição', ability: 'wisdom' },
  { name: 'Investigação', ability: 'intelligence' }, { name: 'Medicina', ability: 'wisdom' },
  { name: 'Natureza', ability: 'intelligence' }, { name: 'Percepção', ability: 'wisdom' },
  { name: 'Persuasão', ability: 'charisma' }, { name: 'Prestidigitação', ability: 'dexterity' },
  { name: 'Religião', ability: 'intelligence' }, { name: 'Sobrevivência', ability: 'wisdom' },
]
const savingThrowsByClass: Record<string, string[]> = {
  barbaro: ['strength', 'constitution'], bardo: ['dexterity', 'charisma'], bruxo: ['wisdom', 'charisma'],
  clerigo: ['wisdom', 'charisma'], druida: ['intelligence', 'wisdom'], feiticeiro: ['constitution', 'charisma'],
  guerreiro: ['strength', 'constitution'], ladino: ['dexterity', 'intelligence'], mago: ['intelligence', 'wisdom'],
  monge: ['strength', 'dexterity'], paladino: ['wisdom', 'charisma'], patrulheiro: ['strength', 'dexterity'],
}

function modifier(score: string | undefined) {
  const value = Number(score)
  return Number.isFinite(value) && value > 0 ? Math.floor((value - 10) / 2) : 0
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : `${value}`
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function equipmentCategoryIcon(item: EquipmentItem | undefined, category = item?.category) {
  if (category === 'armor' || item?.armor) return 'shield'
  if (category === 'weapons' || item?.weapon) return 'swords'
  if (category === 'tools') return 'construction'
  if (category === 'instruments') return 'music_note'
  return 'inventory_2'
}

function selectedSpells(value: string, classId: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) return { cantrips: parsed.filter((name): name is string => typeof name === 'string'), levels: {} as Record<number, string[]> }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { cantrips: [] as string[], levels: {} as Record<number, string[]> }
    const record = parsed as { cantrips?: unknown; spells?: unknown; knownSpells?: unknown }
    const storedLevels = record.spells && typeof record.spells === 'object' ? record.spells as Record<string, unknown> : {}
    const levels = Object.fromEntries(Object.entries(storedLevels).flatMap(([level, names]) =>
      Array.isArray(names) ? [[Number(level), names.filter((name): name is string => typeof name === 'string')]] : [],
    )) as Record<number, string[]>
    const knownNames = Array.isArray(record.knownSpells) ? record.knownSpells.filter((name): name is string => typeof name === 'string') : []
    for (const name of knownNames) {
      const spellLevel = Object.entries(leveledSpellsByClass[classId] ?? {}).find(([, names]) => names.some((candidate) => normalize(candidate) === normalize(name)))?.[0]
      const level = Number(spellLevel) || 1
      levels[level] = [...(levels[level] ?? []), name]
    }
    return {
      cantrips: Array.isArray(record.cantrips) ? record.cantrips.filter((name): name is string => typeof name === 'string') : [],
      levels,
    }
  } catch {
    return { cantrips: [] as string[], levels: {} as Record<number, string[]> }
  }
}

export function CharacterPlaySheet({
  character,
  characterClass,
  race,
  background,
  portrait,
  landscape,
  onSave,
}: {
  character: CharacterDetails
  characterClass: string
  race: string
  background: string
  portrait: string
  landscape: string
  onSave: (character: CharacterDetails) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<SheetTab>('Habilidades')
  const [saveError, setSaveError] = useState('')
  const [spellToCast, setSpellToCast] = useState<SpellToCast | null>(null)
  const [selectedSpellSlotLevel, setSelectedSpellSlotLevel] = useState<number | null>(null)
  const [pendingSpellSlots, setPendingSpellSlots] = useState<string[]>([])
  const [storedSearchOpen, setStoredSearchOpen] = useState(false)
  const [storedSearch, setStoredSearch] = useState('')
  const [equipmentDrawerOpen, setEquipmentDrawerOpen] = useState(false)
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState<'all' | 'weapons' | 'armor' | 'general'>('all')
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([])
  const [optimisticEquipment, setOptimisticEquipment] = useState<{ base: string; value: string } | null>(null)
  const [frameColor, setFrameColor] = useState(() => {
    try {
      const storedColor = window.localStorage.getItem(frameColorStorageKey)
      return storedColor && /^#[\da-f]{6}$/i.test(storedColor) ? storedColor : defaultFrameColor
    } catch {
      return defaultFrameColor
    }
  })
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem(darkModeStorageKey) === 'true'
    } catch {
      return false
    }
  })
  const [frameSvgs, setFrameSvgs] = useState<Partial<Record<FrameSvg, string>>>({})
  const castDialogRef = useRef<HTMLElement>(null)
  const equipmentDrawerRef = useRef<HTMLDialogElement>(null)
  const storedSearchRef = useRef<HTMLInputElement>(null)
  const tabSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const maxHp = Number(character.maxHp) || 0
  const [playState, setPlayState] = useState(() => {
    const state = getInitialCharacterPlayState(character)
    return { ...state, currentHp: Math.max(0, Math.min(maxHp, state.currentHp)) }
  })
  const proficiencyBonus = Math.floor((character.level - 1) / 4) + 2
  const strengthModifier = modifier(character.abilities.strength)
  const dexterityModifier = modifier(character.abilities.dexterity)
  const equipmentValue = optimisticEquipment?.base === character.equipment ? optimisticEquipment.value : character.equipment
  const inventory = useMemo(() => readInventory(equipmentValue), [equipmentValue])
  const equippedItems = inventory.entries.filter((entry) => entry.equipped)
  const equippedGear = equippedItems.map((entry) => ({ entry, item: entry.itemId ? equipmentCatalog.items.find((item) => item.id === entry.itemId) : undefined }))
  const equippedArmor = equippedGear.find(({ item }) => item?.armor && !item.armor.shield)?.item
  const equippedShield = equippedGear.find(({ item }) => item?.armor?.shield)?.item
  const classId = normalize(characterClass).replaceAll(' ', '-')
  const classData = classFeatures[classId]
  const subclass = classData?.subclasses.find((item) => item.id === character.classSubclassId)
  const featureChoices = [...(classData?.features ?? []), ...(subclass?.features ?? [])].flatMap((feature) => feature.choices ?? [])
  const expertiseIds = Object.entries(character.classFeatureChoices)
    .filter(([key]) => key.endsWith('expertise'))
    .flatMap(([, choices]) => choices)
  const expertiseNames = expertiseIds.flatMap((id) => featureChoices.flatMap((choice) => choice.options).filter((option) => option.id === id).map((option) => option.name))
  const spellSlots = getSpellSlotsAtClassLevel(classId, character.classSubclassId, character.level)
  const spentSpellSlotsForCasting = [...playState.spentSpellSlots, ...pendingSpellSlots]
  const knownSpells = selectedSpells(character.spells, classId)
  const initiative = dexterityModifier
  const baseSpeed = /anao|halfling|gnomo/.test(normalize(race)) ? 7.5 : 9
  const unarmoredMovement = !equippedArmor && !equippedShield
    ? classId === 'monge' && character.level >= 2 ? 3 + Math.floor(Math.max(0, character.level - 2) / 4) * 1.5
      : classId === 'barbaro' && character.level >= 5 ? 3 : 0
    : 0
  const walkingSpeed = baseSpeed + unarmoredMovement
  const unarmoredBonus = classId === 'barbaro' ? modifier(character.abilities.constitution) : classId === 'monge' && !equippedShield ? modifier(character.abilities.wisdom) : 0
  const armorClass = calculateArmorClass(equippedArmor, equippedShield, dexterityModifier, unarmoredBonus)

  useEffect(() => {
    let active = true
    void Promise.all(Object.entries(frameSvgPaths).map(async ([key, path]) => {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`Could not load ${path}`)
      return [key, await response.text()] as const
    })).then((entries) => {
      if (active) setFrameSvgs((current) => ({ ...current, ...Object.fromEntries(entries) }))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  function frameStyle(frame: FrameSvg, fallbackPath: string) {
    const svg = frameSvgs[frame]
    return { backgroundImage: `url("${svg ? tintSvgDataUri(svg, frameColor) : fallbackPath}")` }
  }

  function updateFrameColor(color: string) {
    setFrameColor(color)
    try {
      window.localStorage.setItem(frameColorStorageKey, color)
    } catch {
      // Keep the color active for this session if browser storage is unavailable.
    }
  }

  function updateDarkMode(enabled: boolean) {
    setDarkMode(enabled)
    try {
      window.localStorage.setItem(darkModeStorageKey, String(enabled))
    } catch {
      // Keep the selected mode active for this session if browser storage is unavailable.
    }
  }

  useEffect(() => {
    if (!spellToCast) return
    castDialogRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSpellToCast(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [spellToCast])

  useEffect(() => {
    if (!equipmentDrawerOpen) return
    const drawer = equipmentDrawerRef.current
    if (!drawer) return
    if (!drawer.open) drawer.showModal()
  }, [equipmentDrawerOpen])

  useEffect(() => {
    if (storedSearchOpen) storedSearchRef.current?.focus()
  }, [storedSearchOpen])

  async function save(next: CharacterDetails, nextState = playState): Promise<boolean> {
    setSaveError('')
    try {
      await onSave({ ...next, playState: nextState })
      setPlayState(nextState)
      return true
    } catch {
      setSaveError('Não foi possível salvar a alteração. Verifique a conexão e tente novamente.')
      return false
    }
  }

  function updatePlayState(update: (current: CharacterPlayState) => CharacterPlayState) {
    const nextState = update(playState)
    void save(character, nextState)
  }

  function castUsingSlot(slotId: string) {
    if (spentSpellSlotsForCasting.includes(slotId)) return
    setPendingSpellSlots((current) => current.includes(slotId) ? current : [...current, slotId])
    const nextState = toggleSpellSlot(playState, slotId)
    void save(character, nextState).finally(() => {
      setPendingSpellSlots((current) => current.filter((pendingSlot) => pendingSlot !== slotId))
    })
  }

  function toggleEquipped(entryId: string) {
    const target = inventory.entries.find((entry) => entry.id === entryId)
    if (!target?.itemId) return
    const item = equipmentCatalog.items.find((candidate) => candidate.id === target.itemId)
    if (!target.equipped && !isEquippable(item)) return
    const nextInventory = !target.equipped
      ? equipOneInventoryUnit(inventory, entryId)
      : {
      ...inventory,
      entries: inventory.entries.map((entry) => ({ ...entry, equipped: entry.id === entryId ? !entry.equipped : entry.equipped })),
    }
    void persistInventory(nextInventory)
  }

  function persistInventory(nextInventory: ReturnType<typeof readInventory>) {
    const nextEquipment = JSON.stringify(nextInventory)
    setOptimisticEquipment({ base: character.equipment, value: nextEquipment })
    void save({ ...character, equipment: nextEquipment }).then((saved) => {
      if (!saved) setOptimisticEquipment((current) => current?.value === nextEquipment ? null : current)
    })
  }

  function updateInventoryEntry(entryId: string, updates: Partial<Pick<InventoryEntry, 'name' | 'category' | 'quantity' | 'attackBonus'>>) {
    persistInventory({
      ...inventory,
      entries: inventory.entries.map((entry) => entry.id === entryId ? { ...entry, ...updates } : entry),
    })
  }

  function confirmAddEquipment() {
    let nextInventory = inventory
    for (const itemId of [...selectedEquipmentIds].reverse()) {
      const item = equipmentCatalog.items.find((candidate) => candidate.id === itemId)
      if (!item) continue
      nextInventory = addInventoryItem(nextInventory, item)
      const addedEntry = nextInventory.entries.find((entry) => entry.itemId === item.id && entry.source === 'manual' && !entry.equipped)
      if (addedEntry) nextInventory = { ...nextInventory, entries: [addedEntry, ...nextInventory.entries.filter((entry) => entry.id !== addedEntry.id)] }
    }
    if (selectedEquipmentIds.length) persistInventory(nextInventory)
    equipmentDrawerRef.current?.close()
    setEquipmentDrawerOpen(false)
    setSelectedEquipmentIds([])
  }

  function deleteStoredEquipment(entryId: string) {
    const nextInventory = { ...inventory, entries: inventory.entries.filter((entry) => entry.id !== entryId) }
    persistInventory(nextInventory)
  }

  function handleTabSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    const start = tabSwipeStartRef.current
    tabSwipeStartRef.current = null
    if (!start || (event.target as HTMLElement).closest('button, a, input, select, textarea, [role="dialog"], .play-sheet__inventory-table')) return
    const touch = event.changedTouches[0]
    const horizontalDistance = touch.clientX - start.x
    const verticalDistance = touch.clientY - start.y
    if (Math.abs(horizontalDistance) < 60 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return
    const currentIndex = tabs.indexOf(activeTab)
    const nextIndex = Math.max(0, Math.min(tabs.length - 1, currentIndex + (horizontalDistance < 0 ? 1 : -1)))
    if (nextIndex !== currentIndex) setActiveTab(tabs[nextIndex])
  }

  function rest(long: boolean) {
    const nextState = long
      ? recoverFromLongRest(maxHp)
      : recoverFromShortRest(playState, classId)
    void save(character, nextState)
  }

  function openCastDialog(name: string, level: number) {
    const availableLevels = availableSpellSlotLevels(spellSlots, spentSpellSlotsForCasting, level)
    if (level > 0 && availableLevels.length === 0) return
    if (level > 0 && availableLevels.length === 1) {
      const firstSlot = availableSpellSlots(spellSlots, spentSpellSlotsForCasting, level)
        .find((slotId) => Number(slotId.split(':')[0]) === availableLevels[0])
      if (firstSlot) castUsingSlot(firstSlot)
      return
    }
    setSpellToCast({ name, level })
    setSelectedSpellSlotLevel(availableLevels[0] ?? null)
  }

  function confirmCast() {
    if (!spellToCast) return
    if (spellToCast.level > 0) {
      if (selectedSpellSlotLevel === null || !availableSpellSlotLevels(spellSlots, spentSpellSlotsForCasting, spellToCast.level).includes(selectedSpellSlotLevel)) return
      const slotId = availableSpellSlots(spellSlots, spentSpellSlotsForCasting, spellToCast.level)
        .find((availableId) => Number(availableId.split(':')[0]) === selectedSpellSlotLevel)
      if (!slotId) return
      castUsingSlot(slotId)
    }
    setSpellToCast(null)
  }

  function renderAbilityScores() {
    return <section aria-label="Valores de habilidade" className="play-sheet__scores">
      {abilities.map(([key, , short]) => {
        const score = character.abilities[key] || '—'
        const value = modifier(score)
        return <article className="play-sheet__score" key={key}>
          <div className="play-sheet__score-wrap"><div aria-hidden="true" className="play-sheet__score-glass" /><div aria-hidden="true" className="play-sheet__score-frame" style={frameStyle('ability', frameSvgPaths.ability)} /><span className="play-sheet__score-label">{short}</span><strong>{signed(value)}</strong><small>{score}</small></div>
        </article>
      })}
    </section>
  }

  function renderAbilities() {
    const proficientSaves = savingThrowsByClass[classId] ?? []
    const passiveSkills = ['Percepção', 'Investigação', 'Intuição']
    return <div className="play-sheet__abilities">
      <div className="play-sheet__overview">
        {renderAbilityScores()}
        <div className="play-sheet__vitals">
          <div className="play-sheet__vital--default"><div aria-hidden="true" className="play-sheet__vital-glass" /><div aria-hidden="true" className="play-sheet__vital-frame" style={frameStyle('defaultStat', frameSvgPaths.defaultStat)} /><strong>{signed(initiative)}</strong><span>Iniciativa</span></div><div className="play-sheet__vital--default"><div aria-hidden="true" className="play-sheet__vital-glass" /><div aria-hidden="true" className="play-sheet__vital-frame" style={frameStyle('defaultStat', frameSvgPaths.defaultStat)} /><strong>{walkingSpeed}m</strong><span>DSL</span></div>
          <div className="play-sheet__vital--armor"><div aria-hidden="true" className="play-sheet__vital-glass" /><div aria-hidden="true" className="play-sheet__vital-frame" style={frameStyle('armorClass', frameSvgPaths.armorClass)} /><strong>{armorClass}</strong><span>CA</span></div>
        </div>
      </div>
      <section className="play-sheet__panel play-sheet__checks">
        <FramedGlassPanel className="play-sheet__saving-throws" contentClassName="play-sheet__saving-throws-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
          <h2>Salvaguardas</h2>
            {abilities.map(([key, label]) => <div className="play-sheet__check" key={key}><span className={proficientSaves.includes(key) ? 'play-sheet__proficient' : ''} />{label}<b>{signed(modifier(character.abilities[key]) + (proficientSaves.includes(key) ? proficiencyBonus : 0))}</b></div>)}
        </FramedGlassPanel>
        <FramedGlassPanel className="play-sheet__passive-frame" contentClassName="play-sheet__subpanel" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}><h2>Sentidos passivos</h2>
          {passiveSkills.map((name) => {
            const skill = skills.find((item) => item.name === name)!
            const expertise = expertiseNames.some((expertiseName) => normalize(expertiseName) === normalize(name))
            const proficient = character.skillProficiencies.includes(name) || expertise
            const jackOfAllTrades = classId === 'bardo' && character.level >= 2 && !proficient ? Math.floor(proficiencyBonus / 2) : 0
            const bonus = proficient ? proficiencyBonus * (expertise ? 2 : 1) : jackOfAllTrades
            return <div className="play-sheet__passive" key={name}><span>{10 + modifier(character.abilities[skill.ability]) + bonus}</span>{name} passiva</div>
          })}
        </FramedGlassPanel>
      </section>
      <section className="play-sheet__panel play-sheet__skill-panel">
        <FramedGlassPanel className="play-sheet__skill-frame" contentClassName="play-sheet__skill-list" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}><h2>Testes de habilidade</h2>
        {[skills.slice(0, Math.ceil(skills.length / 2)), skills.slice(Math.ceil(skills.length / 2))].map((skillColumn, columnIndex) => <div className="play-sheet__skill-column" key={columnIndex}>
        {skillColumn.map(({ name, ability }) => {
          const expertise = expertiseNames.some((expertiseName) => normalize(expertiseName) === normalize(name))
          const proficient = character.skillProficiencies.includes(name) || expertise
          const jackOfAllTrades = classId === 'bardo' && character.level >= 2 && !proficient ? Math.floor(proficiencyBonus / 2) : 0
          const bonus = proficient ? proficiencyBonus * (expertise ? 2 : 1) : jackOfAllTrades
          return <div className="play-sheet__skill" key={name}><span className={proficient ? 'play-sheet__proficient' : ''} aria-label={proficient ? (expertise ? 'Especialização' : 'Proficiente') : 'Sem proficiência'} />{name} <small>({abilities.find(([key]) => key === ability)?.[2]})</small><b>{signed(modifier(character.abilities[ability]) + bonus)}</b></div>
        })}
        </div>)}
        </FramedGlassPanel>
      </section>
    </div>
  }

  function renderFeatures() {
    const features = (classData?.features ?? []).filter((feature) => feature.level <= character.level)
    const subclassFeatures = (subclass?.features ?? []).filter((feature) => feature.level <= character.level)
    const featureEntries = [
      ...features.map((feature) => ({ ...feature, group: characterClass })),
      ...subclassFeatures.map((feature) => ({ ...feature, group: subclass?.name ?? '' })),
    ]
    const featureGroups = new Map<number, typeof featureEntries>()
    for (const feature of featureEntries) {
      featureGroups.set(feature.level, [...(featureGroups.get(feature.level) ?? []), feature])
    }
    return <div className="play-sheet__feature-list">
      {[...featureGroups].sort(([a], [b]) => a - b).map(([level, levelFeatures]) => <FramedGlassPanel className="play-sheet__feature-level" contentClassName="play-sheet__feature-level-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor} key={level}>
        <h2>Nível {level}</h2>
        {levelFeatures.map((feature, index) => <article className="play-sheet__feature" key={`${feature.group}-${feature.name}-${index}`}>
          <header><h3>{feature.name}</h3><span>{feature.group}</span></header>
          <p>{feature.description}</p>
          {feature.choices?.map((choice) => {
            const key = `${character.characterClassId}:${character.classSubclassId}:${feature.level}:${feature.name}:${choice.id}`
            const selected = character.classFeatureChoices[key] ?? []
            const selectedNames = selected.map((id) => choice.options.find((option) => option.id === id)?.name ?? id)
            return selectedNames.length > 0 ? <p className="play-sheet__feature-choice" key={choice.id}>{choice.name}: {selectedNames.join(', ')}</p> : null
          })}
        </article>)}
      </FramedGlassPanel>)}
      {featureEntries.length === 0 && <FramedGlassPanel className="play-sheet__feature-level" contentClassName="play-sheet__feature-level-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}><h2>Características</h2><p>As características da classe serão exibidas aqui.</p></FramedGlassPanel>}
    </div>
  }

  function renderInventory() {
    const storedItems = inventory.entries.filter((entry) => !entry.equipped && normalize(entry.name).includes(normalize(storedSearch.trim())))
    const renderInventoryRow = (entry: InventoryEntry, equipped: boolean) => {
      const item = entry.itemId ? equipmentCatalog.items.find((candidate) => candidate.id === entry.itemId) : undefined
      const category = entry.category ?? item?.category ?? 'gear'
      const categoryLabel = inventoryCategories.find(({ id }) => id === category)?.label ?? 'Gerais'
      const attack = getWeaponAttackModifier(item, classId, character.classSubclassId, character.level, strengthModifier, dexterityModifier, proficiencyBonus, Boolean(equippedArmor), Boolean(equippedShield))
      const weight = item?.weightKg ? `${item.weightKg * entry.quantity} kg` : '—'
      return <div className="play-sheet__inventory-row" key={entry.id}>
        <span className="play-sheet__inventory-item">
          <span aria-label={categoryLabel} className="play-sheet__category-icon" title={categoryLabel}><span aria-hidden="true" className="material-symbols-rounded">{equipmentCategoryIcon(item, category)}</span></span>
          <input aria-label="Nome do equipamento" defaultValue={entry.name} onBlur={(event) => updateInventoryEntry(entry.id, { name: event.target.value })} />
          {item && <small>{item.weapon ? `${item.weapon.damage} ${item.weapon.damageType} · ${item.properties.join(', ')}` : item.armor ? `CA ${item.armor.ac}` : item.description || entry.notes}</small>}
        </span>
        <select aria-label="Categoria do equipamento" onChange={(event) => updateInventoryEntry(entry.id, { category: event.target.value as EquipmentItem['category'] })} value={category}>
          {inventoryCategories.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
        <input aria-label="Quantidade" defaultValue={entry.quantity} disabled={equipped} min={1} onBlur={(event) => updateInventoryEntry(entry.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} type="number" />
        <span>{weight}</span>
        {attack ? <input aria-label="Bônus de ataque" defaultValue={entry.attackBonus ?? attack.modifier} onBlur={(event) => updateInventoryEntry(entry.id, { attackBonus: Number(event.target.value) || 0 })} type="number" /> : <span>—</span>}
        <span className="play-sheet__inventory-actions">
          {equipped
            ? <button onClick={() => toggleEquipped(entry.id)} type="button">Guardar</button>
            : Boolean(entry.itemId) && isEquippable(item)
              ? <button onClick={() => toggleEquipped(entry.id)} type="button">Equipar</button>
              : <span aria-label="Não equipável" title="Apenas armas e armaduras podem ser equipadas">—</span>}
          {!equipped && <button aria-label={`Excluir ${entry.name}`} className="play-sheet__inventory-delete" onClick={() => deleteStoredEquipment(entry.id)} title={`Excluir ${entry.name}`} type="button"><span aria-hidden="true" className="material-symbols-rounded">delete</span></button>}
        </span>
      </div>
    }
    const filteredEquipment = equipmentCatalog.items.filter((item) => {
      const matchesCategory = equipmentFilter === 'all' || item.category === equipmentFilter || (equipmentFilter === 'general' && item.category !== 'weapons' && item.category !== 'armor')
      return matchesCategory && normalize([item.name, item.subcategory, item.description, ...item.aliases, ...item.properties].join(' ')).includes(normalize(equipmentSearch.trim()))
    })
    return <div className="play-sheet__inventory">
      <FramedGlassPanel className="play-sheet__inventory-frame" contentClassName="play-sheet__inventory-section" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
        <h2>Em uso</h2>
        <div className="play-sheet__inventory-table"><div className="play-sheet__inventory-row play-sheet__inventory-row--heading"><span>Item</span><span>Categoria</span><span>Quant.</span><span>Peso</span><span>Ataque</span><span>Ações</span></div>
          {equippedGear.map(({ entry }) => renderInventoryRow(entry, true))}
          {equippedGear.length === 0 && <p>Nenhum item equipado.</p>}
        </div>
      </FramedGlassPanel>
      <FramedGlassPanel className="play-sheet__inventory-frame" contentClassName="play-sheet__inventory-section" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
        <header className="play-sheet__inventory-heading"><h2>Guardado</h2><div className="play-sheet__inventory-tools">
        {storedSearchOpen && <input aria-label="Pesquisar equipamentos guardados" onChange={(event) => setStoredSearch(event.target.value)} placeholder="Pesquisar equipamento" ref={storedSearchRef} type="search" value={storedSearch} />}
        <button aria-label={storedSearchOpen ? 'Fechar pesquisa' : 'Pesquisar equipamentos guardados'} onClick={() => { if (storedSearchOpen) { setStoredSearch(''); setStoredSearchOpen(false) } else setStoredSearchOpen(true) }} type="button"><span aria-hidden="true" className="material-symbols-rounded">{storedSearchOpen ? 'close' : 'search'}</span></button>
        <button aria-label="Adicionar equipamento" onClick={() => { setStoredSearch(''); setEquipmentSearch(''); setEquipmentFilter('all'); setSelectedEquipmentIds([]); setEquipmentDrawerOpen(true) }} type="button"><span aria-hidden="true" className="material-symbols-rounded">add</span></button>
        <span>{(inventory.currencyCp / 100).toFixed(0)} po</span>
      </div></header>
        <div className="play-sheet__inventory-table"><div className="play-sheet__inventory-row play-sheet__inventory-row--heading"><span>Item</span><span>Categoria</span><span>Quant.</span><span>Peso</span><span>Ataque</span><span>Ações</span></div>
          {storedItems.map((entry) => renderInventoryRow(entry, false))}
          {storedItems.length === 0 && <p>{storedSearch ? 'Nenhum equipamento encontrado.' : inventory.entries.some((entry) => !entry.equipped) ? 'Nenhum equipamento guardado.' : 'Seu inventário está vazio.'}</p>}
        </div>
      </FramedGlassPanel>
      <dialog aria-label="Adicionar equipamento" className="play-sheet__equipment-drawer" onCancel={() => { setEquipmentDrawerOpen(false); setSelectedEquipmentIds([]) }} onClose={() => { setEquipmentDrawerOpen(false); setSelectedEquipmentIds([]) }} onClick={(event) => { if (event.target === event.currentTarget) { equipmentDrawerRef.current?.close(); setEquipmentDrawerOpen(false); setSelectedEquipmentIds([]) } }} ref={equipmentDrawerRef}>
        <div className="play-sheet__equipment-drawer-content">
          <header><div><h2>Adicionar equipamento</h2><p>Selecione um ou mais itens para adicionar ao inventário.</p></div><button aria-label="Fechar painel" onClick={() => { equipmentDrawerRef.current?.close(); setEquipmentDrawerOpen(false); setSelectedEquipmentIds([]) }} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button></header>
          <label className="play-sheet__equipment-search"><span className="material-symbols-rounded" aria-hidden="true">search</span><input aria-label="Pesquisar no catálogo de equipamentos" onChange={(event) => setEquipmentSearch(event.target.value)} placeholder="Pesquisar equipamento" type="search" value={equipmentSearch} /></label>
          <div aria-label="Filtrar equipamentos" className="play-sheet__equipment-filters">
            {([['all', 'Todos'], ['weapons', 'Armas'], ['armor', 'Armaduras'], ['general', 'Gerais']] as const).map(([filter, label]) => <button aria-pressed={equipmentFilter === filter} key={filter} onClick={() => setEquipmentFilter(filter)} type="button">{label}</button>)}
          </div>
          <div className="play-sheet__equipment-items">
            {filteredEquipment.map((item) => <article className={selectedEquipmentIds.includes(item.id) ? 'play-sheet__equipment-option play-sheet__equipment-option--selected' : 'play-sheet__equipment-option'} key={item.id}><label><input aria-label={`Selecionar ${item.name}`} checked={selectedEquipmentIds.includes(item.id)} onChange={() => setSelectedEquipmentIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} type="checkbox" /><span><strong>{item.name}</strong><span>{item.weapon ? `${item.weapon.damage} ${item.weapon.damageType}${item.properties.length ? ` · ${item.properties.join(', ')}` : ''}` : item.armor ? `CA ${item.armor.ac}${item.armor.shield ? '' : item.armor.dexterity === 'none' ? '' : ' + Destreza'}` : item.subcategory}</span><small>{item.weightKg ? `${item.weightKg} kg` : 'Peso variável'} · {item.priceCp === null ? 'Preço variável' : `${(item.priceCp / 100).toFixed(item.priceCp % 100 ? 2 : 0)} po`}</small></span></label></article>)}
            {!filteredEquipment.length && <p>Nenhum item encontrado.</p>}
          </div>
          <footer className="play-sheet__equipment-drawer-actions"><button className="play-sheet__equipment-cancel" onClick={() => { equipmentDrawerRef.current?.close(); setEquipmentDrawerOpen(false); setSelectedEquipmentIds([]) }} type="button">Cancelar</button><button disabled={selectedEquipmentIds.length === 0} onClick={confirmAddEquipment} type="button">Adicionar{selectedEquipmentIds.length ? ` (${selectedEquipmentIds.length})` : ''}</button></footer>
        </div>
      </dialog>
    </div>
  }

  function renderSpells() {
    const hasSpells = knownSpells.cantrips.length > 0 || Object.values(knownSpells.levels).some((names) => names.length > 0)
    const spellItem = (name: string, level: string, spellLevel: number) => {
      const details = getSpellDetails(name)
      const canCast = spellLevel === 0 || availableSpellSlotLevels(spellSlots, spentSpellSlotsForCasting, spellLevel).length > 0
      return <li key={name}>
        <div className="play-sheet__spell-detail">
          <strong>{name}</strong>
          {details && <small>Conjuração: {details.castingTime} · Alcance: {details.range}</small>}
          {details && <small>Componentes: {details.components} · Duração: {details.duration}</small>}
        </div>
        <div className="play-sheet__spell-actions"><span>{level}</span><button disabled={!canCast} onClick={() => openCastDialog(name, spellLevel)} title={canCast ? 'Conjurar magia' : 'Sem espaços disponíveis deste nível ou superiores'} type="button">Conjurar</button></div>
      </li>
    }
    return <div className="play-sheet__spell-list">
      {knownSpells.cantrips.length > 0 && <FramedGlassPanel className="play-sheet__spell-frame" contentClassName="play-sheet__spell-panel" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}><h2>Truques</h2><ul>{knownSpells.cantrips.map((name) => spellItem(name, 'Truque', 0))}</ul></FramedGlassPanel>}
      {spellSlots.map((count, index) => count > 0 && <FramedGlassPanel className="play-sheet__spell-frame play-sheet__spell-level" contentClassName="play-sheet__spell-panel" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor} key={index}>
        <header><h2>Magias de nível {index + 1}</h2><span>{count} espaços</span><div className="play-sheet__spell-slots" aria-label={`${count} espaços de magia de nível ${index + 1}`}>
          {Array.from({ length: count }, (_, slotIndex) => {
            const slotId = `${index + 1}:${slotIndex}`
            const spent = spentSpellSlotsForCasting.includes(slotId)
            return <button aria-label={`Espaço ${slotIndex + 1}, nível ${index + 1}, ${spent ? 'gasto' : 'disponível'}`} aria-pressed={spent} className={spent ? 'play-sheet__slot play-sheet__slot--spent' : 'play-sheet__slot'} disabled={pendingSpellSlots.length > 0} key={slotId} onClick={() => updatePlayState((current) => toggleSpellSlot(current, slotId))} title={spent ? 'Marcar espaço disponível' : 'Marcar espaço gasto'} type="button" />
          })}
        </div></header>
        <ul>{(knownSpells.levels[index + 1] ?? []).map((name) => spellItem(name, `Nível ${index + 1}`, index + 1))}</ul>
      </FramedGlassPanel>)}
      {!hasSpells && <FramedGlassPanel className="play-sheet__spell-frame" contentClassName="play-sheet__spell-panel" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}><h2>Magias</h2><p>Este personagem não tem magias conhecidas registradas.</p></FramedGlassPanel>}
    </div>
  }

  function renderAbout() {
    return <div className="play-sheet__about">
      <FramedGlassPanel className="play-sheet__about-frame" contentClassName="play-sheet__about-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
      <section className="play-sheet__about-section play-sheet__frame-color"><h2>Personalização da ficha</h2>
        <label className="play-sheet__dark-mode"><input checked={darkMode} onChange={(event) => updateDarkMode(event.target.checked)} type="checkbox" />Modo escuro</label>
        <label htmlFor="sheet-frame-color">Cor das molduras</label>
        <div><input aria-label="Cor das molduras da ficha" id="sheet-frame-color" onChange={(event) => updateFrameColor(event.target.value)} type="color" value={frameColor} /><output htmlFor="sheet-frame-color">{frameColor.toUpperCase()}</output><button onClick={() => updateFrameColor(defaultFrameColor)} type="button">Restaurar padrão</button></div>
      </section>
      <section className="play-sheet__about-section"><h2>Descansos</h2><p>O descanso longo restaura PV e espaços de magia. O descanso curto recupera os espaços de pacto do Bruxo.</p><div className="play-sheet__rest-actions"><button onClick={() => rest(false)} type="button">Descanso curto</button><button onClick={() => rest(true)} type="button">Descanso longo</button></div></section>
      <section className="play-sheet__about-section play-sheet__about-facts"><h2>Sobre</h2>
        {[['Idade', character.age ? `${character.age} anos` : '—'], ['Altura', character.height || '—'], ['Peso', character.weight ? `${character.weight} kg` : '—'], ['Tendência', character.alignment || '—'], ['Antecedente', background]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>
      </FramedGlassPanel>
    </div>
  }

  return <main className={`play-sheet${darkMode ? ' play-sheet--dark' : ''}`}>
    <header className="play-sheet__character-bar">
      <div className="play-sheet__character-bar-inner">
        <div className="play-sheet__identity">
          <span className="play-sheet__portrait">{portrait ? <img alt={`Retrato de ${character.name}`} src={portrait} /> : <span aria-hidden="true" className="play-sheet__portrait-placeholder">✦</span>}</span>
          <div><h1>{character.name}</h1><p>{race} · {background} · {characterClass} NV {character.level}</p></div>
        </div>
      </div>
    </header>
    <div aria-hidden="true" className="play-sheet__hero">
      <img className="play-sheet__backdrop" src={landscape} />
    </div>
    <div className="play-sheet__paper">
      <nav aria-label="Seções da ficha" className="play-sheet__tabs" role="tablist">
        {tabs.map((tab) => <button aria-selected={activeTab === tab} className={activeTab === tab ? 'play-sheet__tab play-sheet__tab--active' : 'play-sheet__tab'} key={tab} onClick={() => setActiveTab(tab)} role="tab" type="button"><span aria-hidden="true" className="material-symbols-rounded">{tabIcons[tab]}</span>{tab}</button>)}
      </nav>
      <div className="play-sheet__content" key={activeTab} onTouchStart={(event) => {
        if ((event.target as HTMLElement).closest('button, a, input, select, textarea, [role="dialog"], .play-sheet__inventory-table')) {
          tabSwipeStartRef.current = null
          return
        }
        const touch = event.touches[0]
        tabSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
      }} onTouchEnd={handleTabSwipeEnd}>
        {activeTab === 'Habilidades' && renderAbilities()}
        {activeTab === 'Características' && renderFeatures()}
        {activeTab === 'Inventário' && renderInventory()}
        {activeTab === 'Magias' && renderSpells()}
        {activeTab === 'Sobre' && renderAbout()}
      </div>
    </div>
    {saveError && <p className="play-sheet__error" role="alert">{saveError}</p>}
    {spellToCast && <div className="play-sheet__cast-backdrop" onClick={() => setSpellToCast(null)} role="presentation">
      <section aria-labelledby="cast-spell-title" aria-modal="true" className="play-sheet__cast-dialog" onClick={(event) => event.stopPropagation()} ref={castDialogRef} role="dialog" tabIndex={-1}>
        <h2 id="cast-spell-title">Conjurar {spellToCast.name}</h2>
        {spellToCast.level === 0
          ? <p>Este truque não consome espaço de magia.</p>
          : <>
            <p>Selecione o nível do espaço que deseja usar.</p>
            <div className="play-sheet__cast-options">
              {availableSpellSlotLevels(spellSlots, spentSpellSlotsForCasting, spellToCast.level).map((level) => {
                const availableCount = availableSpellSlots(spellSlots, spentSpellSlotsForCasting, spellToCast.level)
                  .filter((slotId) => Number(slotId.split(':')[0]) === level).length
                return <label key={level}><input checked={selectedSpellSlotLevel === level} name="spell-slot-level" onChange={() => setSelectedSpellSlotLevel(level)} type="radio" value={level} /><span>Nível {level} · {availableCount} {availableCount === 1 ? 'espaço disponível' : 'espaços disponíveis'}</span></label>
              })}
            </div>
          </>}
        <footer><button className="play-sheet__cast-cancel" onClick={() => setSpellToCast(null)} type="button">Cancelar</button><button disabled={spellToCast.level > 0 && (selectedSpellSlotLevel === null || !availableSpellSlotLevels(spellSlots, spentSpellSlotsForCasting, spellToCast.level).includes(selectedSpellSlotLevel))} onClick={confirmCast} type="button">{spellToCast.level === 0 ? 'Conjurar truque' : 'Conjurar magia'}</button></footer>
      </section>
    </div>}
  </main>
}
