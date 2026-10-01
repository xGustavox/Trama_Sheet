import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnimationItem } from 'lottie-web'
import type { Swiper as SwiperInstance } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import { classArmorProficiencies } from '../lib/classArmorProficiencies'
import { classFeatures, classHitDice, getSpellSlotsAtClassLevel } from '../lib/classFeatures'
import type { CharacterDetails, CharacterPlayState } from '../lib/characterData'
import { addInventoryItem, calculateArmorClass, convertCurrency, currencyDenominations, equipOneInventoryUnit, equipmentDetails, formatPrice, getArmorClassBreakdown, getCurrencyBalances, getFinesseWeaponAttackModifiers, getWeaponAttackModifier, isEquippable, readInventory, type CurrencyBalances, type CurrencyCode, type EquipmentItem, type InventoryEntry } from '../lib/equipment'
import { useEquipmentCatalog } from '../lib/useEquipmentCatalog'
import { applyHitPointAdjustment, applyHitPointDamage, availableSpellSlotLevels, availableSpellSlots, getInitialCharacterPlayState, healHitPoints, recoverFromLongRest, recoverFromShortRest, setTemporaryHitPoints, spendHitDiceOnShortRest, toggleDeathSaveMark, toggleSpellSlot } from '../lib/characterPlay'
import { levelForExperience } from '../lib/experience'
import { getSpellDetails } from '../lib/spellDetails'
import { groupSpellChoicesByLevel } from '../lib/spellSelection'
import { getSpellPreparationLimit } from '../lib/spellPreparation'
import { tintSvgDataUri } from '../lib/tintSvg'
import { ExperienceBar, ExperienceDialog, LevelUpDrawer } from './CharacterExperience'
import { CharacterAbout } from './CharacterAbout'
import { Button } from './Button'
import { Modal } from './Modal'
import { useToast } from './ToastContext'
import { getSpellListForSelection, leveledSpellsByClass, spellcastingAbilityByClass } from '../lib/spellCatalog'
import { FramedGlassPanel } from './FramedGlassPanel'
import './CharacterPlaySheet.css'

type SheetTab = 'Habilidades' | 'Características' | 'Inventário' | 'Magias' | 'Sobre'
type InventorySortKey = 'item' | 'attack' | 'weight'
type InventorySort = { key: InventorySortKey; direction: 'asc' | 'desc' } | null
type Skill = { name: string; ability: string }
type SpellToCast = { name: string; level: number }
type QuantityDialogState = { entryId: string; name: string; quantity: number }
type AttackDialogState = {
  itemName: string
  ability: 'strength' | 'dexterity'
  abilityModifier: number
  strengthModifier: number
  dexterityModifier: number
  proficient: boolean
  proficiencyBonus: number
  finesseModifiers: { strength: number; dexterity: number } | null
  customBonus?: number
}

function SpellCastAnimation({ onComplete }: { onComplete: () => void }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!containerRef.current) return
    let animation: AnimationItem | null = null
    let cancelled = false
    const handleComplete = () => onCompleteRef.current()
    void import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return
      animation = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/images/spell-cast-sparks.json',
      })
      animation.addEventListener('complete', handleComplete)
    }).catch(() => {
      if (!cancelled) onCompleteRef.current()
    })
    return () => {
      cancelled = true
      animation?.removeEventListener('complete', handleComplete)
      animation?.destroy()
    }
  }, [])

  return <span aria-hidden="true" className="play-sheet__spell-cast-animation" ref={containerRef} />
}

