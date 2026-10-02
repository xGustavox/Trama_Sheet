import { useEffect, useRef, useState } from 'react'
import { getEffectiveAbilityScores, type CharacterDetails, type LevelUpHistoryEntry, type PrimalPath, type PrimalTotemChoices } from '../lib/characterData'
import { classArmorProficiencies } from '../lib/classArmorProficiencies'
import { classFeatures, classHitDice, getNewlyKnownSpellCountAtClassLevel, getSpellSlotsAtClassLevel, planWarlockInvocationChoices, rebaseClassFeatureChoicesForSubclass, type ClassFeatureData } from '../lib/classFeatures'
import { experienceThresholds, formatExperienceInput, hasConfirmedAbilityIncrease, hitPointGainForLevel, levelForExperience, parseExperienceInput } from '../lib/experience'
import { feats, getFeatAbilityBonus, getFeatPrerequisiteFailure, type Feat } from '../lib/feats'
import { ancientSecretsRitualChoiceKey, isValidAncientSecretsRitualSelection, isValidPactTomeCantripSelection, pactTomeCantripCount, warlockPactChoiceKey, warlockTomeCantripChoiceKey } from '../lib/pactTome'
import { Button } from './Button'
import { Modal } from './Modal'
import { cantripsByClass, getAllSpellOptions, getGrantedClassCantrips, getRitualSpellOptions, getSpellLevel, getSpellListForSelection } from '../lib/spellCatalog'
import { filterKnownSpellOptions } from '../lib/spellSelection'
import type { SpellOption } from './SpellSelectionDrawer'
import './CharacterExperience.css'

type LevelUpListOption = { id: string; name: string; detail?: string; description?: string; disabled?: boolean; filters?: string[] }
type LevelUpListPanel = {
  title: string
  description: string
  options: LevelUpListOption[]
  selectionCount: number
  minimumSelectionCount?: number
  selected: string[]
  filters?: { id: string; label: string }[]
  apply: (selected: string[]) => LevelUpListPanel | null
}

const abilityOptions = [
  ['strength', 'Força'],
  ['dexterity', 'Destreza'],
  ['constitution', 'Constituição'],
  ['intelligence', 'Inteligência'],
  ['wisdom', 'Sabedoria'],
  ['charisma', 'Carisma'],
] as const

const listFilterClasses = [
  ['bardo', 'Bardo'], ['bruxo', 'Bruxo'], ['clerigo', 'Clérigo'], ['druida', 'Druida'], ['feiticeiro', 'Feiticeiro'], ['mago', 'Mago'],
] as const

function formatExperience(value: number) {
  return Math.max(0, value).toLocaleString('pt-BR')
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function readWizardSpellbook(value: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    const record = parsed as { knownSpells?: unknown; spells?: unknown }
    if (Array.isArray(record.knownSpells)) return record.knownSpells.filter((name): name is string => typeof name === 'string')
    if (record.spells && typeof record.spells === 'object') {
      return Object.values(record.spells as Record<string, unknown>).flatMap((names) => Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : [])
    }
  } catch {
    return []
  }
  return []
}

function readStoredSpellData(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) return { cantrips: parsed.filter((name): name is string => typeof name === 'string') }
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function readSpellNameArray(data: Record<string, unknown>, key: string) {
  const value = data[key]
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : []
}

function readSavedSpellNames(value: string) {
  const data = readStoredSpellData(value)
  const storedLevels = data.spells && typeof data.spells === 'object' ? Object.values(data.spells as Record<string, unknown>) : []
  return [...readSpellNameArray(data, 'knownSpells'), ...readSpellNameArray(data, 'bonusSpells'), ...readSpellNameArray(data, 'cantrips'), ...readSpellNameArray(data, 'bonusCantrips'), ...storedLevels.flatMap((names) => Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : [])]
}

export function ExperienceBar({
  experiencePoints,
  level,
  hasPendingChoices = false,
  onClick,
}: {
  experiencePoints: number
  level: number
  hasPendingChoices?: boolean
  onClick: () => void
}) {
  const threshold = experienceThresholds[Math.min(level, experienceThresholds.length - 1)]
  const progress = level >= 20 ? 100 : Math.min(100, (experiencePoints / threshold) * 100)

  return <button aria-label={`Experiência: nível ${level}, ${formatExperience(experiencePoints)} de ${formatExperience(threshold)} XP.${hasPendingChoices ? ' Há escolhas de nível pendentes.' : ''} Abrir controles de experiência`} className={`play-sheet__experience-bar${hasPendingChoices ? ' play-sheet__experience-bar--pending' : ''}`} onClick={onClick} type="button">
    <span className="play-sheet__experience-labels">
      <span className="play-sheet__experience-current-level"><span className="play-sheet__experience-prefix-full">Level</span><span className="play-sheet__experience-prefix-mobile">Lv.</span> <strong>{level}</strong></span>
      <span className="play-sheet__experience-values"><span className="play-sheet__experience-total-full"><strong>{formatExperience(experiencePoints)}</strong> / <span>{formatExperience(threshold)}</span></span><span className="play-sheet__experience-total-mobile"><strong>{formatExperience(experiencePoints)} XP</strong></span></span>
      <span className="play-sheet__experience-next-level">{level >= 20 ? 'Max Level' : `Level ${level + 1}`}</span>
    </span>
    <span aria-label={`${Math.round(progress)}% até o próximo nível`} aria-valuemax={threshold} aria-valuemin={0} aria-valuenow={Math.min(experiencePoints, threshold)} className="play-sheet__experience-meter" role="progressbar">
      <span style={{ width: `${progress}%` }} />
    </span>
  </button>
}

export function ExperienceDialog({
  experiencePoints,
  theme = 'light',
  onCancel,
  onConfirm,
}: {
  experiencePoints: number
  theme?: 'light' | 'dark'
  onCancel: () => void
  onConfirm: (experiencePoints: number) => Promise<boolean>
}) {
  const [draftPoints, setDraftPoints] = useState(String(experiencePoints))
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const parsedDraftPoints = Number(draftPoints)
  const draftIsValid = draftPoints !== '' && Number.isSafeInteger(parsedDraftPoints) && parsedDraftPoints >= 0
  const currentPoints = draftIsValid ? parsedDraftPoints : 0
  const parsedAmount = Number(amount)
  const amountIsValid = amount !== '' && Number.isSafeInteger(parsedAmount) && parsedAmount > 0
  const currentLevel = levelForExperience(currentPoints)
  const nextLevelThreshold = experienceThresholds[currentLevel]

  function adjustExperience(direction: -1 | 1) {
    if (!draftIsValid || !amountIsValid) return
    setDraftPoints(String(Math.max(0, currentPoints + direction * parsedAmount)))
    setAmount('')
  }

  async function confirm() {
    if (!draftIsValid || saving) return
    setSaving(true)
    const saved = await onConfirm(currentPoints)
    setSaving(false)
    if (saved) onCancel()
  }

  return <Modal open title="Gerenciar pontos de experiência" theme={theme} onClose={() => { if (!saving) onCancel() }} footer={<div className="play-sheet__experience-footer"><Button disabled={saving} onClick={onCancel} variant="secondary">Cancelar</Button><Button disabled={!draftIsValid || saving} onClick={() => void confirm()}>{saving ? 'Salvando…' : 'Concluir'}</Button></div>}>
    <div className="play-sheet__experience-dialog">
      <div className="play-sheet__experience-summary">
        <output aria-label="Pontos de experiência atuais" className="play-sheet__experience-total-value">{formatExperienceInput(currentPoints)}</output>
        <p aria-live="polite" className="play-sheet__experience-current">{!draftIsValid ? 'Informe um valor inteiro de XP igual ou maior que zero.' : nextLevelThreshold === undefined ? 'Nível máximo alcançado.' : `Faltam ${formatExperience(nextLevelThreshold - currentPoints)} XP para o nível ${currentLevel + 1}.`}</p>
      </div>
      <div className="play-sheet__experience-controls">
        <button className="play-sheet__experience-remove" disabled={!amountIsValid || !draftIsValid || saving || currentPoints === 0} onClick={() => void adjustExperience(-1)} type="button">Remover</button>
        <input aria-label="Quantidade de XP para ajustar" inputMode="numeric" onChange={(event) => setAmount(parseExperienceInput(event.target.value))} type="text" value={formatExperienceInput(amount)} />
        <button className="play-sheet__experience-add" disabled={!amountIsValid || !draftIsValid || saving} onClick={() => void adjustExperience(1)} type="button">Adicionar</button>
      </div>
    </div>
  </Modal>
}

export function LevelUpDrawer({
  character,
  savedCharacter,
  classId,
  race,
  classData,
  targetExperience,
  targetLevel,
  nextLevel,
  canGoBack = false,
  theme = 'light',
  onCancel,
  onComplete,
  onConfirm,
}: {
  character: CharacterDetails
  savedCharacter?: CharacterDetails
  classId: string
  race: string
  classData: ClassFeatureData | undefined
  targetExperience: number
  targetLevel: number
  nextLevel?: number
  canGoBack?: boolean
  theme?: 'light' | 'dark'
  onCancel: () => void
  onComplete: () => void
  onConfirm: (character: CharacterDetails, hitPointIncrease: number) => Promise<boolean>
}) {
  const savedLevelEntry = savedCharacter?.levelUpHistory?.[String(targetLevel)]
  const savedSpellChanges = savedLevelEntry?.spellChanges ?? []
  const savedAbilityKey = `ability-score-increase:${character.characterClassId}:${targetLevel}`
  const savedAbilityMode = savedCharacter?.classFeatureChoices[`${savedAbilityKey}:mode`]?.[0]
  const savedBardGroupKey = classId === 'bardo' && targetLevel === 6 && (savedCharacter?.classSubclassId ?? character.classSubclassId) === 'colegio-do-conhecimento'
    ? 'colegio-conhecimento-6'
    : `segredos-magicos-${targetLevel}`
  const [subclassId, setSubclassId] = useState(savedCharacter ? savedCharacter.classSubclassId : character.classSubclassId)
  const [primalPath, setPrimalPath] = useState<PrimalPath>(savedCharacter ? savedCharacter.primalPath : character.primalPath)
  const [primalTotemChoices, setPrimalTotemChoices] = useState<PrimalTotemChoices>(savedCharacter ? savedCharacter.primalTotemChoices : character.primalTotemChoices)
  const [choices, setChoices] = useState(savedCharacter?.classFeatureChoices ?? character.classFeatureChoices)
  const [warlockInvocationReplacements, setWarlockInvocationReplacements] = useState<Record<number, { oldId: string; newId: string }>>(() => Object.fromEntries((savedLevelEntry?.invocationReplacements ?? []).map(({ oldId, newId }) => [targetLevel, { oldId, newId }])))
  const [abilitySelections, setAbilitySelections] = useState<Record<number, string[]>>(() => {
    const selection = savedCharacter?.abilityScoreIncreases?.classId === character.characterClassId
      ? savedCharacter.abilityScoreIncreases.selections[savedAbilityKey]
      : savedCharacter?.classFeatureChoices[savedAbilityKey]
    return selection ? { [targetLevel]: selection } : {}
  })
  const [abilityIncreaseModes, setAbilityIncreaseModes] = useState<Record<number, 'ability' | 'feat'>>(() => savedAbilityMode === 'ability' || savedAbilityMode === 'feat' ? { [targetLevel]: savedAbilityMode } : {})
  const [featSelections, setFeatSelections] = useState<Record<number, string>>(() => {
    const feat = savedCharacter?.classFeatureChoices[`${savedAbilityKey}:feat`]?.[0]
    return feat ? { [targetLevel]: feat } : {}
  })
  const [featAbilitySelections, setFeatAbilitySelections] = useState<Record<number, string>>(() => {
    const ability = savedCharacter?.featAbilityIncreases?.[`${savedAbilityKey}:feat`]?.ability
    return ability ? { [targetLevel]: ability } : {}
  })
  const [hitPointModes, setHitPointModes] = useState<Record<number, 'average' | 'rolled'>>(() => savedLevelEntry?.hitPointMode ? { [targetLevel]: savedLevelEntry.hitPointMode } : {})
  const [hitPointRolls, setHitPointRolls] = useState<Record<number, string>>(() => savedLevelEntry?.hitPointRoll ? { [targetLevel]: String(savedLevelEntry.hitPointRoll) } : {})
  const [wizardSpellSelections, setWizardSpellSelections] = useState<Record<number, string[]>>(() => {
    const spells = savedSpellChanges.filter(({ field, replaced }) => field === 'knownSpells' && !replaced).map(({ added }) => added)
    return spells.length ? { [targetLevel]: spells } : {}
  })
  const [newKnownSpellSelections, setNewKnownSpellSelections] = useState<Record<number, string[]>>(() => {
    const spells = savedSpellChanges.filter(({ field, source }) => field === 'knownSpells' && source === 'class-progression').map(({ added }) => added)
    return spells.length ? { [targetLevel]: spells } : {}
  })
  const [spellReplacementSelections, setSpellReplacementSelections] = useState<Record<number, { oldName: string; newName: string }>>(() => {
    const replacement = savedSpellChanges.find(({ field, replaced }) => field === 'knownSpells' && replaced)
    return replacement?.replaced ? { [targetLevel]: { oldName: replacement.replaced, newName: replacement.added } } : {}
  })
  const [bardSecretSelections, setBardSecretSelections] = useState<Record<string, string[]>>(() => {
    const spells = savedSpellChanges.filter(({ field, replaced }) => field !== 'knownSpells' || !replaced).map(({ added }) => added)
    return spells.length ? { [savedBardGroupKey]: spells } : {}
  })
  const [listPanel, setListPanel] = useState<LevelUpListPanel | null>(null)
  const [exitingListPanel, setExitingListPanel] = useState<LevelUpListPanel | null>(null)
  const [listSearch, setListSearch] = useState('')
  const [listFilter, setListFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [pendingChoiceId, setPendingChoiceId] = useState('')
  const levelUpMainViewRef = useRef<HTMLDivElement>(null)
  const listPanelExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (listPanelExitTimer.current) clearTimeout(listPanelExitTimer.current)
  }, [])
  const hitDieSize = classHitDice[classId] ?? 8
  const effectiveAbilities = getEffectiveAbilityScores(character)
  const constitutionModifier = Math.floor((Number(effectiveAbilities.constitution) - 10) / 2)
  const hitPointLevels = Array.from({ length: Math.max(0, targetLevel - character.level) }, (_, index) => character.level + index + 1)
  const subclass = classData?.subclasses.find((item) => item.id === subclassId)
  const subclassLevel = classData?.subclasses[0]?.selectionLevel
  const subclassRequired = Boolean(subclassLevel && targetLevel >= subclassLevel && !character.classSubclassId)
  const barbarianPathRequired = classId === 'barbaro' && targetLevel >= 3 && !character.primalPath
  const totemChoicesToMake = classId === 'barbaro' && primalPath === 'totem-warrior'
    ? ([
      { level: 3, key: 'spiritualTotem', label: 'Totem Espiritual' },
      { level: 6, key: 'beastAspect', label: 'Aspecto da Besta' },
      { level: 14, key: 'totemicAttunement', label: 'Sintonia Totêmica' },
    ] as const).filter(({ level }) => level > character.level && level <= targetLevel)
    : []
  const newlySelectedSubclass = Boolean(subclassId && !character.classSubclassId)
  const unlockedFeatures = [
    ...(classData?.features.filter((feature) => feature.level > character.level && feature.level <= targetLevel) ?? []),
    ...(subclass?.features.filter((feature) =>
      feature.level <= targetLevel && (feature.level > character.level || (newlySelectedSubclass && feature.level === subclassLevel)),
    ) ?? []),
  ]
  const choicesToMake = unlockedFeatures.flatMap((feature) => (feature.choices ?? []).map((choice) => ({ feature, choice })))
  const pactChoiceKey = warlockPactChoiceKey(character.characterClassId, subclassId)
  const tomeCantripKey = warlockTomeCantripChoiceKey(character.characterClassId, subclassId)
  const selectedPact = choices[pactChoiceKey]?.[0]
  const warlockInvocationFeaturesByLevel = new Map(choicesToMake
    .filter(({ choice }) => classId === 'bruxo' && choice.id === 'mystic-invocations')
    .map(({ feature, choice }) => [feature.level, { feature, choice }]))
  const warlockInvocationOptions = (classFeatures.bruxo?.features ?? []).flatMap((feature) =>
    (feature.choices ?? []).filter((choice) => choice.id === 'mystic-invocations').flatMap((choice) => choice.options),
  )
  const activeInvocationChoicePrefix = `${character.characterClassId}:${subclassId}:`
  const knownWarlockInvocations = Object.entries(character.classFeatureChoices)
    .filter(([key]) => key.startsWith(activeInvocationChoicePrefix) && key.endsWith(':mystic-invocations'))
    .flatMap(([, selected]) => selected)
  const warlockInvocationLevelUps = classId === 'bruxo'
    ? Array.from({ length: Math.max(0, targetLevel - character.level) }, (_, index) => character.level + index + 1)
    : []
  const warlockInvocationPlans = planWarlockInvocationChoices({
    levels: warlockInvocationLevelUps,
    knownIds: knownWarlockInvocations,
    options: warlockInvocationOptions,
    selectedPact,
    choicesByLevel: Object.fromEntries([...warlockInvocationFeaturesByLevel].map(([level, { feature, choice }]) => [level, {
      key: `${character.characterClassId}:${subclassId}:${level}:${feature.name}:${choice.id}`,
      choice,
    }])),
    selectedChoices: choices,
    replacements: warlockInvocationReplacements,
  })
  const tomeCantrips = choices[tomeCantripKey] ?? []
  const spellData = readStoredSpellData(character.spells)
  const landCantripChoiceKey = `${character.characterClassId}:${subclassId}:2:Truque Adicional:land-bonus-cantrip`
  const knownClassCantrips = [...new Set([
    ...readSpellNameArray(spellData, 'cantrips'),
    ...readSpellNameArray(spellData, 'bonusCantrips'),
    ...getGrantedClassCantrips(classId, subclassId, character.level, choices[landCantripChoiceKey]?.[0]),
  ])]
  const knownClassCantripNames = new Set(knownClassCantrips.map(normalizeText))
  const ancientSecretsInvocationKey = classId === 'bruxo'
    ? Object.entries(choices).find(([key, selected]) => key.endsWith(':mystic-invocations') && selected.includes('livro-de-segredos-antigos'))?.[0]
    : undefined
  const ancientSecretsRitualKey = ancientSecretsInvocationKey ? ancientSecretsRitualChoiceKey(ancientSecretsInvocationKey) : undefined
  const ancientSecretsRituals = ancientSecretsRitualKey ? choices[ancientSecretsRitualKey] ?? [] : []
  const wizardSpellLevelsToChoose = classId === 'mago'
    ? Array.from({ length: Math.max(0, targetLevel - character.level) }, (_, index) => character.level + index + 1)
    : []
  const wizardSpellbook = classId === 'mago' ? readWizardSpellbook(character.spells) : []
  const learnedSpellClasses = classId === 'bardo' || classId === 'bruxo' || classId === 'feiticeiro' || classId === 'patrulheiro'
    || classId === 'guerreiro' && subclassId === 'cavaleiro-arcano'
    || classId === 'ladino' && subclassId === 'trapaceiro-arcano'
  const spellCatalogClass = classId === 'guerreiro' && subclassId === 'cavaleiro-arcano'
    || classId === 'ladino' && subclassId === 'trapaceiro-arcano'
    ? 'mago'
    : classId
  const spellReplacementLevels = learnedSpellClasses
    ? Array.from({ length: Math.max(0, targetLevel - character.level) }, (_, index) => character.level + index + 1)
    : []
  const newKnownSpellLevels = spellReplacementLevels.filter((level) => getNewlyKnownSpellCountAtClassLevel(classId, subclassId, level) > 0)
  const learnedSpells = readSpellNameArray(spellData, 'knownSpells')
  const separatelyKnownSpells = readSavedSpellNames(character.spells).filter((name) =>
    !learnedSpells.some((known) => normalizeText(known) === normalizeText(name)))
  const learnedSpellsBeforeLevel = (level: number) => spellReplacementLevels
    .filter((selectedLevel) => selectedLevel < level)
    .reduce((known, selectedLevel) => {
      const previous = spellReplacementSelections[selectedLevel]
      if (previous?.oldName) {
        const index = known.findIndex((name) => normalizeText(name) === normalizeText(previous.oldName))
        if (index >= 0) {
          if (previous.newName) known[index] = previous.newName
          else known.splice(index, 1)
        }
      }
      for (const name of newKnownSpellSelections[selectedLevel] ?? []) {
        if (!known.some((knownName) => normalizeText(knownName) === normalizeText(name))) known.push(name)
      }
      return known
    }, [...learnedSpells])
  const spellReplacementOptionsForLevel = (level: number): SpellOption[] => {
    const maxSpellLevel = getSpellSlotsAtClassLevel(classId, subclassId, level).length
    const knownBefore = learnedSpellsBeforeLevel(level)
    return Object.entries(getSpellListForSelection(spellCatalogClass, subclassId))
      .filter(([spellLevel]) => Number(spellLevel) > 0 && Number(spellLevel) <= maxSpellLevel)
      .flatMap(([spellLevel, names]) => names.map((name) => ({ name, level: Number(spellLevel) })))
      .filter(({ name }) => !knownBefore.some((known) => normalizeText(known) === normalizeText(name))
        && !separatelyKnownSpells.some((known) => normalizeText(known) === normalizeText(name))
        && !Object.values(newKnownSpellSelections).flat().some((known) => normalizeText(known) === normalizeText(name))
        && !Object.values(bardSecretSelections).flat().some((known) => normalizeText(known) === normalizeText(name)))
  }
  const newKnownSpellOptionsForLevel = (level: number): SpellOption[] => {
    const knownBefore = learnedSpellsBeforeLevel(level)
    const replacement = spellReplacementSelections[level]
    if (replacement?.oldName && replacement.newName) {
      const index = knownBefore.findIndex((name) => normalizeText(name) === normalizeText(replacement.oldName))
      if (index >= 0) knownBefore[index] = replacement.newName
    }
    const maxSpellLevel = getSpellSlotsAtClassLevel(classId, subclassId, level).length
    const otherSelectedSpells = [
      ...Object.entries(newKnownSpellSelections).filter(([selectedLevel]) => Number(selectedLevel) !== level).flatMap(([, names]) => names),
      ...Object.values(bardSecretSelections).flat(),
      ...Object.values(spellReplacementSelections).map(({ newName }) => newName).filter(Boolean),
      ...(replacement?.oldName ? [replacement.oldName] : []),
    ]
    const options = Object.entries(getSpellListForSelection(spellCatalogClass, subclassId))
      .filter(([spellLevel]) => Number(spellLevel) > 0 && Number(spellLevel) <= maxSpellLevel)
      .flatMap(([spellLevel, names]) => names.map((name) => ({ name, level: Number(spellLevel) })))
    return filterKnownSpellOptions(options, [...knownBefore, ...separatelyKnownSpells, ...otherSelectedSpells])
  }
  const wizardSpellOptionsByLevel = getSpellListForSelection('mago', subclassId)
  const wizardSpellOptionsForLevel = (level: number): SpellOption[] => {
    const maxSpellLevel = getSpellSlotsAtClassLevel('mago', subclassId, level).length
    const previouslySelected = wizardSpellLevelsToChoose
      .filter((selectedLevel) => selectedLevel < level)
      .flatMap((selectedLevel) => wizardSpellSelections[selectedLevel] ?? [])
    return Object.entries(wizardSpellOptionsByLevel)
      .filter(([spellLevel]) => Number(spellLevel) <= maxSpellLevel)
      .flatMap(([spellLevel, names]) => names.map((name) => ({ name, level: Number(spellLevel) })))
      .filter(({ name }) => !wizardSpellbook.some((known) => normalizeText(known) === normalizeText(name))
        && !previouslySelected.some((known) => normalizeText(known) === normalizeText(name)))
  }
  const bardSecretGroups = classId === 'bardo' ? [
    ...(subclassId === 'colegio-do-conhecimento' && character.level < 6 && targetLevel >= 6 ? [{ key: 'colegio-conhecimento-6', level: 6, title: 'Segredos Mágicos Adicionais' }] : []),
    ...[10, 14, 18].filter((level) => character.level < level && targetLevel >= level).map((level) => ({ key: `segredos-magicos-${level}`, level, title: 'Segredos Mágicos' })),
  ] : []
  const bardKnownSpellNames = readSavedSpellNames(character.spells)
  const bardSecretOptionsFor = (groupKey: string, level: number): SpellOption[] => {
    const maxSpellLevel = getSpellSlotsAtClassLevel('bardo', subclassId, level).length
    const chosenElsewhere = Object.entries(bardSecretSelections).filter(([key]) => key !== groupKey).flatMap(([, names]) => names)
    const chosenAsClassSpell = [...Object.values(newKnownSpellSelections).flat(), ...Object.values(spellReplacementSelections).map(({ newName }) => newName)]
    return getAllSpellOptions(maxSpellLevel, true).filter(({ name }) =>
      !bardKnownSpellNames.some((known) => normalizeText(known) === normalizeText(name))
      && !chosenElsewhere.some((known) => normalizeText(known) === normalizeText(name))
      && !chosenAsClassSpell.some((known) => normalizeText(known) === normalizeText(name)),
    )
  }
  const tomePactChoiceBeingMade = classId === 'bruxo'
    && choicesToMake.some(({ choice }) => choice.id === 'dadiva-do-pacto')
  const abilityIncreases = unlockedFeatures.filter((feature) =>
    feature.name.toLocaleLowerCase('pt-BR').includes('incremento no valor de habilidade') && !hasConfirmedAbilityIncrease(character, feature.level),
  )
  const selectedFeatIds = Object.entries(choices)
    .filter(([key]) => key.startsWith('ability-score-increase:') && key.endsWith(':feat'))
    .flatMap(([, selected]) => selected)
  const draftFeatIds = Object.values(featSelections).filter(Boolean)
  const canCastSpells = selectedFeatIds.includes('iniciado-em-magia') || draftFeatIds.includes('iniciado-em-magia')
    || (['bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'mago'].includes(classId) && targetLevel >= 1)
    || (['paladino', 'patrulheiro'].includes(classId) && targetLevel >= 2)
    || (classId === 'guerreiro' && subclassId === 'cavaleiro-arcano' && targetLevel >= 3)
    || (classId === 'ladino' && subclassId === 'trapaceiro-arcano' && targetLevel >= 3)
  const armorProficiencies = [
    ...(classArmorProficiencies[classId] ?? []),
    ...(classId === 'bardo' && subclassId === 'colegio-da-bravura' ? ['Armaduras médias'] : []),
    ...(classId === 'clerigo' && subclass?.features.some((feature) => feature.level <= targetLevel && feature.description.toLocaleLowerCase('pt-BR').includes('armaduras pesadas')) ? ['Armaduras pesadas'] : []),
    ...(normalizeText(race).includes('anao') ? ['Armaduras leves', 'Armaduras médias'] : []),
    ...[...selectedFeatIds, ...draftFeatIds].flatMap((id) => id === 'protecao-leve'
      ? ['Armaduras leves']
      : id === 'protecao-moderada' ? ['Armaduras médias'] : id === 'protecao-pesada' ? ['Armaduras pesadas'] : []),
  ]
  const getFeatFailure = (feat: Feat, level: number) => {
    const key = `ability-score-increase:${character.characterClassId}:${level}:feat`
    const alreadySelected = Object.entries(choices)
      .filter(([choiceKey]) => choiceKey.startsWith('ability-score-increase:') && choiceKey.endsWith(':feat') && choiceKey !== key)
      .some(([, selected]) => selected[0] === feat.id)
    const selectedAtAnotherLevel = Object.entries(featSelections)
      .some(([selectedLevel, selectedId]) => Number(selectedLevel) !== level && selectedId === feat.id)
    const prerequisiteFailure = getFeatPrerequisiteFailure(feat, effectiveAbilities, canCastSpells, armorProficiencies)
    return prerequisiteFailure || ((alreadySelected || selectedAtAnotherLevel) && !feat.repeatable ? 'Este talento só pode ser escolhido uma vez.' : '')
  }
  const selectionsComplete = hitPointLevels.every((level) => hitPointModes[level] !== 'rolled' || (Number.isSafeInteger(Number(hitPointRolls[level])) && Number(hitPointRolls[level]) >= 1 && Number(hitPointRolls[level]) <= hitDieSize)) && wizardSpellLevelsToChoose.every((level) => wizardSpellSelections[level]?.length === 2) && newKnownSpellLevels.every((level) => {
    const selected = newKnownSpellSelections[level] ?? []
    const validOptions = new Set(newKnownSpellOptionsForLevel(level).map(({ name }) => normalizeText(name)))
    return selected.length === getNewlyKnownSpellCountAtClassLevel(classId, subclassId, level)
      && new Set(selected.map(normalizeText)).size === selected.length
      && selected.every((name) => validOptions.has(normalizeText(name)))
  }) && bardSecretGroups.every(({ key }) => bardSecretSelections[key]?.length === 2) && spellReplacementLevels.every((level) => {
    const replacement = spellReplacementSelections[level]
    return !replacement?.oldName || Boolean(replacement.newName)
  }) && (!subclassRequired || Boolean(subclassId)) && (!barbarianPathRequired || Boolean(primalPath)) && totemChoicesToMake.every(({ key }) => Boolean(primalTotemChoices[key])) && choicesToMake.every(({ feature, choice }) => {
    if (classId === 'bruxo' && choice.id === 'mystic-invocations') return true
    const key = `${character.characterClassId}:${subclassId}:${feature.level}:${feature.name}:${choice.id}`
    return (choices[key]?.length ?? 0) === choice.choose
  }) && warlockInvocationPlans.every(({ invocationChoice, selectedAtLevel, selectedAtLevelIsValid, replacement, replacementApplied }) =>
    (!invocationChoice || (selectedAtLevel.length === invocationChoice.choose && selectedAtLevelIsValid))
    && (!replacement?.oldId || replacementApplied),
  ) && (!tomePactChoiceBeingMade || selectedPact !== 'pacto-do-tomo' || isValidPactTomeCantripSelection(tomeCantrips, knownClassCantrips)) && (!ancientSecretsInvocationKey || isValidAncientSecretsRitualSelection(ancientSecretsRituals)) && abilityIncreases.every((feature) => {
    const mode = abilityIncreaseModes[feature.level]
    if (mode === 'feat') {
      const feat = feats.find((item) => item.id === featSelections[feature.level])
      if (!feat || getFeatFailure(feat, feature.level)) return false
      if (!feat.abilityBonus) return true
      return Boolean(getFeatAbilityBonus(feat, effectiveAbilities, featAbilitySelections[feature.level]))
    }
    if (mode !== 'ability') return false
    const selection = abilitySelections[feature.level] ?? []
    return selection.length === 1
      ? Number(effectiveAbilities[selection[0]]) <= 18
      : selection.length === 2 && selection.every((ability) => Number(effectiveAbilities[ability]) < 20)
  })
  const incompleteChoiceIds = new Set<string>()
  if (ancientSecretsInvocationKey && !isValidAncientSecretsRitualSelection(ancientSecretsRituals)) incompleteChoiceIds.add('ancient-secrets')
  for (const level of wizardSpellLevelsToChoose) if (wizardSpellSelections[level]?.length !== 2) incompleteChoiceIds.add(`wizard-spells-${level}`)
  for (const level of spellReplacementLevels) {
    const replacement = spellReplacementSelections[level]
    if (replacement?.oldName && !replacement.newName) incompleteChoiceIds.add(`spell-replacement-${level}`)
  }
  for (const level of newKnownSpellLevels) {
    const selected = newKnownSpellSelections[level] ?? []
    const validOptions = new Set(newKnownSpellOptionsForLevel(level).map(({ name }) => normalizeText(name)))
    if (selected.length !== getNewlyKnownSpellCountAtClassLevel(classId, subclassId, level)
      || new Set(selected.map(normalizeText)).size !== selected.length
      || !selected.every((name) => validOptions.has(normalizeText(name)))) incompleteChoiceIds.add(`new-known-spells-${level}`)
  }
  for (const { key } of bardSecretGroups) if (bardSecretSelections[key]?.length !== 2) incompleteChoiceIds.add(`bard-secrets-${key}`)
  for (const level of hitPointLevels) {
    const roll = Number(hitPointRolls[level])
    if (hitPointModes[level] === 'rolled' && (!Number.isSafeInteger(roll) || roll < 1 || roll > hitDieSize)) incompleteChoiceIds.add(`hit-points-${level}`)
  }
  if (subclassRequired && !subclassId) incompleteChoiceIds.add('subclass')
  if (barbarianPathRequired && !primalPath) incompleteChoiceIds.add('barbarian-path')
  for (const { key } of totemChoicesToMake) if (!primalTotemChoices[key]) incompleteChoiceIds.add(`totem-${key}`)
  for (const plan of warlockInvocationPlans) {
    const invocationIncomplete = Boolean(plan.invocationChoice && (plan.selectedAtLevel.length !== plan.invocationChoice.choose || !plan.selectedAtLevelIsValid))
    if (invocationIncomplete || plan.replacement?.oldId && !plan.replacementApplied) incompleteChoiceIds.add(`warlock-invocations-${plan.level}`)
  }
  for (const { feature, choice } of choicesToMake) {
    if (classId === 'bruxo' && choice.id === 'mystic-invocations') continue
    const key = `${character.characterClassId}:${subclassId}:${feature.level}:${feature.name}:${choice.id}`
    const selected = choices[key] ?? []
    const tomeCantripsIncomplete = classId === 'bruxo' && choice.id === 'dadiva-do-pacto'
      && selected.includes('pacto-do-tomo') && !isValidPactTomeCantripSelection(tomeCantrips, knownClassCantrips)
    if (selected.length !== choice.choose || tomeCantripsIncomplete) incompleteChoiceIds.add(`feature-${key}`)
  }
  for (const feature of abilityIncreases) {
    const level = feature.level
    const mode = abilityIncreaseModes[level]
    let incomplete = false
    if (mode === 'feat') {
      const feat = feats.find((item) => item.id === featSelections[level])
      incomplete = !feat || Boolean(getFeatFailure(feat, level))
        || Boolean(feat?.abilityBonus && !getFeatAbilityBonus(feat, effectiveAbilities, featAbilitySelections[level]))
    } else if (mode === 'ability') {
      const selected = abilitySelections[level] ?? []
      incomplete = !(selected.length === 1
        ? Number(effectiveAbilities[selected[0]]) <= 18
        : selected.length === 2 && selected.every((ability) => Number(effectiveAbilities[ability]) < 20))
    } else incomplete = true
    if (incomplete) incompleteChoiceIds.add(`asi-${level}`)
  }

  function focusFirstIncompleteChoice() {
    const choice = levelUpMainViewRef.current?.querySelector<HTMLElement>('[data-level-up-incomplete="true"]')
    if (!choice) return
    setPendingChoiceId(choice.dataset.levelUpChoiceId ?? '')
    choice.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function completeLevelUp() {
    if (saving) return
    if (!selectionsComplete) {
      focusFirstIncompleteChoice()
      return
    }
    void confirm()
  }

  function updateSubclass(nextId: string) {
    setChoices((current) => classData
      ? rebaseClassFeatureChoicesForSubclass(current, character.characterClassId, subclassId, nextId, classData.features)
      : current)
    setSubclassId(nextId)
  }

  function toggleChoice(key: string, optionId: string, count: number) {
    setChoices((current) => {
      const selected = current[key] ?? []
      const next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : count === 1 ? [optionId] : selected.length < count ? [...selected, optionId] : selected
      return { ...current, [key]: next }
    })
  }

  function toggleAbilityIncrease(level: number, ability: string) {
    setAbilitySelections((current) => {
      const selected = current[level] ?? []
      return {
        ...current,
        [level]: selected.includes(ability)
          ? selected.filter((item) => item !== ability)
          : selected.length < 2 ? [...selected, ability] : selected,
      }
    })
  }

  function openListPanel(panel: LevelUpListPanel) {
    if (listPanelExitTimer.current) clearTimeout(listPanelExitTimer.current)
    listPanelExitTimer.current = null
    setExitingListPanel(null)
    setListSearch('')
    setListFilter('all')
    setListPanel(panel)
  }

  function returnToLevelUp() {
    if (!listPanel) return
    if (listPanelExitTimer.current) clearTimeout(listPanelExitTimer.current)
    setExitingListPanel(listPanel)
    setListPanel(null)
    setListSearch('')
    setListFilter('all')
    listPanelExitTimer.current = setTimeout(() => {
      setExitingListPanel(null)
      listPanelExitTimer.current = null
    }, 220)
  }

  function completeListPanel(selected: string[]) {
    if (!listPanel) return
    const nextPanel = listPanel.apply(selected)
    if (nextPanel) {
      setListPanel(nextPanel)
      setListSearch('')
      setListFilter('all')
      return
    }
    returnToLevelUp()
  }

  function createSpellListPanel({
    title,
    description,
    options,
    selectionCount,
    selected,
    apply,
  }: {
    title: string
    description: string
    options: SpellOption[]
    selectionCount: number
    selected: string[]
    apply: (selected: string[]) => LevelUpListPanel | null
  }): LevelUpListPanel {
    const levels = [...new Set(options.map(({ level }) => level))].sort((first, second) => first - second)
    return {
      title,
      description,
      options: options.map(({ name, level }) => ({ id: name, name, detail: level === 0 ? 'Truque' : `${level}º nível`, filters: [`level:${level}`] })),
      selectionCount,
      selected,
      filters: [{ id: 'all', label: 'Todos' }, ...levels.map((level) => ({ id: `level:${level}`, label: level === 0 ? 'Truques' : `${level}º nível` }))],
      apply,
    }
  }

  function createOptionListPanel({
    title,
    description,
    options,
    selectionCount,
    minimumSelectionCount,
    selected,
    apply,
  }: {
    title: string
    description: string
    options: { id: string; name: string; description?: string; level?: number; disabled?: boolean }[]
    selectionCount: number
    minimumSelectionCount?: number
    selected: string[]
    apply: (selected: string[]) => LevelUpListPanel | null
  }): LevelUpListPanel {
    return {
      title,
      description,
      options: options.map(({ id, name, description: detail, level, disabled }) => ({
        id,
        name,
        ...(level === undefined ? {} : { detail: `Disponível a partir do nível ${level}` }),
        ...(detail ? { description: detail } : {}),
        ...(disabled ? { disabled: true } : {}),
      })),
      selectionCount,
      ...(minimumSelectionCount === undefined ? {} : { minimumSelectionCount }),
      selected,
      apply,
    }
  }

  function createTomeCantripPanel(selected = tomeCantrips): LevelUpListPanel {
    const names = [...new Set(Object.values(cantripsByClass).flat())]
    return {
      title: 'Truques do Livro das Sombras',
      description: `Escolha ${pactTomeCantripCount} truques de listas de quaisquer classes. Eles não contam no limite de truques conhecidos do bruxo.`,
      options: names.map((name) => ({
        id: name,
        name,
        detail: `Lista: ${listFilterClasses.filter(([id]) => cantripsByClass[id]?.includes(name)).map(([, label]) => label).join(', ')}`,
        filters: listFilterClasses.filter(([id]) => cantripsByClass[id]?.includes(name)).map(([id]) => `class:${id}`),
        ...(knownClassCantripNames.has(normalizeText(name)) && !selected.includes(name) ? { disabled: true } : {}),
      })),
      selectionCount: pactTomeCantripCount,
      selected,
      filters: [{ id: 'all', label: 'Todas' }, ...listFilterClasses.map(([id, label]) => ({ id: `class:${id}`, label }))],
      apply: (next) => {
        if (!isValidPactTomeCantripSelection(next, knownClassCantrips)) return null
        setChoices((current) => ({ ...current, [tomeCantripKey]: next }))
        return null
      },
    }
  }

  async function confirm() {
    if (!selectionsComplete) return
    const nextChoices = { ...choices }
    for (const previousReplacement of savedLevelEntry?.invocationReplacements ?? []) {
      const selected = nextChoices[previousReplacement.sourceKey]
      if (selected?.includes(previousReplacement.newId)) {
        nextChoices[previousReplacement.sourceKey] = selected.map((id) => id === previousReplacement.newId ? previousReplacement.oldId : id)
      }
    }
    const invocationReplacementsByLevel: Record<number, NonNullable<LevelUpHistoryEntry['invocationReplacements']>> = {}
    for (const plan of warlockInvocationPlans) {
      if (!plan.replacement?.oldId) continue
      if (!plan.replacementApplied) return
      const previousReplacement = savedLevelEntry?.invocationReplacements?.find(({ oldId }) => oldId === plan.replacement!.oldId)
      const sourceKey = Object.entries(nextChoices).find(([key, selected]) =>
        key.startsWith(activeInvocationChoicePrefix) && key.endsWith(':mystic-invocations') && selected.includes(plan.replacement!.oldId),
      )?.[0] ?? previousReplacement?.sourceKey
      if (!sourceKey) return
      nextChoices[sourceKey] = nextChoices[sourceKey].map((id) => id === plan.replacement!.oldId || id === previousReplacement?.newId ? plan.replacement!.newId : id)
      if (plan.replacement.oldId === 'livro-de-segredos-antigos') delete nextChoices[ancientSecretsRitualChoiceKey(sourceKey)]
      invocationReplacementsByLevel[plan.level] = [...(invocationReplacementsByLevel[plan.level] ?? []), {
        sourceKey,
        oldId: plan.replacement.oldId,
        newId: plan.replacement.newId,
      }]
    }
    if (classId === 'bruxo' && selectedPact !== 'pacto-do-tomo') delete nextChoices[tomeCantripKey]
    const nextAbilities = { ...character.abilities }
    const confirmedIncreases = character.abilityScoreIncreases?.classId === character.characterClassId
      ? { ...character.abilityScoreIncreases.selections }
      : {}
    const featAbilityIncreases = { ...(character.featAbilityIncreases ?? {}) }
    for (const feature of abilityIncreases) {
      const key = `ability-score-increase:${character.characterClassId}:${feature.level}`
      const mode = abilityIncreaseModes[feature.level]
      const featKey = `${key}:feat`
      const previousFeatIncrease = featAbilityIncreases[featKey]
      if (previousFeatIncrease) {
        const previousScore = Number(nextAbilities[previousFeatIncrease.ability])
        if (previousFeatIncrease.amount && Number.isFinite(previousScore)) nextAbilities[previousFeatIncrease.ability] = String(previousScore - previousFeatIncrease.amount)
        delete featAbilityIncreases[featKey]
      }
      if (mode === 'feat') {
        const feat = feats.find((item) => item.id === featSelections[feature.level])
        if (!feat || getFeatFailure(feat, feature.level)) return
        const bonus = feat.abilityBonus
          ? getFeatAbilityBonus(feat, nextAbilities, featAbilitySelections[feature.level])
          : null
        if (feat.abilityBonus && !bonus) return
        if (bonus?.amount) nextAbilities[bonus.ability] = String(Number(nextAbilities[bonus.ability]) + bonus.amount)
        if (bonus) featAbilityIncreases[featKey] = bonus
        delete nextChoices[key]
        nextChoices[`${key}:mode`] = ['feat']
        nextChoices[featKey] = [feat.id]
        delete confirmedIncreases[key]
        continue
      }
      const selection = abilitySelections[feature.level] ?? []
      const amount = selection.length === 1 ? 2 : 1
      if ((selection.length !== 1 && selection.length !== 2) || selection.some((ability) => Number(nextAbilities[ability]) + amount > 20)) return
      for (const ability of selection) nextAbilities[ability] = String(Number(nextAbilities[ability]) + amount)
      nextChoices[key] = selection
      nextChoices[`${key}:mode`] = ['ability']
      delete nextChoices[featKey]
      confirmedIncreases[key] = selection
    }

    setSaving(true)
    const hitPointIncrease = hitPointLevels.reduce((total, level) => {
      const rolledResult = hitPointModes[level] === 'rolled' ? Number(hitPointRolls[level]) : undefined
      return total + hitPointGainForLevel(hitDieSize, constitutionModifier, rolledResult)
    }, 0)
    const bardOptions = new Map(getAllSpellOptions(9, true).map(({ name, level }) => [normalizeText(name), level]))
    const nextLevelUpHistory = { ...(character.levelUpHistory ?? {}) }
    const spellChangesByLevel: Record<number, NonNullable<LevelUpHistoryEntry['spellChanges']>> = {}
    const addSpellChange = (level: number, field: 'knownSpells' | 'bonusSpells' | 'bonusCantrips', added: string, replaced?: string, source?: 'class-progression') => {
      spellChangesByLevel[level] = [...(spellChangesByLevel[level] ?? []), { field, added, ...(replaced ? { replaced } : {}), ...(source ? { source } : {}) }]
    }
    for (const level of hitPointLevels) {
      const rolledResult = hitPointModes[level] === 'rolled' ? Number(hitPointRolls[level]) : undefined
      nextLevelUpHistory[String(level)] = {
        ...nextLevelUpHistory[String(level)],
        hitPointGain: hitPointGainForLevel(hitDieSize, constitutionModifier, rolledResult),
        hitPointMode: hitPointModes[level] ?? 'average',
        ...(rolledResult === undefined ? {} : { hitPointRoll: rolledResult }),
      }
      if (rolledResult === undefined) delete nextLevelUpHistory[String(level)].hitPointRoll
    }
    for (const [levelText, replacement] of Object.entries(spellReplacementSelections)) {
      if (replacement.oldName && replacement.newName) addSpellChange(Number(levelText), 'knownSpells', replacement.newName, replacement.oldName)
    }
    for (const level of wizardSpellLevelsToChoose) {
      for (const spell of wizardSpellSelections[level] ?? []) addSpellChange(level, 'knownSpells', spell)
    }
    for (const level of newKnownSpellLevels) {
      for (const spell of newKnownSpellSelections[level] ?? []) addSpellChange(level, 'knownSpells', spell, undefined, 'class-progression')
    }
    for (const group of bardSecretGroups) {
      for (const spell of bardSecretSelections[group.key] ?? []) {
        const spellLevel = bardOptions.get(normalizeText(spell)) ?? 0
        const field = spellLevel === 0 ? 'bonusCantrips' : group.key === 'colegio-conhecimento-6' ? 'bonusSpells' : 'knownSpells'
        addSpellChange(group.level, field, spell)
      }
    }
    for (const level of hitPointLevels) {
      const previous = nextLevelUpHistory[String(level)]
      const spellChanges = spellChangesByLevel[level]
      const invocationReplacements = invocationReplacementsByLevel[level]
      if (spellChanges?.length || invocationReplacements?.length) {
        nextLevelUpHistory[String(level)] = {
          ...previous,
          ...(spellChanges?.length ? { spellChanges: [...(previous.spellChanges ?? []), ...spellChanges] } : {}),
          ...(invocationReplacements?.length ? { invocationReplacements: [...(previous.invocationReplacements ?? []), ...invocationReplacements] } : {}),
        }
      }
    }
    const nextWizardSpellbook = [...wizardSpellbook, ...wizardSpellLevelsToChoose.flatMap((level) => wizardSpellSelections[level] ?? [])]
    let wizardPreparedSpells: string[] = []
    try {
      const stored = JSON.parse(character.spells) as { cantrips?: unknown; preparedSpells?: unknown }
      wizardPreparedSpells = Array.isArray(stored.preparedSpells)
        ? stored.preparedSpells.filter((name): name is string => typeof name === 'string')
        : wizardSpellbook.slice(0, Math.max(1, character.level + Math.floor((Number(effectiveAbilities.intelligence) - 10) / 2)))
    } catch {
      wizardPreparedSpells = []
    }
    const bardSecretNames = bardSecretGroups.flatMap(({ key }) => bardSecretSelections[key] ?? [])
    const storedSpellData = readStoredSpellData(character.spells)
    const nextKnownSpells = [...learnedSpells]
    for (const replacement of Object.values(spellReplacementSelections)) {
      if (!replacement.oldName) continue
      const index = nextKnownSpells.findIndex((name) => normalizeText(name) === normalizeText(replacement.oldName))
      if (index < 0 || !replacement.newName) return
      nextKnownSpells[index] = replacement.newName
    }
    for (const level of newKnownSpellLevels) {
      for (const spell of newKnownSpellSelections[level] ?? []) {
        if (!nextKnownSpells.some((name) => normalizeText(name) === normalizeText(spell))) nextKnownSpells.push(spell)
      }
    }
    const standardSecretSpellNames = bardSecretGroups.filter(({ key }) => key.startsWith('segredos-magicos-')).flatMap(({ key }) => bardSecretSelections[key] ?? [])
      .filter((name) => (bardOptions.get(normalizeText(name)) ?? 0) > 0)
    const loreSecretSpellNames = bardSecretGroups.filter(({ key }) => key === 'colegio-conhecimento-6').flatMap(({ key }) => bardSecretSelections[key] ?? [])
      .filter((name) => (bardOptions.get(normalizeText(name)) ?? 0) > 0)
    const nextSpellData = classId === 'mago'
      ? JSON.stringify({
        cantrips: (() => {
          try {
            const stored = JSON.parse(character.spells) as { cantrips?: unknown }
            return Array.isArray(stored.cantrips) ? stored.cantrips.filter((name): name is string => typeof name === 'string') : []
          } catch {
            return []
          }
        })(),
        knownSpells: nextWizardSpellbook,
        preparedSpells: wizardPreparedSpells,
      })
      : bardSecretNames.length > 0 || newKnownSpellLevels.some((level) => (newKnownSpellSelections[level]?.length ?? 0) > 0) || spellReplacementLevels.some((level) => Boolean(spellReplacementSelections[level]?.oldName))
        ? JSON.stringify({
          ...storedSpellData,
          knownSpells: [...new Set([...nextKnownSpells, ...standardSecretSpellNames])],
          bonusSpells: [...new Set([...readSpellNameArray(storedSpellData, 'bonusSpells'), ...loreSecretSpellNames])],
          bonusCantrips: [...new Set([...readSpellNameArray(storedSpellData, 'bonusCantrips'), ...bardSecretNames.filter((name) => bardOptions.get(normalizeText(name)) === 0)])],
        })
        : character.spells
    const saved = await onConfirm({
      ...character,
      classSubclassId: subclassId,
      primalPath,
      primalTotemChoices,
      classFeatureChoices: nextChoices,
      abilities: nextAbilities,
      featAbilityIncreases,
      abilityScoreIncreases: { classId: character.characterClassId, selections: confirmedIncreases },
      level: targetLevel,
      experiencePoints: String(targetExperience),
      maxHp: String((Number(character.maxHp) || 0) + hitPointIncrease),
      spells: nextSpellData,
      levelUpHistory: nextLevelUpHistory,
    }, hitPointIncrease)
    setSaving(false)
    if (saved) onComplete()
  }

  function renderListPanel(panel: LevelUpListPanel) {
    const normalizedSearch = listSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    const filteredOptions = panel.options.filter((option) =>
      (listFilter === 'all' || option.filters?.includes(listFilter))
      && (!normalizedSearch || `${option.name} ${option.detail ?? ''} ${option.description ?? ''}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(normalizedSearch)))
    return <div className="play-sheet__level-up-list-panel">
      <p>{panel.description}</p>
      <label className="play-sheet__level-up-list-search"><span aria-hidden="true" className="material-symbols-rounded">search</span><input aria-label="Pesquisar opções" onChange={(event) => setListSearch(event.target.value)} placeholder="Pesquisar" type="search" value={listSearch} /></label>
      {panel.filters && <div aria-label="Filtrar opções" className="play-sheet__level-up-list-filters" role="group">
        {panel.filters.map((filter) => <button aria-pressed={listFilter === filter.id} className={listFilter === filter.id ? 'play-sheet__level-up-list-filter play-sheet__level-up-list-filter--active' : 'play-sheet__level-up-list-filter'} key={filter.id} onClick={() => setListFilter(filter.id)} type="button">{filter.label}</button>)}
      </div>}
      <p aria-live="polite" className="play-sheet__level-up-list-count">{panel.selected.length} de {panel.selectionCount} selecionada(s)</p>
      <div aria-label="Opções disponíveis" className="play-sheet__level-up-list-options">
        {filteredOptions.map((option) => {
          const selected = panel.selected.includes(option.id)
          const disabled = option.disabled || panel.selectionCount > 1 && !selected && panel.selected.length >= panel.selectionCount
          return <label className="play-sheet__level-up-list-option" key={option.id}>
            <input checked={selected} disabled={disabled} onChange={() => {
              if (panel.selectionCount === 1) {
                completeListPanel([option.id])
                return
              }
              setListPanel((current) => current ? {
                ...current,
                selected: selected ? current.selected.filter((id) => id !== option.id) : [...current.selected, option.id],
              } : current)
            }} type={panel.selectionCount === 1 ? 'radio' : 'checkbox'} name="level-up-list-option" />
            <span><strong>{option.name}</strong>{option.detail && <small>{option.detail}</small>}{option.description && <small>{option.description}</small>}</span>
          </label>
        })}
        {filteredOptions.length === 0 && <p className="play-sheet__level-up-list-empty">Nenhuma opção encontrada.</p>}
      </div>
    </div>
  }

  return <>
    <Modal open title={listPanel?.title ?? 'Avanço de nível'} theme={theme} onClose={() => { if (!saving) onCancel() }} variant="drawer" footer={listPanel
      ? <><Button className="play-sheet__level-up-cancel" onClick={returnToLevelUp} variant="secondary">Voltar</Button>{listPanel.selectionCount > 1 && <Button disabled={listPanel.selected.length < (listPanel.minimumSelectionCount ?? listPanel.selectionCount) || listPanel.selected.length > listPanel.selectionCount} onClick={() => completeListPanel(listPanel.selected)}>Confirmar seleção ({listPanel.selected.length}/{listPanel.selectionCount})</Button>}</>
      : <><Button className="play-sheet__level-up-cancel" disabled={saving} onClick={onCancel} variant="secondary">{canGoBack ? `Voltar para escolhas do nível ${targetLevel - 1}` : 'Cancelar'}</Button><Button disabled={saving} onClick={completeLevelUp}>{saving ? 'Salvando…' : nextLevel ? `Salvar e ir para escolhas do nível ${nextLevel}` : 'Concluir avanço'}</Button></>}>
    <div className="play-sheet__level-up-drawer">
      <div className={`play-sheet__level-up-views${listPanel ? ' play-sheet__level-up-views--list-active' : ''}${!listPanel && exitingListPanel ? ' play-sheet__level-up-views--list-exiting' : ''}`}>
      <div aria-hidden={Boolean(listPanel)} className="play-sheet__level-up-main-view" inert={Boolean(listPanel)} ref={levelUpMainViewRef}>
      <p>Nível {character.level} → {targetLevel}. Revise e faça as escolhas liberadas para a classe.</p>
      <div className="play-sheet__level-up-content">
        {ancientSecretsInvocationKey && <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id="ancient-secrets" data-level-up-incomplete={incompleteChoiceIds.has('ancient-secrets') ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === 'ancient-secrets' && incompleteChoiceIds.has('ancient-secrets') ? 'true' : undefined}>
          <legend>Livro de Segredos Antigos</legend>
          <p>{ancientSecretsRituals.length} de 2 rituais de 1º nível selecionados.</p>
          <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createSpellListPanel({
            title: 'Escolher rituais para o Livro das Sombras',
            description: 'Escolha duas magias rituais de 1º nível de quaisquer listas de classe.',
            options: getRitualSpellOptions(1),
            selectionCount: 2,
            selected: ancientSecretsRituals,
            apply: (rituals) => {
              if (!isValidAncientSecretsRitualSelection(rituals)) return null
              setChoices((current) => ({ ...current, [ancientSecretsRitualKey!]: rituals }))
              return null
            },
          }))} type="button"><span>{ancientSecretsRituals.length ? ancientSecretsRituals.join(', ') : 'Escolher rituais'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
        </fieldset>}
        {wizardSpellLevelsToChoose.map((level) => <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={`wizard-spells-${level}`} data-level-up-incomplete={incompleteChoiceIds.has(`wizard-spells-${level}`) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === `wizard-spells-${level}` && incompleteChoiceIds.has(`wizard-spells-${level}`) ? 'true' : undefined} key={`wizard-spells-${level}`}>
          <legend>Grimório · nível {level}</legend>
          <p>Escolha duas magias de mago de níveis para os quais já tenha espaços.</p>
          <div className="play-sheet__level-up-options">
            <span>{wizardSpellSelections[level]?.length ?? 0} de 2 magias escolhidas</span>
            <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createSpellListPanel({
              title: `Magias para o grimório · nível ${level}`,
              description: 'Escolha duas novas magias da lista de mago que possa conjurar neste nível.',
              options: wizardSpellOptionsForLevel(level),
              selectionCount: 2,
              selected: wizardSpellSelections[level] ?? [],
              apply: (spells) => { setWizardSpellSelections((current) => ({ ...current, [level]: spells })); return null },
            }))} type="button"><span>{wizardSpellSelections[level]?.length ? wizardSpellSelections[level].join(', ') : 'Escolher magias'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
          </div>
        </fieldset>)}
        {spellReplacementLevels.map((level) => {
          const replacement = spellReplacementSelections[level]
          const choiceId = `spell-replacement-${level}`
          const replaceableSpells = learnedSpellsBeforeLevel(level)
            .map((name) => ({ name, spellLevel: getSpellLevel(name, classId) }))
            .sort((left, right) => (left.spellLevel ?? Number.MAX_SAFE_INTEGER) - (right.spellLevel ?? Number.MAX_SAFE_INTEGER)
              || left.name.localeCompare(right.name, 'pt-BR'))
           return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={choiceId}>
            <legend>Substituir magia conhecida — nível {level}</legend>
            <p>Opcional: troque uma magia conhecida por outra da lista da classe, de um nível para o qual já tenha espaços.</p>
            {replaceableSpells.length > 0 && <select aria-label="Magia conhecida para substituir" className="play-sheet__spell-replacement-select" value={replacement?.oldName ?? ''} onChange={(event) => {
              setSpellReplacementSelections((current) => ({ ...current, [level]: { oldName: event.target.value, newName: '' } }))
              setNewKnownSpellSelections((current) => ({ ...current, [level]: [] }))
            }}>
              <option value="">Não trocar magia</option>
              {replaceableSpells.map(({ name, spellLevel }) => {
                 const levelLabel = spellLevel === 0 ? 'Truque' : spellLevel ? `${spellLevel}º nível` : 'Nível desconhecido'
                 return <option key={name} value={name}>{name} — {levelLabel}</option>
               })}
            </select>}
            {replacement?.oldName && <div className="play-sheet__level-up-options">
              <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createSpellListPanel({
                title: 'Substituir magia conhecida',
                description: 'Escolha uma magia da lista da classe de um nível para o qual o personagem tenha espaços.',
                options: spellReplacementOptionsForLevel(level),
                selectionCount: 1,
                selected: replacement.newName ? [replacement.newName] : [],
                apply: (spells) => { setSpellReplacementSelections((current) => ({ ...current, [level]: { ...current[level], newName: spells[0] ?? '' } })); return null },
              }))} type="button"><span>{replacement.newName || 'Escolher magia'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
            </div>}
            {learnedSpellsBeforeLevel(level).length === 0 && <p>Não há magias conhecidas para substituir.</p>}
          </fieldset>
        })}
        {newKnownSpellLevels.map((level) => {
          const selectionCount = getNewlyKnownSpellCountAtClassLevel(classId, subclassId, level)
          const replacement = spellReplacementSelections[level]
          const selected = newKnownSpellSelections[level] ?? []
          const maxSpellLevel = getSpellSlotsAtClassLevel(classId, subclassId, level).length
          const choiceId = `new-known-spells-${level}`
           return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={choiceId}>
            <legend>Novas magias conhecidas — nível {level}</legend>
            <p>Escolha {selectionCount === 1 ? 'uma nova magia' : `${selectionCount} novas magias`} da lista da classe, de níveis até {maxSpellLevel}º.</p>
            <div className="play-sheet__level-up-options">
              <span>{selected.length} de {selectionCount} magias escolhidas</span>
              <button className="play-sheet__level-up-select-card" disabled={Boolean(replacement?.oldName && !replacement.newName)} onClick={() => openListPanel(createSpellListPanel({
                title: `Novas magias conhecidas · nível ${level}`,
                description: `Escolha ${selectionCount} novas magias da lista da classe, de níveis para os quais o personagem já tenha espaços. Magias que ele já conhece não aparecem na lista.`,
                options: newKnownSpellOptionsForLevel(level),
                selectionCount,
                selected,
                apply: (spells) => { setNewKnownSpellSelections((current) => ({ ...current, [level]: spells })); return null },
              }))} type="button"><span>{selected.length ? selected.join(', ') : 'Escolher magias'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
            </div>
          </fieldset>
        })}
        {bardSecretGroups.map((group) => { const choiceId = `bard-secrets-${group.key}`; return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={group.key}>
          <legend>{group.title} · nível {group.level}</legend>
          <p>Escolha duas magias ou truques de qualquer lista de classe, respeitando os níveis de magia disponíveis para o bardo.</p>
          <div className="play-sheet__level-up-options">
            <span>{bardSecretSelections[group.key]?.length ?? 0} de 2 escolhidas</span>
            <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createSpellListPanel({
              title: 'Segredos Mágicos',
              description: 'Escolha duas magias ou truques de qualquer lista de classe, até o maior nível que o bardo pode conjurar.',
              options: bardSecretOptionsFor(group.key, group.level),
              selectionCount: 2,
              selected: bardSecretSelections[group.key] ?? [],
              apply: (spells) => { setBardSecretSelections((current) => ({ ...current, [group.key]: spells })); return null },
            }))} type="button"><span>{bardSecretSelections[group.key]?.length ? bardSecretSelections[group.key].join(', ') : 'Escolher magias'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
          </div>
        </fieldset>})}
        {hitPointLevels.map((level) => {
          const mode = hitPointModes[level] ?? 'average'
          const rolledResult = mode === 'rolled' ? Number(hitPointRolls[level]) : undefined
          const rolledResultValid = mode !== 'rolled' || (Number.isSafeInteger(rolledResult) && rolledResult! >= 1 && rolledResult! <= hitDieSize)
          const gain = rolledResultValid ? hitPointGainForLevel(hitDieSize, constitutionModifier, rolledResult) : null
          const choiceId = `hit-points-${level}`
           return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={choiceId}>
            <legend>Pontos de vida — nível {level}</legend>
            <div className="play-sheet__level-up-options">
              <label><input checked={mode === 'average'} name={`hit-points-${level}`} onChange={() => setHitPointModes((current) => ({ ...current, [level]: 'average' }))} type="radio" /><span><strong>Usar valor padrão</strong><small>{Math.ceil((hitDieSize + 1) / 2)} + Constituição ({constitutionModifier >= 0 ? '+' : ''}{constitutionModifier}) = {Math.max(1, Math.ceil((hitDieSize + 1) / 2) + constitutionModifier)} PV</small></span></label>
              <label><input checked={mode === 'rolled'} name={`hit-points-${level}`} onChange={() => setHitPointModes((current) => ({ ...current, [level]: 'rolled' }))} type="radio" /><span><strong>Informar resultado do dado</strong><small>Role 1d{hitDieSize} fora da ficha e informe o resultado; Constituição será somada automaticamente.</small></span></label>
            </div>
            {mode === 'rolled' && <label className="play-sheet__level-up-hit-point-roll"><span>Resultado do dado (1–{hitDieSize})</span><input aria-label={`Resultado do dado de vida no nível ${level}`} inputMode="numeric" max={hitDieSize} min="1" onChange={(event) => setHitPointRolls((current) => ({ ...current, [level]: event.target.value }))} step="1" type="number" value={hitPointRolls[level] ?? ''} />{gain !== null && <small>Ganho neste nível: {gain} PV</small>}</label>}
          </fieldset>
        })}
        {subclassRequired && <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id="subclass" data-level-up-incomplete={incompleteChoiceIds.has('subclass') ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === 'subclass' && incompleteChoiceIds.has('subclass') ? 'true' : undefined}>
          <legend>Escolha uma subclasse</legend>
          {(classData?.subclasses.length ?? 0) > 4
            ? <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createOptionListPanel({
              title: 'Escolha uma subclasse',
              description: 'Selecione a subclasse do personagem.',
              options: classData?.subclasses ?? [],
              selectionCount: 1,
              selected: subclassId ? [subclassId] : [],
              apply: (selected) => { updateSubclass(selected[0]); return null },
            }))} type="button"><span>{classData?.subclasses.find(({ id }) => id === subclassId)?.name ?? 'Selecionar subclasse'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
            : classData?.subclasses.map((option) => <label key={option.id}><input checked={subclassId === option.id} name="level-up-subclass" onChange={() => updateSubclass(option.id)} type="radio" /><span>{option.name}</span></label>)}
        </fieldset>}
        {barbarianPathRequired && <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id="barbarian-path" data-level-up-incomplete={incompleteChoiceIds.has('barbarian-path') ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === 'barbarian-path' && incompleteChoiceIds.has('barbarian-path') ? 'true' : undefined}>
          <legend>Escolha um Caminho Primitivo</legend>
          {(['berserker', 'totem-warrior'] as const).map((path) => <label key={path}><input checked={primalPath === path} name="barbarian-path" onChange={() => setPrimalPath(path)} type="radio" /><span>{path === 'berserker' ? 'Berserker' : 'Guerreiro Totêmico'}</span></label>)}
        </fieldset>}
        {totemChoicesToMake.map(({ level, key, label }) => { const choiceId = `totem-${key}`; return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={key}>
          <legend>{label} — nível {level}</legend>
          {(['eagle', 'wolf', 'bear'] as const).map((animal) => <label key={animal}><input checked={primalTotemChoices[key] === animal} name={`totem-${key}`} onChange={() => setPrimalTotemChoices((current) => ({ ...current, [key]: animal }))} type="radio" /><span>{animal === 'eagle' ? 'Águia' : animal === 'wolf' ? 'Lobo' : 'Urso'}</span></label>)}
        </fieldset>})}
        {warlockInvocationPlans.map((plan) => { const choiceId = `warlock-invocations-${plan.level}`; return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={choiceId}>
          <legend>Invocações Místicas — nível {plan.level}</legend>
          {plan.knownBeforeReplacement.length > 0 && <div className="play-sheet__warlock-invocation-replacement">
            <p>Opcional: troque uma invocação conhecida antes de escolher as novas deste nível.</p>
            <label><span>Invocação a substituir</span><select value={plan.replacement?.oldId ?? ''} onChange={(event) => setWarlockInvocationReplacements((current) => ({ ...current, [plan.level]: { oldId: event.target.value, newId: '' } }))}>
              <option value="">Não trocar</option>
              {plan.knownBeforeReplacement.map((id) => <option key={id} value={id}>{warlockInvocationOptions.find((option) => option.id === id)?.name ?? id}</option>)}
            </select></label>
            {plan.replacement?.oldId && <div className="play-sheet__warlock-invocation-replacement-options">
              <p>Nova invocação</p>
              {plan.replacementOptions.length > 4
                ? <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createOptionListPanel({
                  title: 'Nova invocação mística',
                  description: `Selecione uma nova invocação para substituir ${warlockInvocationOptions.find(({ id }) => id === plan.replacement?.oldId)?.name ?? 'a invocação atual'}.`,
                  options: plan.replacementOptions,
                  selectionCount: 1,
                  selected: plan.replacement?.newId ? [plan.replacement.newId] : [],
                  apply: (selected) => { setWarlockInvocationReplacements((current) => ({ ...current, [plan.level]: { ...current[plan.level], oldId: plan.replacement!.oldId, newId: selected[0] } })); return null },
                }))} type="button"><span>{warlockInvocationOptions.find(({ id }) => id === plan.replacement?.newId)?.name ?? 'Escolher nova invocação'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
                : <div aria-label={`Nova invocação para o nível ${plan.level}`} className="play-sheet__level-up-options" role="radiogroup">
                  {plan.replacementOptions.map((option) => <label key={option.id}>
                    <input checked={plan.replacement?.newId === option.id} name={`warlock-invocation-replacement-${plan.level}`} onChange={() => setWarlockInvocationReplacements((current) => ({ ...current, [plan.level]: { ...current[plan.level], oldId: plan.replacement!.oldId, newId: option.id } }))} type="radio" />
                    <span><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}</span>
                  </label>)}
                  {plan.replacementOptions.length === 0 && <p>Nenhuma invocação disponível neste nível.</p>}
                </div>}
            </div>}
          </div>}
          {plan.invocationChoice && plan.invocationChoiceKey && <>
            <p>Escolha {plan.invocationChoice.choose} invocação(ões) que ainda não conheça.</p>
            {plan.options.length > 4
              ? <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createOptionListPanel({
                title: `Invocações Místicas · nível ${plan.level}`,
                description: `Escolha ${plan.invocationChoice!.choose} invocação(ões) que ainda não conheça.`,
                options: plan.options,
                selectionCount: plan.invocationChoice!.choose,
                selected: plan.selectedAtLevel,
                apply: (selected) => {
                  setChoices((current) => ({ ...current, [plan.invocationChoiceKey!]: selected }))
                  if (selected.includes('livro-de-segredos-antigos') && !plan.selectedAtLevel.includes('livro-de-segredos-antigos')) {
                    const ritualKey = ancientSecretsRitualChoiceKey(plan.invocationChoiceKey!)
                    return createSpellListPanel({
                      title: 'Escolher rituais para o Livro das Sombras',
                      description: 'Escolha duas magias rituais de 1º nível de quaisquer listas de classe.',
                      options: getRitualSpellOptions(1),
                      selectionCount: 2,
                      selected: choices[ritualKey] ?? [],
                      apply: (rituals) => {
                        if (!isValidAncientSecretsRitualSelection(rituals)) return null
                        setChoices((current) => ({ ...current, [ritualKey]: rituals }))
                        return null
                      },
                    })
                  }
                  return null
                },
              }))} type="button"><span>{plan.selectedAtLevel.length ? plan.selectedAtLevel.map((id) => warlockInvocationOptions.find(({ id: optionId }) => optionId === id)?.name ?? id).join(', ') : 'Escolher invocações'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
              : <div className="play-sheet__level-up-options">
                {plan.options.map((option) => <label key={option.id}>
                  <input checked={plan.selectedAtLevel.includes(option.id)} disabled={!plan.selectedAtLevel.includes(option.id) && (plan.selectedAtLevel.length >= plan.invocationChoice!.choose || plan.knownAfterReplacement.includes(option.id))} onChange={() => {
                    toggleChoice(plan.invocationChoiceKey!, option.id, plan.invocationChoice!.choose)
                    if (option.id === 'livro-de-segredos-antigos' && !plan.selectedAtLevel.includes(option.id)) openListPanel(createSpellListPanel({
                      title: 'Escolher rituais para o Livro das Sombras',
                      description: 'Escolha duas magias rituais de 1º nível de quaisquer listas de classe.',
                      options: getRitualSpellOptions(1),
                      selectionCount: 2,
                      selected: choices[ancientSecretsRitualChoiceKey(plan.invocationChoiceKey!)] ?? [],
                      apply: (rituals) => {
                        if (!isValidAncientSecretsRitualSelection(rituals)) return null
                        const ritualKey = ancientSecretsRitualChoiceKey(plan.invocationChoiceKey!)
                        setChoices((current) => ({ ...current, [ritualKey]: rituals }))
                        return null
                      },
                    }))
                  }} type={plan.invocationChoice!.choose === 1 ? 'radio' : 'checkbox'} name={plan.invocationChoiceKey} />
                  <span><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}</span>
                </label>)}
                {plan.options.length === 0 && <p>Nenhuma invocação disponível neste nível.</p>}
              </div>}
          </>}
        </fieldset>})}
        {choicesToMake.map(({ feature, choice }) => {
          const key = `${character.characterClassId}:${subclassId}:${feature.level}:${feature.name}:${choice.id}`
          const selected = choices[key] ?? []
          const isWarlockPactChoice = classId === 'bruxo' && choice.id === 'dadiva-do-pacto'
          const isWarlockInvocation = classId === 'bruxo' && choice.id === 'mystic-invocations'
          if (isWarlockInvocation) return null
          const options = choice.options.filter((option) => option.level === undefined || option.level <= targetLevel)
          const choiceId = `feature-${key}`
          return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={key}>
            <legend>{feature.name}: {choice.name} <small>(escolha {choice.choose})</small></legend>
            {feature.description && <p>{feature.description}</p>}
            {options.length > 4
              ? <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createOptionListPanel({
                title: `${feature.name}: ${choice.name}`,
                description: `Escolha ${choice.choose} opção(ões).`,
                options,
                selectionCount: choice.choose,
                selected,
                apply: (next) => {
                  setChoices((current) => ({ ...current, [key]: next }))
                  if (isWarlockPactChoice && next.includes('pacto-do-tomo')) return createTomeCantripPanel(choices[tomeCantripKey] ?? [])
                  if (isWarlockInvocation && next.includes('livro-de-segredos-antigos') && !selected.includes('livro-de-segredos-antigos')) {
                    const ritualKey = ancientSecretsRitualChoiceKey(key)
                    return createSpellListPanel({
                      title: 'Escolher rituais para o Livro das Sombras',
                      description: 'Escolha duas magias rituais de 1º nível de quaisquer listas de classe.',
                      options: getRitualSpellOptions(1),
                      selectionCount: 2,
                      selected: choices[ritualKey] ?? [],
                      apply: (rituals) => {
                        if (!isValidAncientSecretsRitualSelection(rituals)) return null
                        setChoices((current) => ({ ...current, [ritualKey]: rituals }))
                        return null
                      },
                    })
                  }
                  return null
                },
              }))} type="button"><span>{selected.length ? selected.map((id) => options.find(({ id: optionId }) => optionId === id)?.name ?? id).join(', ') : 'Selecionar opções'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
              : <div className="play-sheet__level-up-options">
                {options.map((option) => <label key={option.id}>
                  <input checked={selected.includes(option.id)} disabled={!selected.includes(option.id) && selected.length >= choice.choose} onChange={() => {
                    toggleChoice(key, option.id, choice.choose)
                    if (isWarlockPactChoice && option.id === 'pacto-do-tomo') openListPanel(createTomeCantripPanel())
                    if (isWarlockInvocation && option.id === 'livro-de-segredos-antigos' && !selected.includes(option.id)) {
                      const ritualKey = ancientSecretsRitualChoiceKey(key)
                      openListPanel(createSpellListPanel({
                        title: 'Escolher rituais para o Livro das Sombras',
                        description: 'Escolha duas magias rituais de 1º nível de quaisquer listas de classe.',
                        options: getRitualSpellOptions(1),
                        selectionCount: 2,
                        selected: choices[ritualKey] ?? [],
                        apply: (rituals) => {
                          if (!isValidAncientSecretsRitualSelection(rituals)) return null
                          setChoices((current) => ({ ...current, [ritualKey]: rituals }))
                          return null
                        },
                      }))
                    }
                  }} type={choice.choose === 1 ? 'radio' : 'checkbox'} name={key} />
                  <span><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}</span>
                </label>)}
              </div>}
            {isWarlockPactChoice && selected.includes('pacto-do-tomo') && <div className="play-sheet__level-up-options">
              <span>{tomeCantrips.length} de 3 truques escolhidos para o Livro das Sombras.</span>
              <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createTomeCantripPanel())} type="button"><span>{tomeCantrips.length ? tomeCantrips.join(', ') : 'Escolher truques'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
            </div>}
          </fieldset>
        })}
        {abilityIncreases.map((feature) => {
          const level = feature.level
          const mode = abilityIncreaseModes[level]
          const selectedFeat = feats.find((feat) => feat.id === featSelections[level])
          const featAbilityOptions = selectedFeat?.abilityBonus && 'chooseFrom' in selectedFeat.abilityBonus ? selectedFeat.abilityBonus.chooseFrom : []
          const choiceId = `asi-${level}`
          return <fieldset className="play-sheet__level-up-choice" data-level-up-choice-id={choiceId} data-level-up-incomplete={incompleteChoiceIds.has(choiceId) ? 'true' : undefined} data-level-up-highlighted={pendingChoiceId === choiceId && incompleteChoiceIds.has(choiceId) ? 'true' : undefined} key={choiceId}>
            <legend>Incremento no valor de habilidade — nível {level}</legend>
            <p>Escolha como usar este incremento: aumentar seus atributos ou receber um talento.</p>
            <div className="play-sheet__level-up-options">
              <label><input checked={mode === 'ability'} name={`asi-mode-${level}`} onChange={() => setAbilityIncreaseModes((current) => ({ ...current, [level]: 'ability' }))} type="radio" /><span><strong>Aumento no valor de habilidade</strong><small>+2 em uma habilidade ou +1 em duas.</small></span></label>
              <label><input checked={mode === 'feat'} name={`asi-mode-${level}`} onChange={() => setAbilityIncreaseModes((current) => ({ ...current, [level]: 'feat' }))} type="radio" /><span><strong>Escolher um talento</strong><small>Os pré-requisitos são verificados antes de concluir.</small></span></label>
            </div>
            {mode === 'ability' && (() => {
              const selected = abilitySelections[level] ?? []
              const selectedNames = selected.map((key) => abilityOptions.find(([ability]) => ability === key)?.[1] ?? key)
              return abilityOptions.length > 4
                ? <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createOptionListPanel({
                  title: `Habilidades · nível ${level}`,
                  description: 'Escolha uma habilidade para receber +2, ou duas habilidades para receber +1 em cada.',
                  options: abilityOptions.map(([key, name]) => {
                    const value = Number(effectiveAbilities[key])
                    const increment = selected.length === 1 ? 1 : 2
                    return { id: key, name, description: `${value || '—'}${selected.includes(key) ? ` → ${value + (selected.length === 1 ? 2 : 1)}` : ''}`, disabled: !selected.includes(key) && (selected.length >= 2 || !value || value + increment > 20) }
                  }),
                  selectionCount: 2,
                  minimumSelectionCount: 1,
                  selected,
                  apply: (next) => { setAbilitySelections((current) => ({ ...current, [level]: next })); return null },
                }))} type="button"><span>{selectedNames.length ? selectedNames.join(', ') : 'Selecionar habilidades'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
                : <div className="play-sheet__level-up-options play-sheet__level-up-abilities">
                  {abilityOptions.map(([key, label]) => {
                    const increment = selected.length === 1 ? 2 : 1
                    const value = Number(effectiveAbilities[key])
                    const disabled = !selected.includes(key) && (selected.length >= 2 || !value || value + (selected.length === 1 ? 1 : 2) > 20)
                    return <label key={key}>
                      <input checked={selected.includes(key)} disabled={disabled} onChange={() => toggleAbilityIncrease(level, key)} type="checkbox" />
                      <span><strong>{label}</strong><small>{value || '—'}{selected.includes(key) ? ` → ${value + increment}` : ''}</small></span>
                    </label>
                  })}
                </div>
            })()}
            {mode === 'feat' && <div className="play-sheet__level-up-feats">
              <p>Escolha um talento disponível para este personagem:</p>
              {feats.length > 4
                ? <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createOptionListPanel({
                  title: 'Escolher talento',
                  description: 'Escolha um talento disponível para este personagem. Opções com pré-requisitos não atendidos ficam desabilitadas.',
                  options: feats.map((feat) => {
                    const failure = getFeatFailure(feat, level)
                    return {
                      id: feat.id,
                      name: `${feat.name}${feat.repeatable ? ' · Repetível' : ''}`,
                      description: `${failure ? `Indisponível: ${failure}` : `Pré-requisito: ${feat.prerequisite}.`} ${feat.description}`,
                      disabled: Boolean(failure) && featSelections[level] !== feat.id,
                    }
                  }),
                  selectionCount: 1,
                  selected: featSelections[level] ? [featSelections[level]] : [],
                  apply: (next) => {
                    const feat = feats.find(({ id }) => id === next[0])
                    setFeatSelections((current) => ({ ...current, [level]: next[0] }))
                    setFeatAbilitySelections((current) => ({ ...current, [level]: '' }))
                    if (feat?.abilityBonus && 'chooseFrom' in feat.abilityBonus && feat.abilityBonus.chooseFrom.length > 4) {
                      const bonusAbilities = feat.abilityBonus.chooseFrom
                      return createOptionListPanel({
                        title: `${feat.name}: escolha uma habilidade`,
                        description: 'Escolha uma habilidade para receber o bônus do talento.',
                        options: bonusAbilities.map((ability) => {
                          const name = abilityOptions.find(([key]) => key === ability)?.[1] ?? ability
                          const value = Number(effectiveAbilities[ability])
                          const bonus = getFeatAbilityBonus(feat, effectiveAbilities, ability)
                          return { id: ability, name, description: `${value}${bonus?.amount ? ` → ${value + bonus.amount}` : ' (máximo 20)'}`, disabled: !bonus }
                        }),
                        selectionCount: 1,
                        selected: [],
                        apply: (abilities) => { setFeatAbilitySelections((current) => ({ ...current, [level]: abilities[0] })); return null },
                      })
                    }
                    return null
                  },
                }))} type="button"><span>{selectedFeat?.name ?? 'Selecionar talento'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
                : <div className="play-sheet__level-up-options">
                  {feats.map((feat) => {
                    const failure = getFeatFailure(feat, level)
                    const selected = featSelections[level] === feat.id
                    return <label key={feat.id} title={failure || undefined}>
                      <input checked={selected} disabled={Boolean(failure) && !selected} name={`asi-feat-${level}`} onChange={() => setFeatSelections((current) => ({ ...current, [level]: feat.id }))} type="radio" />
                      <span><strong>{feat.name}{feat.repeatable ? ' · Repetível' : ''}</strong><small>{failure ? `Indisponível: ${failure}` : `Pré-requisito: ${feat.prerequisite}.`}</small><small>{feat.description}</small></span>
                    </label>
                  })}
                </div>}
              {selectedFeat?.abilityBonus && 'chooseFrom' in selectedFeat.abilityBonus && <fieldset className="play-sheet__level-up-choice">
                <legend>{selectedFeat.name}: escolha uma habilidade</legend>
                {featAbilityOptions.length > 4
                  ? <button className="play-sheet__level-up-select-card" onClick={() => openListPanel(createOptionListPanel({
                    title: `${selectedFeat.name}: escolha uma habilidade`,
                    description: 'Escolha uma habilidade para receber o bônus do talento.',
                    options: featAbilityOptions.map((ability) => {
                      const name = abilityOptions.find(([key]) => key === ability)?.[1] ?? ability
                      const bonus = getFeatAbilityBonus(selectedFeat, effectiveAbilities, ability)
                      const value = Number(effectiveAbilities[ability])
                      return { id: ability, name, description: `${value}${bonus?.amount ? ` → ${value + bonus.amount}` : ' (máximo 20)'}`, disabled: !bonus }
                    }),
                    selectionCount: 1,
                    selected: featAbilitySelections[level] ? [featAbilitySelections[level]] : [],
                    apply: (selected) => { setFeatAbilitySelections((current) => ({ ...current, [level]: selected[0] })); return null },
                  }))} type="button"><span>{abilityOptions.find(([key]) => key === featAbilitySelections[level])?.[1] ?? 'Escolher habilidade'}</span><span aria-hidden="true" className="material-symbols-rounded">chevron_right</span></button>
                  : <div className="play-sheet__level-up-options play-sheet__level-up-abilities">
                    {featAbilityOptions.map((ability) => {
                      const label = abilityOptions.find(([key]) => key === ability)?.[1] ?? ability
                      const bonus = getFeatAbilityBonus(selectedFeat, effectiveAbilities, ability)
                      const value = Number(effectiveAbilities[ability])
                      return <label key={ability}><input checked={featAbilitySelections[level] === ability} name={`asi-feat-ability-${level}`} onChange={() => setFeatAbilitySelections((current) => ({ ...current, [level]: ability }))} type="radio" /><span><strong>{label}</strong><small>{value}{bonus?.amount ? ` → ${value + bonus.amount}` : ' (máximo 20)'}</small></span></label>
                    })}
                  </div>}
              </fieldset>}
            </div>}
          </fieldset>
        })}
        {!subclassRequired && choicesToMake.length === 0 && abilityIncreases.length === 0 && wizardSpellLevelsToChoose.length === 0 && bardSecretGroups.length === 0 && spellReplacementLevels.length === 0 && <p>Nenhuma escolha adicional é necessária neste avanço.</p>}
      </div>
      </div>
      {(listPanel || exitingListPanel) && <div aria-hidden={!listPanel} className="play-sheet__level-up-list-view" inert={!listPanel}>
        {renderListPanel(listPanel ?? exitingListPanel!)}
      </div>}
      </div>
    </div>
    </Modal>
  </>
}