const tabs: SheetTab[] = ['Habilidades', 'Características', 'Inventário', 'Magias', 'Sobre']
const conditions = [
  ['Cego', 'blind', 'Não pode ver e falha automaticamente em testes que dependam da visão. Seus ataques têm desvantagem, e ataques contra ele têm vantagem.'],
  ['Enfeitiçado', 'mood_heart', 'Não pode atacar nem causar dano ao encantador. O encantador tem vantagem em testes sociais para interagir com a criatura.'],
  ['Surdo', 'hearing_disabled', 'Não pode ouvir e falha automaticamente em testes que dependam da audição.'],
  ['Amedrontado', 'sentiment_stressed', 'Tem desvantagem em testes e ataques enquanto a fonte do medo estiver visível e não pode se aproximar voluntariamente dela.'],
  ['Agarrado', 'sports_kabaddi', 'Deslocamento se torna 0. A condição termina se quem o agarrou ficar incapacitado ou se um efeito afastar a criatura do alcance do agarrão.'],
  ['Incapacitado', 'sentiment_frustrated', 'Não pode realizar ações nem reações.'],
  ['Invisível', 'background_replace', 'Não pode ser visto sem magia ou sentido especial. Ataques da criatura têm vantagem; ataques contra ela têm desvantagem.'],
  ['Paralisado', 'sentiment_neutral', 'Fica incapacitado e não pode se mover nem falar. Falha em testes de Força e Destreza; ataques contra ela têm vantagem, e acertos a até 1,5 m são críticos.'],
  ['Petrificado', 'man_4', 'É transformado (com o equipamento) em uma substância inanimada. Fica incapacitado, não pode se mover ou falar e tem resistência a todo dano.'],
  ['Envenenado', 'skull', 'Tem desvantagem em jogadas de ataque e testes de habilidade.'],
  ['Caído', 'falling', 'Só pode se mover rastejando até se levantar (custa metade do deslocamento). Ataques corpo a corpo contra ela têm vantagem; ataques à distância têm desvantagem.'],
  ['Contido', 'stress_management', 'Deslocamento se torna 0. Ataques contra ela têm vantagem, seus ataques têm desvantagem e ela tem desvantagem em testes de resistência de Destreza.'],
  ['Atordoado', 'cognition', 'Fica incapacitado, mal consegue falar e não pode se mover. Falha em testes de Força e Destreza; ataques contra ela têm vantagem.'],
  ['Inconsciente', 'sentiment_very_dissatisfied', 'Fica incapacitado, cai e larga o que estiver segurando. Falha em testes de Força e Destreza; ataques contra ela têm vantagem, e acertos a até 1,5 m são críticos.'],
] as const
const inventoryCategories: { id: EquipmentItem['category']; label: string }[] = [
  { id: 'weapons', label: 'Armas' },
  { id: 'armor', label: 'Armaduras' },
  { id: 'tools', label: 'Ferramentas' },
  { id: 'instruments', label: 'Instrumentos' },
  { id: 'gear', label: 'Gerais' },
  { id: 'magic', label: 'Itens mágicos' },
]
const frameSvgPaths = {
  ability: '/images/character-sheet/SVG/habilidades.svg',
  spellAbility: '/images/character-sheet/SVG/habilidades_magia.svg',
  defaultStat: '/images/character-sheet/SVG/retangulo.svg',
  armorClass: '/images/character-sheet/SVG/escudo.svg',
  savingThrow: '/images/character-sheet/SVG/borda_sem_ponta.svg',
  passiveCircle: '/images/character-sheet/SVG/circulo.svg',
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

function formatCurrencyAmount(amount: number) {
  if (amount >= 1000) return `${(amount / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  return amount.toLocaleString('pt-BR')
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function FrameColorDialog({ frameColor, frameSvg, landscape, theme, onCancel, onConfirm }: {
  frameColor: string
  frameSvg: string | undefined
  landscape: string
  theme: 'light' | 'dark'
  onCancel: () => void
  onConfirm: (color: string) => void
}) {
  const [draft, setDraft] = useState(frameColor)
  const previewFrameStyle = useMemo(() => ({
    backgroundImage: `url("${frameSvg ? tintSvgDataUri(frameSvg, draft) : frameSvgPaths.ability}")`,
  }), [draft, frameSvg])

  return <Modal open title="Cor das molduras" theme={theme} onClose={onCancel} footer={<><Button onClick={onCancel} variant="secondary">Cancelar</Button><Button onClick={() => onConfirm(draft)}>Concluir</Button></>}>
    <div className="play-sheet__frame-color-modal">
      <p>Escolha uma cor e veja como ela fica sobre a imagem de fundo da ficha. A alteração será aplicada à ficha somente depois de concluir.</p>
      <div aria-label="Prévia da moldura sobre a imagem de fundo" className="play-sheet__frame-color-preview" style={{ backgroundImage: `url("${landscape}")` }}>
        <div className="play-sheet__frame-color-preview-card">
          <span className="play-sheet__frame-color-preview-glass" />
          <span className="play-sheet__frame-color-preview-label">FORÇA</span>
          <strong>+3</strong>
          <small>14</small>
          <span aria-hidden="true" className="play-sheet__frame-color-preview-frame" style={previewFrameStyle} />
        </div>
      </div>
      <div className="play-sheet__frame-color-picker">
        <label htmlFor="sheet-frame-color">Cor da moldura</label>
        <div>
          <input aria-label="Cor da moldura na prévia" id="sheet-frame-color" onChange={(event) => setDraft(event.target.value)} type="color" value={draft} />
          <output htmlFor="sheet-frame-color">{draft.toUpperCase()}</output>
          <Button onClick={() => setDraft(defaultFrameColor)} variant="secondary">Restaurar padrão</Button>
        </div>
      </div>
    </div>
  </Modal>
}

function equipmentCategoryIcon(item: EquipmentItem | undefined, category = item?.category) {
  if (category === 'armor' || item?.armor) return 'shield'
  if (category === 'weapons' || item?.weapon) return 'swords'
  if (category === 'tools') return 'construction'
  if (category === 'instruments') return 'music_note'
  if (category === 'magic') return 'auto_awesome'
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

type CurrencyDraft = Record<CurrencyCode, string>

function currencyDraftFromBalances(balances: CurrencyBalances): CurrencyDraft {
  return Object.fromEntries(currencyDenominations.map(({ code }) => [code, String(balances[code])])) as CurrencyDraft
}

function CurrencyManagementDrawer({ initialCurrencyCp, initialCurrencyBalances, theme, onClose, onSave }: {
  initialCurrencyCp: number
  initialCurrencyBalances?: CurrencyBalances
  theme: 'light' | 'dark'
  onClose: () => void
  onSave: (currencyCp: number, currencyBalances: CurrencyBalances) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(() => currencyDraftFromBalances(initialCurrencyBalances ?? getCurrencyBalances(initialCurrencyCp)))
  const [conversionOpen, setConversionOpen] = useState(false)
  const [source, setSource] = useState<CurrencyCode>('gp')
  const [target, setTarget] = useState<CurrencyCode>('sp')
  const [sourceAmount, setSourceAmount] = useState('1')
  const [adjustments, setAdjustments] = useState<Partial<Record<CurrencyCode, number>>>({})
  const [visibleCounters, setVisibleCounters] = useState<Partial<Record<CurrencyCode, boolean>>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const adjustmentTimers = useRef<Partial<Record<CurrencyCode, number>>>({})
  const values = Object.fromEntries(currencyDenominations.map(({ code }) => [code, Number(draft[code])])) as CurrencyBalances
  const validDraft = currencyDenominations.every(({ code }) => Number.isSafeInteger(values[code]) && values[code] >= 0)
  const conversion = validDraft ? convertCurrency(values, source, target, Number(sourceAmount)) : null
  const targetAmount = conversion ? conversion[target] - values[target] : 0
  const sourceMaximum = validDraft ? values[source] : 0

  useEffect(() => () => {
    for (const timer of Object.values(adjustmentTimers.current)) if (timer !== undefined) window.clearTimeout(timer)
  }, [])

  function clearCounter(code: CurrencyCode) {
    const timer = adjustmentTimers.current[code]
    if (timer !== undefined) window.clearTimeout(timer)
    delete adjustmentTimers.current[code]
    setAdjustments((current) => ({ ...current, [code]: 0 }))
    setVisibleCounters((current) => ({ ...current, [code]: false }))
  }

  function changeCoin(code: CurrencyCode, change: number) {
    const current = Number(draft[code])
    const next = Math.max(0, (Number.isSafeInteger(current) ? current : 0) + change)
    if (!Number.isSafeInteger(next)) return
    setDraft((balances) => ({ ...balances, [code]: String(next) }))
    setAdjustments((balances) => ({ ...balances, [code]: (balances[code] ?? 0) + change }))
    setVisibleCounters((balances) => ({ ...balances, [code]: true }))
    const previousTimer = adjustmentTimers.current[code]
    if (previousTimer !== undefined) window.clearTimeout(previousTimer)
    adjustmentTimers.current[code] = window.setTimeout(() => {
      setAdjustments((balances) => ({ ...balances, [code]: 0 }))
      setVisibleCounters((balances) => ({ ...balances, [code]: false }))
      delete adjustmentTimers.current[code]
    }, 3000)
  }

  function changeCoinInput(code: CurrencyCode, value: string) {
    clearCounter(code)
    setDraft((current) => ({ ...current, [code]: value }))
  }

  function applyConversion() {
    if (!conversion) {
      setError('Informe uma quantidade válida disponível e escolha outra moeda de destino.')
      return
    }
    setDraft(Object.fromEntries(currencyDenominations.map(({ code }) => [code, String(conversion[code])])) as CurrencyDraft)
    for (const { code } of currencyDenominations) clearCounter(code)
    setError('')
    setConversionOpen(false)
  }

  async function saveAndClose() {
    if (savingRef.current) return
    if (!validDraft) {
      setError('Informe valores inteiros e não negativos para todas as moedas.')
      setConversionOpen(false)
      return
    }
    const currencyCp = currencyDenominations.reduce((total, { code, valueCp }) => total + values[code] * valueCp, 0)
    if (!Number.isSafeInteger(currencyCp)) {
      setError('O total de moedas é muito alto para ser salvo.')
      return
    }
    savingRef.current = true
    setSaving(true)
    const saved = await onSave(currencyCp, values)
    savingRef.current = false
    setSaving(false)
    if (saved) onClose()
  }

  const footer = conversionOpen
    ? <div className="play-sheet__currency-footer"><Button disabled={saving} onClick={() => { setConversionOpen(false); setError('') }} variant="secondary">Cancelar</Button><Button disabled={!conversion || saving} onClick={applyConversion}>Converter</Button></div>
    : <div className="play-sheet__currency-footer"><Button disabled={saving} onClick={() => { setError(''); setConversionOpen(true) }} variant="secondary">Converter moedas</Button><Button disabled={saving} onClick={() => void saveAndClose()}>{saving ? 'Salvando…' : 'Concluir'}</Button></div>

  return <Modal open title={conversionOpen ? 'Converter moedas' : 'Seu dinheiro'} theme={theme} onClose={() => void saveAndClose()} footer={footer} variant="drawer">
    <div className="play-sheet__currency-drawer">
      {conversionOpen ? <div className="play-sheet__currency-converter">
        <div className="play-sheet__currency-converter-row"><label><input aria-label="Quantidade de moedas de origem" max={sourceMaximum} min="1" onChange={(event) => setSourceAmount(event.target.value)} step="1" type="number" value={sourceAmount} /><small>Máx. {sourceMaximum}</small></label><select aria-label="Moeda de origem" onChange={(event) => setSource(event.target.value as CurrencyCode)} value={source}>{currencyDenominations.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select></div>
        <span className="play-sheet__currency-converter-to">para</span>
        <div className="play-sheet__currency-converter-row"><input aria-label="Quantidade de moedas de destino" disabled value={targetAmount} /><select aria-label="Moeda de destino" onChange={(event) => setTarget(event.target.value as CurrencyCode)} value={target}>{currencyDenominations.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select></div>
      </div> : <div aria-label="Saldos de moedas" className="play-sheet__currency-list">
        {currencyDenominations.map(({ code, label }) => <article className={`play-sheet__currency-card${visibleCounters[code] ? ' play-sheet__currency-card--counter' : ''}`} key={code}>
          <img alt="" src={`/images/coins/${code}.png`} />
          <strong>{label}</strong>
          <div className="play-sheet__currency-adjuster">
            <button aria-label={`Diminuir moedas de ${label}`} disabled={saving || Number(draft[code]) <= 0} onClick={() => changeCoin(code, -1)} type="button">−</button>
            <div className="play-sheet__currency-value">
              {visibleCounters[code] && (adjustments[code] ?? 0) !== 0 && <small className={(adjustments[code] ?? 0) > 0 ? 'play-sheet__currency-adjustment--positive' : 'play-sheet__currency-adjustment--negative'}>{(adjustments[code] ?? 0) > 0 ? '+' : ''}{adjustments[code]}</small>}
              <input aria-label={`Quantidade de moedas de ${label}`} disabled={saving} min="0" onChange={(event) => changeCoinInput(code, event.target.value)} step="1" type="number" value={draft[code]} />
            </div>
            <button aria-label={`Aumentar moedas de ${label}`} disabled={saving} onClick={() => changeCoin(code, 1)} type="button">+</button>
          </div>
        </article>)}
      </div>}
      {error && <p className="play-sheet__currency-error" role="alert">{error}</p>}
    </div>
  </Modal>
}

export function CharacterPlaySheet({
  character,
  characterClass,
  race,
  background,
  portrait,
  landscape,
  onBack,
  onSave,
  onUploadPortrait,
  onUploadBackground,
  onLoadBackgrounds,
  onDeleteBackground,
}: {
  character: CharacterDetails
  characterClass: string
  race: string
  background: string
  portrait: string
  landscape: string
  onBack: () => void
  onSave: (character: CharacterDetails) => Promise<void>
  onUploadPortrait: (file: File) => Promise<{ path: string; url: string }>
  onUploadBackground: (file: File) => Promise<{ path: string; url: string }>
  onLoadBackgrounds: () => Promise<{ path: string; url: string; name: string }[]>
  onDeleteBackground: (path: string) => Promise<void>
}) {
  const { catalog, loading: equipmentLoading, error: equipmentError, retry: retryEquipment } = useEquipmentCatalog(false)
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<SheetTab>('Habilidades')
  const [experienceDialogOpen, setExperienceDialogOpen] = useState(false)
  const [deathSaveDialogOpen, setDeathSaveDialogOpen] = useState(false)
  const [deathSaveDraft, setDeathSaveDraft] = useState({ successes: [false, false, false], failures: [false, false, false], currentHp: 0 })
  const [deathSaveHealAmount, setDeathSaveHealAmount] = useState('')
  const [deathSaveSaving, setDeathSaveSaving] = useState(false)
  const [restDrawerOpen, setRestDrawerOpen] = useState(false)
  const [selectedRestType, setSelectedRestType] = useState<'short' | 'long' | null>(null)
  const [shortRestDiceCount, setShortRestDiceCount] = useState(0)
  const [restSaving, setRestSaving] = useState(false)
  const [showFutureClassLevels, setShowFutureClassLevels] = useState(false)
  const [spellPreparationPromptOpen, setSpellPreparationPromptOpen] = useState(false)
  const [spellPreparationDrawerOpen, setSpellPreparationDrawerOpen] = useState(false)
  const [spellPreparationDraft, setSpellPreparationDraft] = useState<string[]>([])
  const [spellPreparationLevelFilter, setSpellPreparationLevelFilter] = useState<number | null>(null)
  const [spellPreparationSaving, setSpellPreparationSaving] = useState(false)
  const [conditionsDialogOpen, setConditionsDialogOpen] = useState(false)
  const initialConditions = character.activeConditions ?? []
  const initialConditionNames = getInitialCharacterPlayState(character).currentHp === 0 && !initialConditions.includes('Inconsciente')
    ? [...initialConditions, 'Inconsciente']
    : initialConditions
  const [activeConditionNames, setActiveConditionNames] = useState<string[]>(initialConditionNames)
  const [conditionDraftNames, setConditionDraftNames] = useState<string[]>(initialConditionNames)
  const [conditionIconIndex, setConditionIconIndex] = useState(0)
  const [conditionSavePending, setConditionSavePending] = useState(false)
  const [levelUpTarget, setLevelUpTarget] = useState<{ experience: number; level: number } | null>(null)
  const [hpDialogOpen, setHpDialogOpen] = useState(false)
  const [detailsDialog, setDetailsDialog] = useState<'armorClass' | 'initiative' | null>(null)
  const [hpAmount, setHpAmount] = useState('')
  const [hpDraft, setHpDraft] = useState<CharacterPlayState>(() => getInitialCharacterPlayState(character))
  const [hpAdjustment, setHpAdjustment] = useState(0)
  const [hpAdjustmentVisible, setHpAdjustmentVisible] = useState(false)
  const [selectedInventoryEntry, setSelectedInventoryEntry] = useState<InventoryEntry | null>(null)
  const [inventorySort, setInventorySort] = useState<InventorySort>(null)
  const [quantityDialog, setQuantityDialog] = useState<QuantityDialogState | null>(null)
  const [attackDialog, setAttackDialog] = useState<AttackDialogState | null>(null)
  const [inventoryEntryToDelete, setInventoryEntryToDelete] = useState<InventoryEntry | null>(null)
  const [quantityDraft, setQuantityDraft] = useState(1)
  const [spellToCast, setSpellToCast] = useState<SpellToCast | null>(null)
  const [selectedSpellSlotLevel, setSelectedSpellSlotLevel] = useState<number | null>(null)
  const [pendingSpellSlots, setPendingSpellSlots] = useState<string[]>([])
  const [spellCastAnimation, setSpellCastAnimation] = useState<{ name: string; id: number } | null>(null)
  const [storedSearchOpen, setStoredSearchOpen] = useState(false)
  const [storedSearch, setStoredSearch] = useState('')
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false)
  const [equipmentDrawerOpen, setEquipmentDrawerOpen] = useState(false)
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState<'all' | 'weapons' | 'armor' | 'magic' | 'general'>('all')
  const [equipmentItemToAdd, setEquipmentItemToAdd] = useState<EquipmentItem | null>(null)
  const [equipmentAddQuantity, setEquipmentAddQuantity] = useState('1')
  const [equipmentAddNotes, setEquipmentAddNotes] = useState('')
  const [equipmentDrawerClosing, setEquipmentDrawerClosing] = useState(false)
  const [highlightedInventoryEntries, setHighlightedInventoryEntries] = useState<string[]>([])
  const [optimisticEquipment, setOptimisticEquipment] = useState<{ base: string; value: string } | null>(null)
  const [frameColor, setFrameColor] = useState(() => {
    try {
      const storedColor = window.localStorage.getItem(frameColorStorageKey)
      return storedColor && /^#[\da-f]{6}$/i.test(storedColor) ? storedColor : defaultFrameColor
    } catch {
      return defaultFrameColor
    }
  })
  const [frameColorDialogOpen, setFrameColorDialogOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem(darkModeStorageKey) === 'true'
    } catch {
      return false
    }
  })
  const [frameSvgs, setFrameSvgs] = useState<Partial<Record<FrameSvg, string>>>({})
  const [backgroundImages, setBackgroundImages] = useState<string[]>([])
  const [backgroundPreview, setBackgroundPreview] = useState(landscape)
  const castDialogRef = useRef<HTMLElement>(null)
  const spellCastAnimationId = useRef(0)
  const sheetSwiperRef = useRef<SwiperInstance | null>(null)
  const equipmentDrawerRef = useRef<HTMLDialogElement>(null)
  const equipmentDrawerCloseTimer = useRef<number | null>(null)
  const inventoryHighlightTimer = useRef<number | null>(null)
  const pendingInventoryHighlights = useRef<string[]>([])
  const storedSearchRef = useRef<HTMLInputElement>(null)
  const hpAdjustmentTimeoutRef = useRef<number | null>(null)
  const hpHoldTimeoutRef = useRef<number | null>(null)
  const hpHoldIntervalRef = useRef<number | null>(null)
  const hpHoldTriggeredRef = useRef(false)
  const maxHp = Number(character.maxHp) || 0

  useEffect(() => {
    setBackgroundPreview(landscape)
  }, [landscape])
  useEffect(() => {
    const previousTheme = document.body.dataset.playSheetToastTheme
    document.body.dataset.playSheetToastTheme = darkMode ? 'dark' : 'light'
    return () => {
      if (previousTheme === undefined) delete document.body.dataset.playSheetToastTheme
      else document.body.dataset.playSheetToastTheme = previousTheme
    }
  }, [darkMode])
  useEffect(() => () => {
    if (inventoryHighlightTimer.current !== null) window.clearTimeout(inventoryHighlightTimer.current)
  }, [])
  const [playState, setPlayState] = useState(() => {
    const state = getInitialCharacterPlayState(character)
    return { ...state, currentHp: Math.max(0, Math.min(maxHp, state.currentHp)) }
  })
  const hpStartingStateRef = useRef<CharacterPlayState>(playState)
  const hpDraftRef = useRef<CharacterPlayState>(playState)
  const hpAdjustmentRef = useRef(0)
  const canRestoreTemporaryHp = hpAdjustmentVisible
    && hpAdjustment < 0
    && hpDraft.temporaryHp < hpStartingStateRef.current.temporaryHp
  const currentConditionIcon = activeConditionNames.length
    ? conditions.find(([name]) => name === activeConditionNames[conditionIconIndex % activeConditionNames.length])?.[1] ?? 'sick'
    : 'sick'
  const proficiencyBonus = Math.floor((character.level - 1) / 4) + 2
  const strengthModifier = modifier(character.abilities.strength)
  const dexterityModifier = modifier(character.abilities.dexterity)
  const equipmentValue = optimisticEquipment?.base === character.equipment ? optimisticEquipment.value : character.equipment
  const inventory = useMemo(() => readInventory(equipmentValue, catalog ?? undefined), [equipmentValue, catalog])
  const currencyBalances = inventory.currencyBalances ?? getCurrencyBalances(inventory.currencyCp)
  const displayedCurrencies = currencyDenominations.filter(({ code }) => currencyBalances[code] > 0)
  const currencySummary = displayedCurrencies.length
    ? displayedCurrencies.map(({ code }) => `${formatCurrencyAmount(currencyBalances[code])} ${code}`).join(', ')
    : 'nenhuma moeda'
  const equippedItems = inventory.entries.filter((entry) => entry.equipped)
  const equippedGear = equippedItems.map((entry) => ({ entry, item: entry.itemId ? catalog?.items.find((item) => item.id === entry.itemId) : undefined }))
  const equippedArmor = equippedGear.find(({ item }) => item?.armor && !item.armor.shield)?.item
  const equippedShield = equippedGear.find(({ item }) => item?.armor?.shield)?.item
  const classId = normalize(characterClass).replaceAll(' ', '-')
  const totalHitDice = Math.max(1, Math.trunc(Number(character.level) || 1))
  const availableHitDice = Math.max(0, totalHitDice - playState.spentHitDice)
  const hitDieSize = classHitDice[classId] ?? 8
  const classData = classFeatures[classId]
  const subclass = classData?.subclasses.find((item) => item.id === character.classSubclassId)
  const featureChoices = [...(classData?.features ?? []), ...(subclass?.features ?? [])].flatMap((feature) => feature.choices ?? [])
  const expertiseIds = Object.entries(character.classFeatureChoices)
    .filter(([key]) => key.endsWith('expertise'))
    .flatMap(([, choices]) => choices)
  const expertiseNames = expertiseIds.flatMap((id) => featureChoices.flatMap((choice) => choice.options).filter((option) => option.id === id).map((option) => option.name))
  const spellSlots = getSpellSlotsAtClassLevel(classId, character.classSubclassId, character.level)
  const spellPreparationLimit = getSpellPreparationLimit(classId, character.level, modifier(character.abilities.wisdom), modifier(character.abilities.charisma))
  const canPrepareSpells = spellPreparationLimit !== null && spellSlots.some((count) => count > 0)
  const circleTerrain = character.classFeatureChoices[
    `${character.characterClassId}:circulo-da-terra:2:Terreno do Círculo:terra`
  ]?.[0]
  const spellPreparationOptionsByLevel = getSpellListForSelection(classId, character.classSubclassId, circleTerrain)
  const spellPreparationOptions = Object.entries(spellPreparationOptionsByLevel)
    .filter(([level]) => Number(level) <= spellSlots.length)
    .flatMap(([level, names]) => names.map((name) => ({ name, level: Number(level) })))
  const spellcastingAbilityName = classId === 'guerreiro' && character.classSubclassId === 'cavaleiro-arcano'
    || classId === 'ladino' && character.classSubclassId === 'trapaceiro-arcano'
    ? 'Inteligência'
    : spellcastingAbilityByClass[classId]
  const spellcastingAbility = abilities.find(([, name]) => name === spellcastingAbilityName)
  const spellcastingModifier = spellcastingAbility ? modifier(character.abilities[spellcastingAbility[0]]) : null
  const spellSaveDc = spellcastingModifier === null ? '—' : 8 + proficiencyBonus + spellcastingModifier
  const spellAttackBonus = spellcastingModifier === null ? '—' : signed(proficiencyBonus + spellcastingModifier)
  const spentSpellSlotsForCasting = [...playState.spentSpellSlots, ...pendingSpellSlots]
  const knownSpells = selectedSpells(character.spells, classId)
  const preparedSpellNames = Object.values(knownSpells.levels).flat()
  const initiative = dexterityModifier
  const baseSpeed = /anao|halfling|gnomo/.test(normalize(race)) ? 7.5 : 9
  const unarmoredMovement = !equippedArmor && !equippedShield
    ? classId === 'monge' && character.level >= 2 ? 3 + Math.floor(Math.max(0, character.level - 2) / 4) * 1.5
      : classId === 'barbaro' && character.level >= 5 ? 3 : 0
    : 0
  const walkingSpeed = baseSpeed + unarmoredMovement
  const unarmoredBonus = classId === 'barbaro' ? modifier(character.abilities.constitution) : classId === 'monge' && !equippedShield ? modifier(character.abilities.wisdom) : 0
  const armorClass = calculateArmorClass(equippedArmor, equippedShield, dexterityModifier, unarmoredBonus)
  const armorClassBreakdown = getArmorClassBreakdown(equippedArmor, equippedShield, dexterityModifier, unarmoredBonus)

  useEffect(() => {
    if (activeConditionNames.length < 2) return
    const interval = window.setInterval(() => {
      setConditionIconIndex((current) => (current + 1) % activeConditionNames.length)
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [activeConditionNames])

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

  useEffect(() => {
    let active = true
    void fetch('/images/backgrounds/index.json')
      .then((response) => response.ok ? response.json() as Promise<string[]> : [])
      .then((images) => { if (active && Array.isArray(images)) setBackgroundImages(images) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  function frameStyle(frame: FrameSvg, fallbackPath: string) {
    const svg = frameSvgs[frame]
    return { backgroundImage: `url("${svg ? tintSvgDataUri(svg, frameColor) : fallbackPath}")` }
  }

  function openFrameColorDialog() {
    setFrameColorDialogOpen(true)
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
    setEquipmentDrawerClosing(false)
    if (equipmentDrawerCloseTimer.current !== null) window.clearTimeout(equipmentDrawerCloseTimer.current)
    if (!drawer.open) drawer.showModal()
  }, [equipmentDrawerOpen])

  useEffect(() => {
    if (!equipmentDrawerOpen) return
    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
    }
  }, [equipmentDrawerOpen])

  useEffect(() => () => {
    if (equipmentDrawerCloseTimer.current !== null) window.clearTimeout(equipmentDrawerCloseTimer.current)
  }, [])

  useEffect(() => {
    if (storedSearchOpen) storedSearchRef.current?.focus()
  }, [storedSearchOpen])

  async function save(next: CharacterDetails, nextState = playState, messages?: { success?: string; error?: string }): Promise<boolean> {
    try {
      await onSave({ ...next, playState: nextState })
      setPlayState(nextState)
      if (messages?.success) toast.success(messages.success)
      return true
    } catch {
      toast.error(messages?.error ?? 'Não foi possível salvar as alterações da ficha. Verifique a conexão e tente novamente.')
      return false
    }
  }

  useEffect(() => {
    const savedConditions = character.activeConditions ?? []
    if (playState.currentHp !== 0 || savedConditions.includes('Inconsciente')) return
    const activeConditions = [...savedConditions, 'Inconsciente']
    void save({ ...character, activeConditions }, playState).then((saved) => {
      if (saved) {
        setActiveConditionNames(activeConditions)
        setConditionDraftNames(activeConditions)
      }
    })
  }, [character.activeConditions, playState.currentHp])

  async function saveExperience(experience: number) {
    const targetLevel = levelForExperience(experience)
    const levelGained = targetLevel > character.level
    const levelMessage = levelGained ? ` O personagem alcançou o nível ${targetLevel}.` : ''
    const saved = await save({
      ...character,
      experiencePoints: String(experience),
      ...(!levelGained ? { level: targetLevel } : {}),
    }, playState, {
      success: `Pontos de XP atualizados para ${experience.toLocaleString('pt-BR')}.${levelMessage}`,
      error: 'Não foi possível atualizar os pontos de XP. Tente novamente.',
    })
    if (saved && levelGained) setLevelUpTarget({ experience, level: targetLevel })
    return saved
  }

  function openHpDialog() {
    hpDraftRef.current = playState
    hpStartingStateRef.current = playState
    setHpDraft(playState)
    hpAdjustmentRef.current = 0
    setHpAdjustment(0)
    setHpAdjustmentVisible(false)
    setHpAmount('')
    setHpDialogOpen(true)
  }

  function cancelHpDialog() {
    if (hpAdjustmentTimeoutRef.current !== null) window.clearTimeout(hpAdjustmentTimeoutRef.current)
    if (hpHoldTimeoutRef.current !== null) window.clearTimeout(hpHoldTimeoutRef.current)
    if (hpHoldIntervalRef.current !== null) window.clearInterval(hpHoldIntervalRef.current)
    setHpDialogOpen(false)
    setHpAdjustmentVisible(false)
  }

  async function confirmHpDialog() {
    const editedState = hpDraftRef.current
    const wasUnconsciousAtZeroHp = hpStartingStateRef.current.currentHp === 0
    const state = wasUnconsciousAtZeroHp && editedState.currentHp > 0
      ? { ...editedState, deathSaveSuccesses: [], deathSaveFailures: [] }
      : editedState
    const nextConditions = state.currentHp === 0
      ? [...new Set([...activeConditionNames, 'Inconsciente'])]
      : wasUnconsciousAtZeroHp
        ? activeConditionNames.filter((condition) => condition !== 'Inconsciente')
        : activeConditionNames
    const temporary = state.temporaryHp > 0 ? ` + ${state.temporaryHp} PV temporários` : ''
    if (await save({ ...character, activeConditions: nextConditions }, state, {
      success: `Pontos de vida atualizados: ${state.currentHp}${temporary} de ${maxHp}.`,
      error: 'Não foi possível atualizar os pontos de vida. Tente novamente.',
    })) {
      setActiveConditionNames(nextConditions)
      setConditionDraftNames(nextConditions)
      setHpDialogOpen(false)
    }
  }

  function changeHpByButtons(change: number) {
    const nextAdjustment = hpAdjustmentRef.current + change
    const startingState = hpStartingStateRef.current
    const nextState = applyHitPointAdjustment(startingState, nextAdjustment, maxHp)

    hpDraftRef.current = nextState
    hpAdjustmentRef.current = nextAdjustment
    setHpDraft(nextState)
    setHpAdjustment(nextAdjustment)
    setHpAdjustmentVisible(true)
    if (hpAdjustmentTimeoutRef.current !== null) window.clearTimeout(hpAdjustmentTimeoutRef.current)
    hpAdjustmentTimeoutRef.current = window.setTimeout(() => {
      hpStartingStateRef.current = hpDraftRef.current
      hpAdjustmentRef.current = 0
      setHpAdjustment(0)
      setHpAdjustmentVisible(false)
    }, 3000)
  }

  function startHpButtonHold(change: number) {
    hpHoldTriggeredRef.current = false
    if (hpHoldTimeoutRef.current !== null) window.clearTimeout(hpHoldTimeoutRef.current)
    if (hpHoldIntervalRef.current !== null) window.clearInterval(hpHoldIntervalRef.current)
    hpHoldTimeoutRef.current = window.setTimeout(() => {
      hpHoldTriggeredRef.current = true
      changeHpByButtons(change * 5)
      hpHoldIntervalRef.current = window.setInterval(() => changeHpByButtons(change * 5), 350)
    }, 450)
  }

  function stopHpButtonHold() {
    if (hpHoldTimeoutRef.current !== null) window.clearTimeout(hpHoldTimeoutRef.current)
    if (hpHoldIntervalRef.current !== null) window.clearInterval(hpHoldIntervalRef.current)
  }

  function applyHpAmount(change: (current: CharacterPlayState, amount: number) => CharacterPlayState) {
    const amount = Math.trunc(Number(hpAmount))
    if (!Number.isFinite(amount) || amount <= 0) return
    if (hpAdjustmentTimeoutRef.current !== null) window.clearTimeout(hpAdjustmentTimeoutRef.current)
    hpStartingStateRef.current = hpDraftRef.current
    hpAdjustmentRef.current = 0
    setHpAdjustment(0)
    setHpAdjustmentVisible(false)
    const nextState = change(hpDraftRef.current, amount)
    hpDraftRef.current = nextState
    setHpDraft(nextState)
    setHpAmount('')
  }

  function openDeathSaveDialog() {
    setDeathSaveDraft({
      successes: Array.from({ length: 3 }, (_, index) => Boolean(playState.deathSaveSuccesses?.[index])),
      failures: Array.from({ length: 3 }, (_, index) => Boolean(playState.deathSaveFailures?.[index])),
      currentHp: playState.currentHp,
    })
    setDeathSaveHealAmount('')
    setDeathSaveDialogOpen(true)
  }

  function applyDeathSaveHealing() {
    const amount = Math.trunc(Number(deathSaveHealAmount))
    if (!Number.isFinite(amount) || amount <= 0) return
    setDeathSaveDraft((current) => ({
      ...current,
      currentHp: healHitPoints({ ...playState, currentHp: current.currentHp }, amount, maxHp).currentHp,
    }))
    setDeathSaveHealAmount('')
  }

  function toggleDeathSave(kind: 'successes' | 'failures', index: number) {
    setDeathSaveDraft((current) => ({ ...current, [kind]: toggleDeathSaveMark(current[kind], index) }))
  }

  async function confirmDeathSaveDialog() {
    if (deathSaveSaving || playState.currentHp !== 0) return
    setDeathSaveSaving(true)
    const recovered = deathSaveDraft.currentHp > 0
    const nextState = {
      ...playState,
      currentHp: deathSaveDraft.currentHp,
      deathSaveSuccesses: recovered ? [] : deathSaveDraft.successes,
      deathSaveFailures: recovered ? [] : deathSaveDraft.failures,
    }
    const nextConditions = recovered
      ? activeConditionNames.filter((condition) => condition !== 'Inconsciente')
      : [...new Set([...activeConditionNames, 'Inconsciente'])]
    try {
      const saved = await save({ ...character, activeConditions: nextConditions }, nextState, {
        success: recovered
          ? `Pontos de vida atualizados: ${nextState.currentHp} de ${maxHp}.`
          : 'Testes de resistência contra a morte atualizados.',
        error: recovered
          ? 'Não foi possível salvar os pontos de vida. Tente novamente.'
          : 'Não foi possível salvar os testes de resistência contra a morte.',
      })
      if (saved) {
        setActiveConditionNames(nextConditions)
        setConditionDraftNames(nextConditions)
        setDeathSaveDialogOpen(false)
      }
    } finally {
      setDeathSaveSaving(false)
    }
  }

  function updatePlayState(update: (current: CharacterPlayState) => CharacterPlayState) {
    const nextState = update(playState)
    void save(character, nextState)
  }

  function showSpellCastAnimation(name: string) {
    spellCastAnimationId.current += 1
    setSpellCastAnimation({ name, id: spellCastAnimationId.current })
  }

  function finishSpellCastAnimation(id: number) {
    setSpellCastAnimation((current) => current?.id === id ? null : current)
  }

  function castUsingSlot(slotId: string, spellName: string) {
    if (spentSpellSlotsForCasting.includes(slotId)) return
    setPendingSpellSlots((current) => current.includes(slotId) ? current : [...current, slotId])
    const nextState = toggleSpellSlot(playState, slotId)
    void save(character, nextState, { error: `Não foi possível conjurar ${spellName}. Tente novamente.` }).then((saved) => {
      if (saved) showSpellCastAnimation(spellName)
    }).finally(() => {
      setPendingSpellSlots((current) => current.filter((pendingSlot) => pendingSlot !== slotId))
    })
  }

  function toggleEquipped(entryId: string) {
    const target = inventory.entries.find((entry) => entry.id === entryId)
    if (!target?.itemId) return
    const item = catalog?.items.find((candidate) => candidate.id === target.itemId)
    if (!target.equipped && (!catalog || !isEquippable(item))) return
    const nextInventory = !target.equipped
      ? equipOneInventoryUnit(inventory, entryId, catalog!)
      : {
      ...inventory,
      entries: inventory.entries.map((entry) => ({ ...entry, equipped: entry.id === entryId ? !entry.equipped : entry.equipped })),
    }
    void persistInventory(nextInventory)
  }

  function persistInventory(nextInventory: ReturnType<typeof readInventory>, messages?: { success?: string; error?: string }) {
    const nextEquipment = JSON.stringify(nextInventory)
    setOptimisticEquipment({ base: character.equipment, value: nextEquipment })
    return save({ ...character, equipment: nextEquipment }, playState, messages).then((saved) => {
      if (!saved) setOptimisticEquipment((current) => current?.value === nextEquipment ? null : current)
      return saved
    })
  }

  function updateInventoryEntry(entryId: string, updates: Partial<Pick<InventoryEntry, 'name' | 'category' | 'quantity' | 'attackBonus'>>) {
    persistInventory({
      ...inventory,
      entries: inventory.entries.map((entry) => entry.id === entryId ? { ...entry, ...updates } : entry),
    })
  }

  function confirmAddEquipment() {
    const quantity = Number(equipmentAddQuantity)
    if (!equipmentItemToAdd || !Number.isSafeInteger(quantity) || quantity < 1) return
    const nextInventory = addInventoryItem(inventory, equipmentItemToAdd, quantity)
    const addedEntry = nextInventory.entries.find((entry) => entry.itemId === equipmentItemToAdd.id && entry.source === 'manual' && !entry.equipped)
    if (!addedEntry) return
    const entries = nextInventory.entries.map((entry) => entry.id === addedEntry.id ? { ...entry, notes: equipmentAddNotes } : entry)
    void persistInventory({
      ...nextInventory,
      entries: [entries.find((entry) => entry.id === addedEntry.id)!, ...entries.filter((entry) => entry.id !== addedEntry.id)],
    }, {
      success: `${quantity} ${quantity === 1 ? 'unidade' : 'unidades'} de ${addedEntry.name} adicionada${quantity === 1 ? '' : 's'} ao inventário.`,
      error: `Não foi possível adicionar ${addedEntry.name} ao inventário. Tente novamente.`,
    }).then((saved) => {
      if (!saved) return
      pendingInventoryHighlights.current.push(addedEntry.id)
      if (!equipmentDrawerRef.current?.open) highlightPendingInventoryEntries()
    })
    setEquipmentItemToAdd(null)
    setEquipmentAddQuantity('1')
    setEquipmentAddNotes('')
  }

  function highlightPendingInventoryEntries() {
    if (pendingInventoryHighlights.current.length === 0) return
    const addedIds = [...new Set(pendingInventoryHighlights.current)]
    pendingInventoryHighlights.current = []
    setHighlightedInventoryEntries((current) => [...new Set([...current, ...addedIds])])
    if (inventoryHighlightTimer.current !== null) window.clearTimeout(inventoryHighlightTimer.current)
    inventoryHighlightTimer.current = window.setTimeout(() => {
      setHighlightedInventoryEntries([])
      inventoryHighlightTimer.current = null
    }, 1800)
  }

  function closeEquipmentDrawer() {
    if (equipmentDrawerCloseTimer.current !== null) window.clearTimeout(equipmentDrawerCloseTimer.current)
    setEquipmentDrawerClosing(true)
    equipmentDrawerCloseTimer.current = window.setTimeout(() => {
      if (equipmentDrawerRef.current?.open) equipmentDrawerRef.current.close()
      else setEquipmentDrawerOpen(false)
      setEquipmentDrawerClosing(false)
      setEquipmentItemToAdd(null)
      highlightPendingInventoryEntries()
      equipmentDrawerCloseTimer.current = null
    }, 180)
  }

  function deleteStoredEquipment(entryId: string) {
    const removed = inventory.entries.find((entry) => entry.id === entryId)
    const nextInventory = { ...inventory, entries: inventory.entries.filter((entry) => entry.id !== entryId) }
    return persistInventory(nextInventory, removed ? {
      success: `${removed.name} removido do inventário.`,
      error: `Não foi possível excluir ${removed.name} do inventário. Tente novamente.`,
    } : undefined)
  }

  function openQuantityDialog(entry: InventoryEntry) {
    setQuantityDraft(entry.quantity)
    setQuantityDialog({ entryId: entry.id, name: entry.name, quantity: entry.quantity })
  }

  function confirmInventoryQuantity() {
    if (!quantityDialog) return
    if (quantityDraft === 0) {
      setInventoryEntryToDelete(inventory.entries.find((entry) => entry.id === quantityDialog.entryId) ?? null)
    } else {
      updateInventoryEntry(quantityDialog.entryId, { quantity: quantityDraft })
    }
    setQuantityDialog(null)
  }

  function confirmDeleteInventoryEntry() {
    if (!inventoryEntryToDelete) return
    deleteStoredEquipment(inventoryEntryToDelete.id)
    setInventoryEntryToDelete(null)
  }

  async function rest(long: boolean, hitDiceToSpend = 0) {
    const nextState = long
      ? recoverFromLongRest(playState, maxHp, totalHitDice)
      : recoverFromShortRest(spendHitDiceOnShortRest(playState, hitDiceToSpend, totalHitDice), classId)
    const hitDiceChanged = long
      ? playState.spentHitDice - nextState.spentHitDice
      : nextState.spentHitDice - playState.spentHitDice
    const nextConditions = long && playState.currentHp === 0 && nextState.currentHp > 0
      ? activeConditionNames.filter((condition) => condition !== 'Inconsciente')
      : activeConditionNames
    const saved = await save({ ...character, activeConditions: nextConditions }, nextState, {
      success: long
        ? `Descanso longo concluído. Pontos de vida e espaços de magia restaurados. ${hitDiceChanged} Dados de Vida recuperados.`
        : `Descanso curto concluído. ${hitDiceChanged} Dados de Vida gastos; role-os e atualize os PV manualmente.`,
      error: `Não foi possível salvar o descanso ${long ? 'longo' : 'curto'}. Tente novamente.`,
    })
    if (saved && nextConditions !== activeConditionNames) {
      setActiveConditionNames(nextConditions)
      setConditionDraftNames(nextConditions)
    }
    return saved
  }

  function openRestDrawer() {
    setSelectedRestType(null)
    setShortRestDiceCount(0)
    setRestDrawerOpen(true)
  }

  function closeRestDrawer() {
    if (restSaving) return
    setRestDrawerOpen(false)
    setSelectedRestType(null)
    setShortRestDiceCount(0)
  }

  async function confirmRest() {
    if (restSaving || !selectedRestType) return
    setRestSaving(true)
    try {
      const saved = await rest(selectedRestType === 'long', selectedRestType === 'short' ? shortRestDiceCount : 0)
      if (saved) {
        setRestDrawerOpen(false)
        setSelectedRestType(null)
        setShortRestDiceCount(0)
        if (selectedRestType === 'long' && canPrepareSpells) setSpellPreparationPromptOpen(true)
      }
    } finally {
      setRestSaving(false)
    }
  }

  function openSpellPreparationDrawer() {
    setSpellPreparationDraft(preparedSpellNames)
    setSpellPreparationLevelFilter(null)
    setSpellPreparationPromptOpen(false)
    setSpellPreparationDrawerOpen(true)
  }

  function togglePreparedSpell(name: string) {
    setSpellPreparationDraft((current) => current.includes(name)
      ? current.filter((spell) => spell !== name)
      : current.length < (spellPreparationLimit ?? 0) ? [...current, name] : current)
  }

  async function confirmSpellPreparation() {
    if (spellPreparationSaving) return
    const spellLevelByName = Object.fromEntries(spellPreparationOptions.map(({ name, level }) => [name, level]))
    const spells = JSON.stringify({
      cantrips: knownSpells.cantrips,
      spells: groupSpellChoicesByLevel(spellPreparationDraft, spellLevelByName),
    })
    setSpellPreparationSaving(true)
    try {
      const saved = await save({ ...character, spells }, playState, {
        success: `Lista de magias atualizada. ${spellPreparationDraft.length} ${spellPreparationDraft.length === 1 ? 'magia preparada' : 'magias preparadas'}.`,
        error: 'Não foi possível atualizar a lista de magias. Tente novamente.',
      })
      if (saved) setSpellPreparationDrawerOpen(false)
    } finally {
      setSpellPreparationSaving(false)
    }
  }

  function openConditionsDialog() {
    setConditionDraftNames(activeConditionNames)
    setConditionsDialogOpen(true)
  }

  function toggleActiveCondition(name: string) {
    if (conditionSavePending || (name === 'Inconsciente' && playState.currentHp === 0)) return
    setConditionDraftNames((current) => current.includes(name)
      ? current.filter((condition) => condition !== name)
      : [...current, name])
  }

  async function closeConditionsDialog() {
    if (conditionSavePending) return
    const nextConditions = playState.currentHp === 0
      ? [...new Set([...conditionDraftNames, 'Inconsciente'])]
      : conditionDraftNames
    const conditionsChanged = nextConditions.length !== activeConditionNames.length
      || nextConditions.some((name) => !activeConditionNames.includes(name))
    if (!conditionsChanged) {
      setConditionsDialogOpen(false)
      return
    }

    setConditionSavePending(true)
    const saved = await save({ ...character, activeConditions: nextConditions }, playState, {
      success: nextConditions.length ? `Condições atualizadas: ${nextConditions.join(', ')}.` : 'Todas as condições foram removidas.',
      error: 'Não foi possível atualizar as condições. Tente novamente.',
    })
    if (saved) {
      setActiveConditionNames(nextConditions)
      setConditionDraftNames(nextConditions)
      setConditionIconIndex(0)
      setConditionsDialogOpen(false)
    }
    setConditionSavePending(false)
  }

  function openCastDialog(name: string, level: number) {
    const availableLevels = availableSpellSlotLevels(spellSlots, spentSpellSlotsForCasting, level)
    if (level > 0 && availableLevels.length === 0) return
    if (level > 0 && availableLevels.length === 1) {
      const firstSlot = availableSpellSlots(spellSlots, spentSpellSlotsForCasting, level)
        .find((slotId) => Number(slotId.split(':')[0]) === availableLevels[0])
      if (firstSlot) castUsingSlot(firstSlot, name)
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
      castUsingSlot(slotId, spellToCast.name)
    } else {
      showSpellCastAnimation(spellToCast.name)
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
    return <>
      <div className="play-sheet__abilities">
      <div className="play-sheet__overview">
        {renderAbilityScores()}
        <div className="play-sheet__vitals">
          <div aria-haspopup="dialog" aria-label={`Iniciativa ${signed(initiative)}, abrir explicação`} className="play-sheet__vital--default play-sheet__vital--interactive" onClick={() => setDetailsDialog('initiative')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailsDialog('initiative') } }} role="button" tabIndex={0}><div aria-hidden="true" className="play-sheet__vital-glass" /><div aria-hidden="true" className="play-sheet__vital-frame" style={frameStyle('defaultStat', frameSvgPaths.defaultStat)} /><strong>{signed(initiative)}</strong><span>Iniciativa</span></div><div className="play-sheet__vital--default"><div aria-hidden="true" className="play-sheet__vital-glass" /><div aria-hidden="true" className="play-sheet__vital-frame" style={frameStyle('defaultStat', frameSvgPaths.defaultStat)} /><strong>{walkingSpeed}m</strong><span>DSL</span></div>
          <div aria-haspopup="dialog" aria-label={`Classe de armadura ${armorClass}, abrir detalhes`} className="play-sheet__vital--armor play-sheet__vital--interactive" onClick={() => setDetailsDialog('armorClass')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailsDialog('armorClass') } }} role="button" tabIndex={0}><div aria-hidden="true" className="play-sheet__vital-glass" /><div aria-hidden="true" className="play-sheet__vital-frame" style={frameStyle('armorClass', frameSvgPaths.armorClass)} /><strong>{armorClass}</strong><span>CA</span></div>
        </div>
      </div>
      <section className="play-sheet__panel play-sheet__checks">
        <FramedGlassPanel className="play-sheet__saving-throws" contentClassName="play-sheet__saving-throws-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
          <h2>Salvaguardas</h2>
            {abilities.map(([key, label]) => {
              const proficient = proficientSaves.includes(key)
              const saveModifier = modifier(character.abilities[key]) + (proficient ? proficiencyBonus : 0)
              return <div className="play-sheet__check" key={key} style={{ borderColor: frameColor }}>
                <div aria-hidden="true" className="play-sheet__check-frame">
                  <span className="play-sheet__check-frame-layer" style={frameStyle('savingThrow', frameSvgPaths.savingThrow)} />
                </div>
                <span className={`play-sheet__proficiency-indicator${proficient ? ' play-sheet__proficient' : ''}`} />
                <span className="play-sheet__check-label">{label}</span>
                <b>{signed(saveModifier)}</b>
              </div>
            })}
        </FramedGlassPanel>
        <FramedGlassPanel className="play-sheet__passive-frame" contentClassName="play-sheet__subpanel" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}><h2>Sentidos passivos</h2>
          {passiveSkills.map((name) => {
            const skill = skills.find((item) => item.name === name)!
            const expertise = expertiseNames.some((expertiseName) => normalize(expertiseName) === normalize(name))
            const proficient = character.skillProficiencies.includes(name) || expertise
            const jackOfAllTrades = classId === 'bardo' && character.level >= 2 && !proficient ? Math.floor(proficiencyBonus / 2) : 0
            const bonus = proficient ? proficiencyBonus * (expertise ? 2 : 1) : jackOfAllTrades
            return <div className="play-sheet__passive" key={name}><span className="play-sheet__passive-value" style={frameStyle('passiveCircle', frameSvgPaths.passiveCircle)}>{10 + modifier(character.abilities[skill.ability]) + bonus}</span>{name} passiva</div>
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
      {detailsDialog && <Modal open title={detailsDialog === 'initiative' ? 'Iniciativa' : 'Classe de Armadura'} theme={darkMode ? 'dark' : 'light'} onClose={() => setDetailsDialog(null)} footer={<Button onClick={() => setDetailsDialog(null)} variant="secondary">Fechar</Button>}>
        {detailsDialog === 'initiative'
          ? <div className="play-sheet__stat-details">
            <p className="play-sheet__initiative-explanation">No início de todos os combates, você joga sua iniciativa realizando um teste de Destreza. A iniciativa determina a ordem dos turnos das criaturas envolvidas no combate, como descrito no capítulo 9.</p>
            <div className="play-sheet__stat-detail-row"><span>Modificador de Destreza</span><strong>{signed(initiative)}</strong></div>
          </div>
          : <div className="play-sheet__stat-details">
            <p className="play-sheet__armor-class-total">Classe de Armadura atual <strong>{armorClass}</strong></p>
            <div className="play-sheet__armor-class-breakdown">{armorClassBreakdown.map(({ key, label, value }) => <div className="play-sheet__stat-detail-row" key={key}><span>{label}</span><strong>{key === 'base' ? value : signed(value)}</strong></div>)}</div>
            {equippedArmor?.armor && <p className="play-sheet__armor-class-note">{equippedArmor.armor.strength ? `Requisito de Força ${equippedArmor.armor.strength}. ` : ''}{equippedArmor.armor.stealthDisadvantage ? 'Esta armadura impõe desvantagem em Furtividade.' : ''}</p>}
          </div>}
      </Modal>}
      {attackDialog && <Modal open title={`Ataque: ${attackDialog.itemName}`} theme={darkMode ? 'dark' : 'light'} onClose={() => setAttackDialog(null)} footer={<Button onClick={() => setAttackDialog(null)} variant="secondary">Fechar</Button>}>
        <div className="play-sheet__stat-details">
          {attackDialog.finesseModifiers
            ? <>
              <p>Arma com acuidade: o jogador pode escolher Força ou Destreza para o ataque.</p>
              {([
                ['Força', attackDialog.strengthModifier, attackDialog.finesseModifiers.strength],
                ['Destreza', attackDialog.dexterityModifier, attackDialog.finesseModifiers.dexterity],
              ] as const).map(([ability, modifierValue, total]) => <div className="play-sheet__stat-detail-row" key={ability}>
                <span>{ability}: modificador {signed(modifierValue)}{attackDialog.proficient ? ` + proficiência ${signed(attackDialog.proficiencyBonus)}` : ' · sem bônus de proficiência'}</span>
                <strong>{signed(total)}</strong>
              </div>)}
            </>
            : <>
              <p>O bônus de ataque combina o modificador do atributo usado pela arma e, quando há proficiência, o bônus de proficiência.</p>
              <div className="play-sheet__stat-detail-row"><span>Modificador de {attackDialog.ability === 'strength' ? 'Força' : 'Destreza'}</span><strong>{signed(attackDialog.abilityModifier)}</strong></div>
              <div className="play-sheet__stat-detail-row"><span>Bônus de proficiência</span><strong>{attackDialog.proficient ? signed(attackDialog.proficiencyBonus) : 'Não proficiente'}</strong></div>
              <div className="play-sheet__stat-detail-row"><span>Total calculado</span><strong>{signed(attackDialog.abilityModifier + (attackDialog.proficient ? attackDialog.proficiencyBonus : 0))}</strong></div>
            </>}
          {attackDialog.customBonus !== undefined && <div className="play-sheet__stat-detail-row"><span>Bônus de ataque personalizado (substitui o cálculo automático)</span><strong>{signed(attackDialog.customBonus)}</strong></div>}
        </div>
      </Modal>}
    </>
  }

  function renderFeatures() {
    const visibleLevelCount = showFutureClassLevels ? 20 : character.level
    const features = (classData?.features ?? []).filter((feature) => feature.level <= visibleLevelCount)
    const subclassFeatures = (subclass?.features ?? []).filter((feature) => feature.level <= visibleLevelCount)
    const featureEntries = [
      ...features.map((feature) => ({ ...feature, group: characterClass })),
      ...subclassFeatures.map((feature) => ({ ...feature, group: subclass?.name ?? '' })),
    ]
    const featureGroups = new Map<number, typeof featureEntries>()
    for (const feature of featureEntries) {
      featureGroups.set(feature.level, [...(featureGroups.get(feature.level) ?? []), feature])
    }
    const proficiencyBonusAtLevel = (level: number) => `+${2 + Math.floor((level - 1) / 4)}`
    const featureLabel = (feature: typeof featureEntries[number]) => feature.group === characterClass ? feature.name : `${feature.name} — ${feature.group}`

    return <div className="play-sheet__feature-list">
      <FramedGlassPanel className="play-sheet__class-progression" contentClassName="play-sheet__class-progression-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
        <h2>Progressão de {characterClass}</h2>
        <div className="play-sheet__class-progression-table-wrap" role="region" aria-label={`Tabela de progressão de ${characterClass}`} tabIndex={0}>
          <table className="play-sheet__class-progression-table">
            <thead><tr><th scope="col">Nível</th><th scope="col">Bônus de proficiência</th><th scope="col">Características</th></tr></thead>
            <tbody>{Array.from({ length: visibleLevelCount }, (_, index) => index + 1).map((level) => {
              const levelFeatures = featureGroups.get(level) ?? []
              const unavailable = level > character.level
              return <tr aria-current={level === character.level ? 'true' : undefined} aria-disabled={unavailable || undefined} className={unavailable ? 'play-sheet__class-progression-row--unavailable' : undefined} key={level} style={level === character.level ? { backgroundColor: `color-mix(in srgb, ${frameColor} 20%, transparent)` } : undefined}>
                <th scope="row">{level}º</th>
                <td>{proficiencyBonusAtLevel(level)}</td>
                <td>{levelFeatures.length > 0 ? levelFeatures.map((feature, index) => <span key={`${feature.group}-${feature.name}-${index}`}>
                  {index > 0 && ', '}
                  <button className="play-sheet__class-progression-feature-link" onClick={() => document.getElementById(`play-class-level-${level}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} type="button">{featureLabel(feature)}</button>
                </span>) : '—'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </FramedGlassPanel>
      {character.level < 20 && <Button aria-expanded={showFutureClassLevels} className="play-sheet__future-levels-toggle" onClick={() => setShowFutureClassLevels((shown) => !shown)} type="button" variant="secondary">{showFutureClassLevels ? 'Ocultar níveis futuros' : `Ver níveis acima do nível ${character.level}`}</Button>}
      {[...Array.from({ length: visibleLevelCount }, (_, index) => index + 1)].map((level) => {
        const levelFeatures = featureGroups.get(level) ?? []
        const unavailable = level > character.level
        return <FramedGlassPanel aria-disabled={unavailable || undefined} className={`play-sheet__feature-level${unavailable ? ' play-sheet__feature-level--unavailable' : ''}`} contentClassName="play-sheet__feature-level-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor} key={level}>
          <h2 id={`play-class-level-${level}`}>Nível {level}{unavailable && <span className="play-sheet__feature-availability">Ainda não disponível</span>}</h2>
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
          {levelFeatures.length === 0 && <p>Nenhuma característica nova neste nível.</p>}
        </FramedGlassPanel>
      })}
      {featureEntries.length === 0 && <FramedGlassPanel className="play-sheet__feature-level" contentClassName="play-sheet__feature-level-content" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}><h2>Características</h2><p>As características da classe serão exibidas aqui.</p></FramedGlassPanel>}
    </div>
  }

  function renderEquipmentDetails(item: EquipmentItem) {
    const categoryLabel = inventoryCategories.find(({ id }) => id === item.category)?.label ?? 'Gerais'
    const components = item.components?.map(({ itemId, quantity }) => `${catalog?.items.find((candidate) => candidate.id === itemId)?.name ?? itemId}${quantity ? ` × ${quantity}` : ''}`).join(', ')
    return <dl>
      <div><dt>Categoria</dt><dd>{categoryLabel}</dd></div>
      <div><dt>Subcategoria</dt><dd>{item.subcategory}</dd></div>
      {item.rarity && <div><dt>Raridade</dt><dd>{item.rarity}</dd></div>}
      {item.attunement && <div><dt>Sintonização</dt><dd>{item.attunement}</dd></div>}
      <div><dt>Preço</dt><dd>{item.priceCp === null ? 'Variável' : formatPrice(item.priceCp)}</dd></div>
      <div><dt>Peso</dt><dd>{item.weightKg === null ? 'Variável' : `${item.weightKg} kg`}</dd></div>
      <div><dt>Unidade</dt><dd>{item.unit}</dd></div>
      {item.weapon && <>
        <div><dt>Dano</dt><dd>{item.weapon.damage} {item.weapon.damageType}</dd></div>
        <div><dt>Alcance</dt><dd>{item.weapon.range ?? '—'}</dd></div>
      </>}
      {item.armor && <>
        <div><dt>Classe de Armadura</dt><dd>{item.armor.ac}</dd></div>
        <div><dt>Limite de Destreza</dt><dd>{item.armor.dexterity === 'full' ? 'Sem limite' : item.armor.dexterity === 'max2' ? '+2' : 'Sem Destreza'}</dd></div>
        <div><dt>Força necessária</dt><dd>{item.armor.strength ?? 'Nenhuma'}</dd></div>
        <div><dt>Desvantagem em Furtividade</dt><dd>{item.armor.stealthDisadvantage ? 'Sim' : 'Não'}</dd></div>
        <div><dt>Escudo</dt><dd>{item.armor.shield ? 'Sim' : 'Não'}</dd></div>
      </>}
      {item.properties.length > 0 && <div><dt>Propriedades</dt><dd>{item.properties.join(', ')}</dd></div>}
      {item.maxUses !== undefined && <div><dt>Usos máximos</dt><dd>{item.maxUses}</dd></div>}
      {components && <div><dt>Componentes</dt><dd>{components}</dd></div>}
      {item.aliases.length > 0 && <div><dt>Também conhecido como</dt><dd>{item.aliases.join(', ')}</dd></div>}
      <div><dt>Descrição</dt><dd>{item.description || 'Sem descrição.'}</dd></div>
      <div><dt>Página da fonte</dt><dd>{item.sourcePage ?? '—'}</dd></div>
      <div><dt>ID do catálogo</dt><dd>{item.id}</dd></div>
    </dl>
  }

  function renderInventory() {
    const sortInventoryEntries = (entries: InventoryEntry[]) => {
      if (!inventorySort) return entries
      const sortValue = (entry: InventoryEntry): string | number | null => {
        if (inventorySort.key === 'item') return normalize(entry.name)
        const item = entry.itemId ? catalog?.items.find((candidate) => candidate.id === entry.itemId) : undefined
        if (inventorySort.key === 'weight') return item?.weightKg ? item.weightKg * entry.quantity : null
        if (entry.attackBonus !== undefined) return entry.attackBonus
        const attack = getWeaponAttackModifier(item, classId, character.classSubclassId, character.level, strengthModifier, dexterityModifier, proficiencyBonus, Boolean(equippedArmor), Boolean(equippedShield))
        if (!attack) return null
        const finesse = getFinesseWeaponAttackModifiers(item, strengthModifier, dexterityModifier, proficiencyBonus, attack.proficient)
        return finesse ? Math.max(finesse.strength, finesse.dexterity) : attack.modifier
      }
      const direction = inventorySort.direction === 'asc' ? 1 : -1
      return [...entries].sort((left, right) => {
        const leftValue = sortValue(left)
        const rightValue = sortValue(right)
        if (leftValue === null) return rightValue === null ? 0 : 1
        if (rightValue === null) return -1
        const comparison = typeof leftValue === 'string' && typeof rightValue === 'string'
          ? leftValue.localeCompare(rightValue, 'pt-BR')
          : Number(leftValue) - Number(rightValue)
        return comparison * direction
      })
    }
    const storedItems = sortInventoryEntries(inventory.entries.filter((entry) => !entry.equipped && normalize(entry.name).includes(normalize(storedSearch.trim()))))
    const equippedRows = sortInventoryEntries(equippedGear.map(({ entry }) => entry))
    const sortHeading = (label: string, key: InventorySortKey) => {
      const direction = inventorySort?.key === key ? inventorySort.direction : null
      const icon = direction === 'asc' ? 'arrow_upward' : direction === 'desc' ? 'arrow_downward' : 'unfold_more'
      const next = direction === 'asc' ? 'desc' : direction === 'desc' ? null : 'asc'
      return <button aria-label={`Ordenar por ${label}: ${direction === 'asc' ? 'crescente' : direction === 'desc' ? 'decrescente' : 'ordem original'}`} aria-pressed={direction !== null} className="play-sheet__inventory-sort" onClick={() => setInventorySort(next ? { key, direction: next } : null)} type="button"><span>{label}</span><span aria-hidden="true" className="material-symbols-rounded">{icon}</span></button>
    }
    const selectedFeatIds = Object.entries(character.classFeatureChoices)
      .filter(([key]) => key.startsWith('ability-score-increase:') && key.endsWith(':feat'))
      .flatMap(([, selected]) => selected)
    const armorProficiencies = [
      ...(classArmorProficiencies[classId] ?? []),
      ...(classId === 'bardo' && character.level >= 3 && character.classSubclassId === 'colegio-da-bravura' ? ['Armaduras médias'] : []),
      ...(subclass?.features.some((feature) => feature.level <= character.level && normalize(feature.description).includes('armaduras pesadas')) ? ['Armaduras pesadas'] : []),
      ...(normalize(race).includes('anao') ? ['Armaduras leves', 'Armaduras médias'] : []),
      ...selectedFeatIds.flatMap((id) => id === 'protecao-leve'
        ? ['Armaduras leves']
        : id === 'protecao-moderada' ? ['Armaduras médias'] : id === 'protecao-pesada' ? ['Armaduras pesadas'] : []),
    ]
    const itemIsProficient = (item: EquipmentItem | undefined, attack: ReturnType<typeof getWeaponAttackModifier>) => {
      if (attack) return attack.proficient
      if (!item?.armor) return false
      const armorType = normalize(item.armor.shield ? 'Escudos' : item.subcategory)
      return armorProficiencies.some((proficiency) => {
        const normalizedProficiency = normalize(proficiency)
        return normalizedProficiency === 'todas as armaduras' || normalizedProficiency === armorType
      })
    }
    const renderInventoryRow = (entry: InventoryEntry, equipped: boolean) => {
      const item = entry.itemId ? catalog?.items.find((candidate) => candidate.id === entry.itemId) : undefined
      const category = entry.category ?? item?.category ?? 'gear'
      const categoryLabel = inventoryCategories.find(({ id }) => id === category)?.label ?? 'Gerais'
      const attack = getWeaponAttackModifier(item, classId, character.classSubclassId, character.level, strengthModifier, dexterityModifier, proficiencyBonus, Boolean(equippedArmor), Boolean(equippedShield))
      const attackOptions = attack && getFinesseWeaponAttackModifiers(item, strengthModifier, dexterityModifier, proficiencyBonus, attack.proficient)
      const weight = item?.weightKg ? `${item.weightKg * entry.quantity} kg` : '—'
      const highlighted = highlightedInventoryEntries.includes(entry.id)
      const proficient = itemIsProficient(item, attack)
      return <div className="play-sheet__inventory-row" key={entry.id} style={highlighted ? { backgroundColor: `color-mix(in srgb, ${frameColor} 30%, transparent)` } : undefined}>
        <button aria-label={`Ver detalhes de ${entry.name}`} className="play-sheet__inventory-item" onClick={() => setSelectedInventoryEntry(entry)} type="button">
          <span aria-label={categoryLabel} className="play-sheet__category-icon" title={categoryLabel}><span aria-hidden="true" className="material-symbols-rounded">{equipmentCategoryIcon(item, category)}</span></span>
          <strong>{proficient && <span aria-label="Proficiente" className="play-sheet__item-proficient" title="Proficiente" />}<span>{entry.name}</span></strong>
          {item && <small>{item.weapon ? `${item.weapon.damage} ${item.weapon.damageType} · ${item.properties.join(', ')}` : item.armor ? equipmentDetails(item) : item.description || entry.notes}</small>}
        </button>
        {attack ? <button aria-label={`Ver cálculo do ataque de ${entry.name}`} className="play-sheet__inventory-attack-button" onClick={() => setAttackDialog({
          itemName: entry.name,
          ability: attack.ability === 'dexterity' ? 'dexterity' : 'strength',
          abilityModifier: attack.ability === 'dexterity' ? dexterityModifier : strengthModifier,
          strengthModifier,
          dexterityModifier,
          proficient: attack.proficient,
          proficiencyBonus,
          finesseModifiers: attackOptions,
          customBonus: entry.attackBonus,
        })} title="Ver como o bônus de ataque foi calculado" type="button">{entry.attackBonus !== undefined ? signed(entry.attackBonus) : attackOptions ? `${signed(attackOptions.strength)}/${signed(attackOptions.dexterity)}` : signed(attack.modifier)}</button> : <span className="play-sheet__inventory-attack">—</span>}
        <button aria-label={`Alterar quantidade de ${entry.name}: ${entry.quantity}`} className="play-sheet__inventory-quantity" onClick={() => openQuantityDialog(entry)} type="button">{entry.quantity}</button>
        <span>{weight}</span>
        <span className="play-sheet__inventory-actions">
          {equipped
            ? <button onClick={() => toggleEquipped(entry.id)} type="button">Guardar</button>
            : Boolean(entry.itemId) && isEquippable(item)
              ? <button onClick={() => toggleEquipped(entry.id)} type="button">Equipar</button>
              : null}
          {!equipped && <button aria-label={`Excluir ${entry.name}`} className="play-sheet__inventory-delete" onClick={() => setInventoryEntryToDelete(entry)} title={`Excluir ${entry.name}`} type="button"><span aria-hidden="true" className="material-symbols-rounded">delete</span></button>}
        </span>
      </div>
    }
    const filteredEquipment = (catalog?.items ?? []).filter((item) => {
      const matchesCategory = equipmentFilter === 'all' || item.category === equipmentFilter || (equipmentFilter === 'general' && item.category !== 'weapons' && item.category !== 'armor' && item.category !== 'magic')
      return matchesCategory && normalize([item.name, item.subcategory, item.description, ...item.aliases, ...item.properties].join(' ')).includes(normalize(equipmentSearch.trim()))
    })
    return <div className="play-sheet__inventory">
      <FramedGlassPanel className="play-sheet__inventory-frame" contentClassName="play-sheet__inventory-section" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
        <h2>Em uso</h2>
        <div className="play-sheet__inventory-table"><div className="play-sheet__inventory-row play-sheet__inventory-row--heading">{sortHeading('Item', 'item')}{sortHeading('Ataque', 'attack')}<span>Quant.</span>{sortHeading('Peso', 'weight')}<span>Ações</span></div>
          {equippedRows.map((entry) => renderInventoryRow(entry, true))}
          {equippedGear.length === 0 && <p>Nenhum item equipado.</p>}
        </div>
      </FramedGlassPanel>
      <FramedGlassPanel className="play-sheet__inventory-frame" contentClassName="play-sheet__inventory-section" cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor}>
        <header className="play-sheet__inventory-heading"><h2>Guardado</h2><div className="play-sheet__inventory-tools">
        {storedSearchOpen && <input aria-label="Pesquisar equipamentos guardados" onChange={(event) => setStoredSearch(event.target.value)} placeholder="Pesquisar equipamento" ref={storedSearchRef} type="search" value={storedSearch} />}
        <button aria-label={storedSearchOpen ? 'Fechar pesquisa' : 'Pesquisar equipamentos guardados'} onClick={() => { if (storedSearchOpen) { setStoredSearch(''); setStoredSearchOpen(false) } else setStoredSearchOpen(true) }} type="button"><span aria-hidden="true" className="material-symbols-rounded">{storedSearchOpen ? 'close' : 'search'}</span></button>
        <button aria-label="Adicionar equipamento" onClick={() => { setStoredSearch(''); setEquipmentSearch(''); setEquipmentFilter('all'); setEquipmentItemToAdd(null); setEquipmentDrawerOpen(true) }} type="button"><span aria-hidden="true" className="material-symbols-rounded">add</span></button>
        <button aria-label={`Gerenciar dinheiro: ${currencySummary}`} className="play-sheet__currency-balance" onClick={() => setCurrencyDrawerOpen(true)} type="button">
           <span aria-hidden="true" className="play-sheet__currency-balance-items">
             {displayedCurrencies.length ? displayedCurrencies.map(({ code }) => <span className="play-sheet__currency-balance-item" key={code}><img alt="" src={`/images/coins/${code}.png`} />{formatCurrencyAmount(currencyBalances[code])} {code}</span>) : '0 moedas'}
           </span>
         </button>
      </div></header>
        <div className="play-sheet__inventory-table"><div className="play-sheet__inventory-row play-sheet__inventory-row--heading">{sortHeading('Item', 'item')}{sortHeading('Ataque', 'attack')}<span>Quant.</span>{sortHeading('Peso', 'weight')}<span>Ações</span></div>
          {storedItems.map((entry) => renderInventoryRow(entry, false))}
          {storedItems.length === 0 && <p>{storedSearch ? 'Nenhum equipamento encontrado.' : inventory.entries.some((entry) => !entry.equipped) ? 'Nenhum equipamento guardado.' : 'Seu inventário está vazio.'}</p>}
        </div>
      </FramedGlassPanel>
      <dialog aria-label="Adicionar equipamento" className={`play-sheet__equipment-drawer${equipmentDrawerClosing ? ' play-sheet__equipment-drawer--closing' : ''}`} onCancel={(event) => { event.preventDefault(); closeEquipmentDrawer() }} onClose={() => { setEquipmentDrawerOpen(false); setEquipmentDrawerClosing(false); setEquipmentItemToAdd(null) }} onClick={(event) => { if (event.target === event.currentTarget) closeEquipmentDrawer() }} ref={equipmentDrawerRef}>
        <div className="play-sheet__equipment-drawer-content">
          <header><div><h2>{equipmentItemToAdd ? equipmentItemToAdd.name : 'Adicionar equipamento'}</h2><p>{equipmentItemToAdd ? 'Confira os detalhes e informe a quantidade e as anotações.' : 'Escolha um item para adicionar ao inventário.'}</p></div><button aria-label="Fechar painel" onClick={closeEquipmentDrawer} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button></header>
          {equipmentItemToAdd ? <>
            <div className="play-sheet__equipment-item-details">{renderEquipmentDetails(equipmentItemToAdd)}</div>
            <form className="play-sheet__equipment-add-form" onSubmit={(event) => { event.preventDefault(); confirmAddEquipment() }}>
              <label><span>Quantidade</span><input aria-label="Quantidade a adicionar" min="1" step="1" type="number" value={equipmentAddQuantity} onChange={(event) => setEquipmentAddQuantity(event.target.value)} /></label>
              <label><span>Anotações</span><textarea aria-label="Anotações do item" value={equipmentAddNotes} onChange={(event) => setEquipmentAddNotes(event.target.value)} /></label>
              <footer className="play-sheet__equipment-drawer-actions"><button className="play-sheet__equipment-cancel" onClick={() => { setEquipmentItemToAdd(null); setEquipmentAddQuantity('1'); setEquipmentAddNotes('') }} type="button">Cancelar</button><Button className="play-sheet__equipment-confirm" disabled={!Number.isSafeInteger(Number(equipmentAddQuantity)) || Number(equipmentAddQuantity) < 1} type="submit" variant="success">Adicionar Item</Button></footer>
            </form>
          </> : <>
            <label className="play-sheet__equipment-search"><span className="material-symbols-rounded" aria-hidden="true">search</span><input aria-label="Pesquisar no catálogo de equipamentos" onChange={(event) => setEquipmentSearch(event.target.value)} placeholder="Pesquisar equipamento" type="search" value={equipmentSearch} /></label>
            <div aria-label="Filtrar equipamentos" className="play-sheet__equipment-filters">
              {([['all', 'Todos'], ['weapons', 'Armas'], ['armor', 'Armaduras'], ['magic', 'Itens mágicos'], ['general', 'Gerais']] as const).map(([filter, label]) => <button aria-pressed={equipmentFilter === filter} key={filter} onClick={() => setEquipmentFilter(filter)} type="button">{label}</button>)}
            </div>
            <div className="play-sheet__equipment-items">
              {filteredEquipment.map((item) => <article key={item.id}><span><strong>{item.name}</strong><span>{item.weapon ? `${item.weapon.damage} ${item.weapon.damageType}${item.properties.length ? ` · ${item.properties.join(', ')}` : ''}` : item.armor ? `CA ${item.armor.ac}${item.armor.shield ? '' : item.armor.dexterity === 'none' ? '' : ' + Destreza'}` : item.subcategory}</span><small>{item.weightKg ? `${item.weightKg} kg` : 'Peso variável'} · {item.priceCp === null ? 'Preço variável' : `${(item.priceCp / 100).toFixed(item.priceCp % 100 ? 2 : 0)} po`}</small></span><button aria-label={`Ver detalhes de ${item.name}`} onClick={() => { setEquipmentAddQuantity('1'); setEquipmentAddNotes(''); setEquipmentItemToAdd(item) }} type="button"><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button></article>)}
              {equipmentLoading && <p role="status">Carregando equipamentos…</p>}
              {equipmentError && <p role="alert">Não foi possível carregar o catálogo de equipamentos. <button onClick={retryEquipment} type="button">Tentar novamente</button></p>}
              {catalog && !filteredEquipment.length && <p>Nenhum item encontrado.</p>}
            </div>
          </>}
        </div>
      </dialog>
      {currencyDrawerOpen && <CurrencyManagementDrawer initialCurrencyCp={inventory.currencyCp} initialCurrencyBalances={inventory.currencyBalances} onClose={() => setCurrencyDrawerOpen(false)} onSave={(currencyCp, currencyBalances) => persistInventory({ ...inventory, currencyCp, currencyBalances }, { success: 'Saldo de moedas atualizado.', error: 'Não foi possível salvar o saldo de moedas. Tente novamente.' })} theme={darkMode ? 'dark' : 'light'} />}
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
        <div className="play-sheet__spell-actions"><span>{level}</span><button className="play-sheet__spell-cast-button" disabled={!canCast} onClick={() => openCastDialog(name, spellLevel)} title={canCast ? 'Conjurar magia' : 'Sem espaços disponíveis deste nível ou superiores'} type="button">Conjurar{spellCastAnimation?.name === name && <SpellCastAnimation key={spellCastAnimation.id} onComplete={() => finishSpellCastAnimation(spellCastAnimation.id)} />}</button></div>
      </li>
    }
    return <div className="play-sheet__spell-list">
      <section aria-label="Habilidade de conjuração" className="play-sheet__spell-stats">
        <div className="play-sheet__spell-stat">
          <div aria-hidden="true" className="play-sheet__spell-stat-glass" />
          <div aria-hidden="true" className="play-sheet__spell-stat-frame" style={frameStyle('spellAbility', frameSvgPaths.spellAbility)} />
          <span className="play-sheet__spell-stat-label">HABIL.</span><strong>{spellcastingAbility?.[2] ?? '—'}</strong>
        </div>
        <div className="play-sheet__spell-stat">
          <div aria-hidden="true" className="play-sheet__spell-stat-glass" />
          <div aria-hidden="true" className="play-sheet__spell-stat-frame" style={frameStyle('spellAbility', frameSvgPaths.spellAbility)} />
          <span className="play-sheet__spell-stat-label">CD</span><strong>{spellSaveDc}</strong>
        </div>
        <div className="play-sheet__spell-stat">
          <div aria-hidden="true" className="play-sheet__spell-stat-glass" />
          <div aria-hidden="true" className="play-sheet__spell-stat-frame" style={frameStyle('spellAbility', frameSvgPaths.spellAbility)} />
          <span className="play-sheet__spell-stat-label">ATK</span><strong>{spellAttackBonus}</strong>
        </div>
      </section>
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
    return <CharacterAbout background={background} backgroundImages={backgroundImages} backgroundPreview={backgroundPreview} character={character} cornerSvg={frameSvgs.corner ?? ''} frameColor={frameColor} onDarkModeChange={updateDarkMode} onDeleteBackground={onDeleteBackground} onFrameColorClick={openFrameColorDialog} onLoadBackgrounds={onLoadBackgrounds} onPreviewBackground={setBackgroundPreview} onSave={(changes) => save({ ...character, ...changes }, playState, { success: 'Informações da ficha atualizadas.' })} onSaveBackground={(changes) => save({ ...character, ...changes }, playState, {
      success: 'Plano de fundo da ficha atualizado.',
      error: 'Não foi possível atualizar o plano de fundo da ficha. Tente novamente.',
    })} onUploadBackground={onUploadBackground} onUploadPortrait={onUploadPortrait} portrait={portrait} theme={darkMode ? 'dark' : 'light'} />
  }

  return <main className={`play-sheet${darkMode ? ' play-sheet--dark' : ''}`}>
    <header className="play-sheet__character-bar" style={{ borderBottom: `2px solid ${frameColor}` }}>
      <div className="play-sheet__character-bar-inner">
        <div className="play-sheet__identity">
          <button aria-label="Voltar à lista de personagens" className="play-sheet__back" onClick={onBack} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H5m7 7-7-7 7-7" /></svg></button>
          <span className="play-sheet__portrait">{portrait ? <img alt={`Retrato de ${character.name}`} src={portrait} /> : <span aria-hidden="true" className="play-sheet__portrait-placeholder">✦</span>}</span>
          <div><h1>{character.name}</h1><p>{race} · {background} · {characterClass}</p></div>
        </div>
        <ExperienceBar experiencePoints={Number(character.experiencePoints) || 0} level={character.level} onClick={() => setExperienceDialogOpen(true)} />
        <div className="play-sheet__hp-controls">
          <Button aria-label="Opções de descanso" className="play-sheet__rest-trigger play-sheet__nav-action" onClick={openRestDrawer} size="icon" title="Descansar" variant="secondary"><span aria-hidden="true" className="material-symbols-rounded">hotel</span></Button>
          <Button aria-label={activeConditionNames.length ? `Condições marcadas: ${activeConditionNames.join(', ')}` : 'Condições'} className={`play-sheet__conditions-trigger play-sheet__nav-action${activeConditionNames.length ? ' play-sheet__conditions-trigger--active' : ''}`} data-tooltip={activeConditionNames.length ? activeConditionNames.join(', ') : undefined} disabled={conditionSavePending} onClick={openConditionsDialog} size="icon" variant="secondary">
            <span aria-hidden="true" className="material-symbols-rounded">{currentConditionIcon}</span>
            {activeConditionNames.length > 0 && <span aria-label={`${activeConditionNames.length} condições ativas`} className="play-sheet__condition-count">{activeConditionNames.length}</span>}
          </Button>
          {playState.currentHp === 0 && (playState.deathSaveSuccesses?.filter(Boolean).length ?? 0) < 3
            ? <button aria-label="Testes de resistência contra a morte. Abrir controles" className="play-sheet__death-save-card" onClick={openDeathSaveDialog} type="button">
               <span className="play-sheet__death-save-row"><strong>SUCESSO</strong><span aria-hidden="true" className="play-sheet__death-save-marks">{Array.from({ length: 3 }, (_, index) => <i className={playState.deathSaveSuccesses?.[index] ? 'play-sheet__death-save-mark play-sheet__death-save-mark--success' : 'play-sheet__death-save-mark'} key={index} />)}</span></span>
               <span className="play-sheet__death-save-row"><strong>FALHA</strong><span aria-hidden="true" className="play-sheet__death-save-marks">{Array.from({ length: 3 }, (_, index) => <i className={playState.deathSaveFailures?.[index] ? 'play-sheet__death-save-mark play-sheet__death-save-mark--failure' : 'play-sheet__death-save-mark'} key={index} />)}</span></span>
          </button>
             : <button aria-label={`Pontos de vida: ${playState.currentHp}${playState.temporaryHp ? ` mais ${playState.temporaryHp} temporários` : ''} de ${maxHp}. Abrir controles de PV`} className="play-sheet__hp-card" onClick={openHpDialog} type="button">
               <span className="play-sheet__hp-card-title">PONTOS DE VIDA</span>
               <span className="play-sheet__hp-card-values"><strong>{playState.currentHp}</strong>{playState.temporaryHp > 0 && <> + <strong className="play-sheet__hp-temporary-value">{playState.temporaryHp}</strong></>} <span>/ {maxHp}</span></span>
               <span aria-hidden="true" className="play-sheet__hp-meter"><span className="play-sheet__hp-meter-current" style={{ width: `${maxHp > 0 ? Math.min(playState.temporaryHp > 0 ? 78 : 100, playState.currentHp / maxHp * (playState.temporaryHp > 0 ? 78 : 100)) : 0}%` }} /><span className="play-sheet__hp-meter-temporary" style={{ width: `${playState.temporaryHp > 0 ? Math.max(16, Math.min(22, playState.temporaryHp / Math.max(1, maxHp) * 100)) : 0}%` }} /></span>
             </button>}
        </div>
      </div>
    </header>
    <div aria-hidden="true" className="play-sheet__hero">
      <img className="play-sheet__backdrop" src={backgroundPreview} />
    </div>
    <div className="play-sheet__paper">
      <nav aria-label="Seções da ficha" className="play-sheet__tabs" role="tablist">
        <div className="play-sheet__tabs-inner">
          {tabs.map((tab, index) => <button aria-selected={activeTab === tab} className={activeTab === tab ? 'play-sheet__tab play-sheet__tab--active' : 'play-sheet__tab'} key={tab} onClick={() => sheetSwiperRef.current?.slideTo(index)} role="tab" type="button"><span aria-hidden="true" className="material-symbols-rounded">{tabIcons[tab]}</span>{tab}</button>)}
        </div>
      </nav>
      <Swiper
        autoHeight
        className="play-sheet__content"
        initialSlide={tabs.indexOf(activeTab)}
        noSwipingSelector="button, a, input, select, textarea, [role='dialog'], .play-sheet__inventory-table"
        onSlideChange={(swiper) => {
          setActiveTab(tabs[swiper.activeIndex])
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onSlideChangeTransitionEnd={(swiper) => swiper.updateAutoHeight(0)}
        onSwiper={(swiper) => { sheetSwiperRef.current = swiper }}
        speed={300}
      >
        <SwiperSlide><div className="play-sheet__tab-content">{renderAbilities()}</div></SwiperSlide>
        <SwiperSlide><div className="play-sheet__tab-content">{renderFeatures()}</div></SwiperSlide>
        <SwiperSlide><div className="play-sheet__tab-content">{renderInventory()}</div></SwiperSlide>
        <SwiperSlide><div className="play-sheet__tab-content">{renderSpells()}</div></SwiperSlide>
        <SwiperSlide><div className="play-sheet__tab-content">{renderAbout()}</div></SwiperSlide>
      </Swiper>
    </div>
    {experienceDialogOpen && <ExperienceDialog experiencePoints={Number(character.experiencePoints) || 0} theme={darkMode ? 'dark' : 'light'} onCancel={() => setExperienceDialogOpen(false)} onConfirm={saveExperience} />}
    {levelUpTarget && <LevelUpDrawer character={character} classData={classData} classId={classId} race={race} targetExperience={levelUpTarget.experience} targetLevel={levelUpTarget.level} theme={darkMode ? 'dark' : 'light'} onCancel={() => setLevelUpTarget(null)} onComplete={() => setLevelUpTarget(null)} onConfirm={(next) => save(next, { ...playState })} />}
    {restDrawerOpen && <Modal open title="Descansos" theme={darkMode ? 'dark' : 'light'} onClose={closeRestDrawer} variant="drawer" footer={<>
      <Button disabled={restSaving} onClick={closeRestDrawer} variant="secondary">Cancelar</Button>
      <Button disabled={restSaving || selectedRestType === null} onClick={() => void confirmRest()}>{restSaving ? 'Descansando…' : 'Descansar'}</Button>
    </>}>
      <div className="play-sheet__rest-modal">
        <fieldset aria-label="Tipo de descanso" className="play-sheet__rest-options" disabled={restSaving}>
          <label className={`play-sheet__rest-option${selectedRestType === 'short' ? ' play-sheet__rest-option--selected' : ''}`}>
            <input checked={selectedRestType === 'short'} name="rest-type" onChange={() => setSelectedRestType('short')} type="radio" />
            <span className="play-sheet__rest-option-copy">
              <strong>Descanso curto</strong>
              <span>Descanse por pelo menos 1 hora, fazendo apenas atividades leves. Bruxos também recuperam espaços de magia de pacto.</span>
            </span>
          </label>
          <label className={`play-sheet__rest-option${selectedRestType === 'long' ? ' play-sheet__rest-option--selected' : ''}`}>
            <input checked={selectedRestType === 'long'} name="rest-type" onChange={() => setSelectedRestType('long')} type="radio" />
            <span className="play-sheet__rest-option-copy">
              <strong>Descanso longo</strong>
              <span>Descanse por pelo menos 8 horas; sono e atividades leves são permitidos por até 2 horas. Se uma atividade extenuante interromper o descanso por 1 hora ou mais, ele recomeça.</span>
              <small>Recupera PV, remove PV temporários, restaura espaços de magia e recupera Dados de Vida.</small>
            </span>
          </label>
        </fieldset>
        {selectedRestType === 'short' && <section aria-label="Dados de Vida para gastar no descanso curto" className="play-sheet__rest-hit-dice">
          <h3>Dados de Vida</h3>
          <p>Você tem {availableHitDice} de {totalHitDice} Dados de Vida disponíveis · d{hitDieSize}.</p>
          <div aria-label="Dados de Vida a gastar" className="play-sheet__hp-adjuster play-sheet__rest-hit-dice-adjuster">
            <button aria-label="Gastar um Dado de Vida a menos" disabled={restSaving || shortRestDiceCount <= 0} onClick={() => setShortRestDiceCount((count) => Math.max(0, count - 1))} type="button">−</button>
            <div aria-live="polite" className="play-sheet__rest-hit-dice-value"><strong>{shortRestDiceCount}</strong><span>/ {availableHitDice}</span></div>
            <button aria-label="Gastar um Dado de Vida a mais" disabled={restSaving || shortRestDiceCount >= availableHitDice} onClick={() => setShortRestDiceCount((count) => Math.min(availableHitDice, count + 1))} type="button">+</button>
          </div>
          <p className="play-sheet__hit-dice-instructions">Role manualmente cada d{hitDieSize} e some seu modificador de Constituição. A ficha apenas registra os Dados de Vida gastos; ela não rola os dados nem altera seus PV. Atualize os PV depois, se necessário.</p>
        </section>}
      </div>
    </Modal>}
    {spellPreparationPromptOpen && <Modal open title="Preparar magias" theme={darkMode ? 'dark' : 'light'} onClose={() => setSpellPreparationPromptOpen(false)} footer={<>
      <Button onClick={() => setSpellPreparationPromptOpen(false)} variant="secondary">Manter magias</Button>
      <Button onClick={openSpellPreparationDrawer}>Preparar novamente</Button>
    </>}>
      <p>Deseja escolher novamente as magias preparadas para este personagem?</p>
    </Modal>}
    {spellPreparationDrawerOpen && <Modal open title="Preparar magias" theme={darkMode ? 'dark' : 'light'} onClose={() => { if (!spellPreparationSaving) setSpellPreparationDrawerOpen(false) }} variant="drawer" showHeader={false}>
      <div className="play-sheet__spell-preparation-drawer">
        <header>
          <div><h2>Preparar magias</h2><p>Escolha até {spellPreparationLimit ?? 0} magias. Selecionadas: {spellPreparationDraft.length}/{spellPreparationLimit ?? 0}.</p></div>
          <button aria-label="Fechar painel de preparação" disabled={spellPreparationSaving} onClick={() => setSpellPreparationDrawerOpen(false)} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button>
        </header>
        <div aria-label="Filtrar magias por nível" className="play-sheet__spell-preparation-filters" role="group">
          <button aria-pressed={spellPreparationLevelFilter === null} className={spellPreparationLevelFilter === null ? 'play-sheet__spell-preparation-filter play-sheet__spell-preparation-filter--active' : 'play-sheet__spell-preparation-filter'} onClick={() => setSpellPreparationLevelFilter(null)} type="button">Todos</button>
          {spellSlots.map((count, index) => count > 0 && <button aria-pressed={spellPreparationLevelFilter === index + 1} className={spellPreparationLevelFilter === index + 1 ? 'play-sheet__spell-preparation-filter play-sheet__spell-preparation-filter--active' : 'play-sheet__spell-preparation-filter'} key={index} onClick={() => setSpellPreparationLevelFilter(index + 1)} type="button">{index + 1}º nível</button>)}
        </div>
        <div aria-label="Magias disponíveis" className="play-sheet__spell-preparation-options">
          {spellPreparationOptions.filter(({ level }) => spellPreparationLevelFilter === null || level === spellPreparationLevelFilter).map(({ name, level }) => {
            const details = getSpellDetails(name)
            const checked = spellPreparationDraft.includes(name)
            return <label className="play-sheet__spell-preparation-option" key={`${level}-${name}`}>
              <input checked={checked} disabled={spellPreparationSaving || (!checked && spellPreparationDraft.length >= (spellPreparationLimit ?? 0))} onChange={() => togglePreparedSpell(name)} type="checkbox" />
              <span><strong>{name} · {level}º nível</strong>{details && <><small>Conjuração: {details.castingTime} · Alcance: {details.range}</small><small>Componentes: {details.components} · Duração: {details.duration}</small></>}</span>
            </label>
          })}
        </div>
        <footer><Button disabled={spellPreparationSaving} onClick={() => setSpellPreparationDrawerOpen(false)} variant="secondary">Cancelar</Button><Button disabled={!spellPreparationDraft.length || spellPreparationSaving} onClick={() => void confirmSpellPreparation()}>{spellPreparationSaving ? 'Salvando…' : 'Confirmar seleção'}</Button></footer>
      </div>
    </Modal>}
    {conditionsDialogOpen && <Modal open title="Condições" theme={darkMode ? 'dark' : 'light'} onClose={closeConditionsDialog} variant="wide" footer={<Button disabled={conditionSavePending} onClick={closeConditionsDialog} variant="secondary">Concluir</Button>}>
      <div aria-busy={conditionSavePending} className="play-sheet__conditions-list">{conditions.map(([name, icon, description]) => <label className="play-sheet__condition-option" key={name}>
        <input aria-label={`Marcar condição ${name}`} checked={conditionDraftNames.includes(name)} disabled={conditionSavePending || (name === 'Inconsciente' && playState.currentHp === 0)} onChange={() => toggleActiveCondition(name)} type="checkbox" />
        <span aria-hidden="true" className="material-symbols-rounded">{icon}</span>
        <span className="play-sheet__condition-option-text"><strong>{name}</strong><small>{description}</small></span>
      </label>)}</div>
    </Modal>}
    {selectedInventoryEntry && <Modal open title={selectedInventoryEntry.name} theme={darkMode ? 'dark' : 'light'} onClose={() => setSelectedInventoryEntry(null)} footer={<Button onClick={() => setSelectedInventoryEntry(null)} variant="secondary">Fechar</Button>} variant="drawer">
      <div className="play-sheet__inventory-details">
        <dl>
          <div><dt>Quantidade no inventário</dt><dd>{selectedInventoryEntry.quantity}</dd></div>
          <div><dt>Peso total</dt><dd>{catalog?.items.find((item) => item.id === selectedInventoryEntry.itemId)?.weightKg !== null && catalog?.items.find((item) => item.id === selectedInventoryEntry.itemId)?.weightKg !== undefined ? `${catalog.items.find((item) => item.id === selectedInventoryEntry.itemId)!.weightKg! * selectedInventoryEntry.quantity} kg` : 'Variável'}</dd></div>
          <div><dt>Estado</dt><dd>{selectedInventoryEntry.equipped ? 'Em uso' : 'Guardado'}</dd></div>
          <div><dt>Origem</dt><dd>{selectedInventoryEntry.sourceLabel}</dd></div>
          {selectedInventoryEntry.notes && <div><dt>Anotações</dt><dd>{selectedInventoryEntry.notes}</dd></div>}
          {selectedInventoryEntry.attackBonus !== undefined && <div><dt>Bônus de ataque personalizado</dt><dd>{signed(selectedInventoryEntry.attackBonus)}</dd></div>}
          {selectedInventoryEntry.remainingUses !== undefined && <div><dt>Usos restantes</dt><dd>{selectedInventoryEntry.remainingUses}</dd></div>}
        </dl>
        {catalog?.items.find((item) => item.id === selectedInventoryEntry.itemId)
          ? renderEquipmentDetails(catalog.items.find((item) => item.id === selectedInventoryEntry.itemId)!)
          : <p>Os detalhes do catálogo não estão disponíveis para este item.</p>}
      </div>
    </Modal>}
    {quantityDialog && <Modal open title={`Quantidade de ${quantityDialog.name}`} theme={darkMode ? 'dark' : 'light'} onClose={() => setQuantityDialog(null)} footer={<><Button onClick={confirmInventoryQuantity} variant={quantityDraft === 0 ? 'danger' : 'primary'}>{quantityDraft === 0 ? 'Excluir item' : 'Concluir'}</Button><Button onClick={() => setQuantityDialog(null)} variant="secondary">Cancelar</Button></>}>
      <div className="play-sheet__quantity-adjuster">
        <button aria-label="Diminuir quantidade" onClick={() => setQuantityDraft((current) => Math.max(0, current - 1))} type="button">−</button>
        <strong aria-live="polite" className="play-sheet__quantity-value">{quantityDraft}</strong>
        <button aria-label="Aumentar quantidade" onClick={() => setQuantityDraft((current) => current + 1)} type="button">+</button>
      </div>
    </Modal>}
    {inventoryEntryToDelete && <Modal open title="Excluir item?" theme={darkMode ? 'dark' : 'light'} onClose={() => setInventoryEntryToDelete(null)} footer={<><Button onClick={confirmDeleteInventoryEntry} variant="danger">Excluir</Button><Button onClick={() => setInventoryEntryToDelete(null)} variant="secondary">Cancelar</Button></>}>
      <p>O item “{inventoryEntryToDelete.name}” será removido do inventário.</p>
    </Modal>}
    {hpDialogOpen && <Modal open title="Pontos de vida" theme={darkMode ? 'dark' : 'light'} onClose={cancelHpDialog} footer={<><Button className="play-sheet__hp-cancel" onClick={cancelHpDialog} variant="secondary">Cancelar</Button><Button onClick={() => void confirmHpDialog()}>Concluir</Button></>}>
      <div className="play-sheet__hp-dialog">
        <div className="play-sheet__hp-adjuster">
          <button aria-label="Diminuir pontos de vida; segure para diminuir de cinco em cinco" onClick={() => { if (hpHoldTriggeredRef.current) { hpHoldTriggeredRef.current = false; return } changeHpByButtons(-1) }} onPointerCancel={stopHpButtonHold} onPointerDown={() => startHpButtonHold(-1)} onPointerLeave={stopHpButtonHold} onPointerUp={stopHpButtonHold} type="button">−</button>
          <div aria-live="polite" className="play-sheet__hp-current-value">{hpAdjustmentVisible && hpAdjustment !== 0 && <small className={`play-sheet__hp-adjustment${hpAdjustment > 0 ? ' play-sheet__hp-adjustment--positive' : ' play-sheet__hp-adjustment--negative'}`}>{hpAdjustment > 0 ? '+' : ''}{hpAdjustment}</small>}<span className="play-sheet__hp-current-total"><strong>{hpDraft.currentHp}</strong>{hpDraft.temporaryHp > 0 && <span className="play-sheet__hp-temporary-value">+{hpDraft.temporaryHp}</span>}<span> / {maxHp}</span></span></div>
          <button aria-label="Aumentar pontos de vida; segure para aumentar de cinco em cinco" disabled={hpDraft.currentHp >= maxHp && !canRestoreTemporaryHp} onClick={() => { if (hpHoldTriggeredRef.current) { hpHoldTriggeredRef.current = false; return } changeHpByButtons(1) }} onPointerCancel={stopHpButtonHold} onPointerDown={() => startHpButtonHold(1)} onPointerLeave={stopHpButtonHold} onPointerUp={stopHpButtonHold} type="button">+</button>
        </div>
        <div aria-hidden="true" className="play-sheet__hp-divider" />
        <div className="play-sheet__hp-actions">
          <Button className="play-sheet__hp-damage" disabled={!Number(hpAmount) || Number(hpAmount) <= 0} onClick={() => applyHpAmount(applyHitPointDamage)} variant="danger">Dano</Button>
          <input aria-label="Quantidade de pontos de vida" min="1" onChange={(event) => setHpAmount(event.target.value)} type="number" value={hpAmount} />
          <Button className="play-sheet__hp-heal" disabled={!Number(hpAmount) || Number(hpAmount) <= 0} onClick={() => applyHpAmount((current, amount) => healHitPoints(current, amount, maxHp))} variant="success">Curar</Button>
          <Button className="play-sheet__hp-temporary" disabled={!Number(hpAmount) || Number(hpAmount) <= 0} onClick={() => applyHpAmount(setTemporaryHitPoints)} variant="secondary">Definir PV temporários</Button>
          <p className="play-sheet__hp-rule">O dano reduz primeiro os PV temporários. A cura não ultrapassa o máximo de PV.</p>
        </div>
      </div>
    </Modal>}
    {deathSaveDialogOpen && <Modal open title="Testes de resistência contra a morte" theme={darkMode ? 'dark' : 'light'} onClose={() => { if (!deathSaveSaving) setDeathSaveDialogOpen(false) }} footer={<><Button disabled={deathSaveSaving} onClick={() => setDeathSaveDialogOpen(false)} variant="secondary">Cancelar</Button><Button disabled={deathSaveSaving} onClick={() => void confirmDeathSaveDialog()}>{deathSaveSaving ? 'Salvando…' : 'Concluir'}</Button></>}>
      <div className="play-sheet__death-save-dialog">
        {(['successes', 'failures'] as const).map((kind) => <fieldset className={`play-sheet__death-save-checks play-sheet__death-save-checks--${kind}`} key={kind}>
          <legend>{kind === 'successes' ? 'SUCESSO' : 'FALHA'}</legend>
          <div>{deathSaveDraft[kind].map((checked, index) => <label aria-label={`${kind === 'successes' ? 'Sucesso' : 'Falha'} ${index + 1}`} key={index}>
            <input checked={checked} onChange={() => toggleDeathSave(kind, index)} type="checkbox" />
            <span aria-hidden="true" />
          </label>)}</div>
        </fieldset>)}
        <div className="play-sheet__death-save-heal">
          <input aria-label="Quantidade de pontos de vida para curar" inputMode="numeric" onChange={(event) => setDeathSaveHealAmount(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyDeathSaveHealing() } }} placeholder="Quantidade para curar" type="text" value={deathSaveHealAmount} />
          <Button className="play-sheet__death-save-heal-button" disabled={!Number.isFinite(Number(deathSaveHealAmount)) || Number(deathSaveHealAmount) <= 0 || deathSaveSaving} onClick={applyDeathSaveHealing} variant="success">Curar</Button>
          {deathSaveDraft.currentHp > 0 && <small aria-live="polite" className="play-sheet__death-save-heal-preview">PV após concluir: {deathSaveDraft.currentHp}/{maxHp}</small>}
        </div>
        <aside className="play-sheet__death-save-rules">
          <p><strong>Rolando 1 ou 20.</strong> Um 1 no d20 marca duas falhas; um 20 recupera 1 ponto de vida.</p>
          <p><strong>Sofrendo dano com 0 PV.</strong> O dano marca uma falha; um acerto crítico marca duas. Dano igual ou maior que o máximo de PV causa morte instantânea.</p>
        </aside>
      </div>
    </Modal>}
    {frameColorDialogOpen && <FrameColorDialog frameColor={frameColor} frameSvg={frameSvgs.ability} landscape={backgroundPreview} theme={darkMode ? 'dark' : 'light'} onCancel={() => setFrameColorDialogOpen(false)} onConfirm={(color) => { updateFrameColor(color); setFrameColorDialogOpen(false) }} />}
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
