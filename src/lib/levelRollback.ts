import { classFeatures } from './classFeatures'
import type { CharacterDetails, CharacterPlayState, LevelUpHistoryEntry } from './characterData'

function levelInFeatureKey(key: string, classId: string) {
  const abilityIncreasePrefix = `ability-score-increase:${classId}:`
  if (key.startsWith(abilityIncreasePrefix)) {
    const level = Number(key.slice(abilityIncreasePrefix.length).split(':')[0])
    return Number.isSafeInteger(level) ? level : null
  }

  const classPrefix = `${classId}:`
  if (!key.startsWith(classPrefix)) return null
  const parts = key.slice(classPrefix.length).split(':')
  const level = Number(parts[1])
  return Number.isSafeInteger(level) ? level : null
}

function normalizeName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function removeSpell(names: string[], spell: string) {
  const index = names.findIndex((name) => normalizeName(name) === normalizeName(spell))
  if (index >= 0) names.splice(index, 1)
}

function undoSpellChanges(spells: string, history: Record<string, LevelUpHistoryEntry>, targetLevel: number) {
  const hasChangesToUndo = Object.entries(history).some(([level, entry]) => Number(level) > targetLevel && entry.spellChanges?.length)
  if (!hasChangesToUndo) return spells

  let stored: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(spells)
    stored = Array.isArray(parsed)
      ? { cantrips: parsed.filter((name): name is string => typeof name === 'string') }
      : parsed && typeof parsed === 'object' ? { ...parsed as Record<string, unknown> } : {}
  } catch {
    return spells
  }

  const lostLevels = Object.keys(history).map(Number).filter((level) => Number.isSafeInteger(level) && level > targetLevel).sort((a, b) => b - a)
  for (const level of lostLevels) {
    const changes = history[String(level)]?.spellChanges ?? []
    for (const change of [...changes].reverse()) {
      const values = Array.isArray(stored[change.field])
        ? (stored[change.field] as unknown[]).filter((name): name is string => typeof name === 'string')
        : []
      removeSpell(values, change.added)
      if (change.field === 'knownSpells' && Array.isArray(stored.preparedSpells)) {
        const prepared = (stored.preparedSpells as unknown[]).filter((name): name is string => typeof name === 'string')
        removeSpell(prepared, change.added)
        stored.preparedSpells = prepared
      }
      if (change.replaced && !values.some((name) => normalizeName(name) === normalizeName(change.replaced!))) values.push(change.replaced)
      stored[change.field] = values
    }
  }
  return JSON.stringify(stored)
}

function undoInvocationReplacements(choices: Record<string, string[]>, history: Record<string, LevelUpHistoryEntry>, targetLevel: number) {
  for (const level of Object.keys(history).map(Number).filter((value) => value > targetLevel).sort((a, b) => b - a)) {
    for (const replacement of history[String(level)]?.invocationReplacements ?? []) {
      const selected = choices[replacement.sourceKey]
      if (!selected) continue
      choices[replacement.sourceKey] = selected.map((id) => id === replacement.newId ? replacement.oldId : id)
    }
  }
}

export function rollbackCharacterLevels(character: CharacterDetails, targetLevel: number, classSlug = character.characterClassId): CharacterDetails {
  if (targetLevel >= character.level) return character

  const classId = character.characterClassId
  const history = character.levelUpHistory ?? {}
  const lostLevels = Object.keys(history).map(Number).filter((level) => Number.isSafeInteger(level) && level > targetLevel)
  const nextAbilities = { ...character.abilities }
  const nextAbilityIncreases = character.abilityScoreIncreases?.classId === classId
    ? { ...character.abilityScoreIncreases.selections }
    : undefined
  for (const [key, abilities] of Object.entries(nextAbilityIncreases ?? {})) {
    const level = levelInFeatureKey(key, classId)
    if (level === null || level <= targetLevel) continue
    const amount = abilities.length === 1 ? 2 : 1
    for (const ability of abilities) {
      const score = Number(nextAbilities[ability])
      if (Number.isFinite(score)) nextAbilities[ability] = String(score - amount)
    }
    delete nextAbilityIncreases![key]
  }

  const featAbilityIncreases = { ...(character.featAbilityIncreases ?? {}) }
  for (const [key, increase] of Object.entries(featAbilityIncreases)) {
    const level = levelInFeatureKey(key, classId)
    if (level === null || level <= targetLevel) continue
    const score = Number(nextAbilities[increase.ability])
    if (Number.isFinite(score)) nextAbilities[increase.ability] = String(score - increase.amount)
    delete featAbilityIncreases[key]
  }

  let classFeatureChoices = { ...character.classFeatureChoices }
  undoInvocationReplacements(classFeatureChoices, history, targetLevel)
  classFeatureChoices = Object.fromEntries(Object.entries(classFeatureChoices).filter(([key]) => {
    const level = levelInFeatureKey(key, classId)
    return level === null || level <= targetLevel
  }))

  const subclass = classFeatures[classSlug]?.subclasses.find(({ id }) => id === character.classSubclassId)
  const losesSubclass = Boolean(subclass && targetLevel < subclass.selectionLevel)
  if (losesSubclass && character.classSubclassId) {
    const prefix = `${classId}:${character.classSubclassId}:`
    classFeatureChoices = Object.fromEntries(Object.entries(classFeatureChoices).filter(([key]) => !key.startsWith(prefix)))
  }

  const nextHistory = { ...history }
  for (const level of lostLevels) delete nextHistory[String(level)]

  let equipment = character.equipment
  if (classSlug === 'bruxo' && targetLevel < 3) {
    try {
      const parsed: unknown = JSON.parse(equipment)
      const storedInventory = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as { version?: unknown; entries?: unknown }
        : null
      if (storedInventory?.version === 2 && Array.isArray(storedInventory.entries)) {
        const entries = storedInventory.entries.filter((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry)
          || (entry as { source?: unknown }).source !== 'feature:livro-das-sombras')
        equipment = JSON.stringify({ ...storedInventory, entries })
      }
    } catch {
      // Keep legacy inventory text unchanged when it cannot be safely inspected.
    }
  }

  return {
    ...character,
    level: targetLevel,
    maxHp: String(Math.max(1, (Number(character.maxHp) || 1) - lostLevels.reduce((total, level) => total + (history[String(level)]?.hitPointGain ?? 0), 0))),
    classFeatureChoices,
    classSubclassId: losesSubclass ? '' : character.classSubclassId,
    primalPath: classId === 'barbaro' && targetLevel < 3 ? '' : character.primalPath,
    primalTotemChoices: {
      spiritualTotem: targetLevel < 3 ? '' : character.primalTotemChoices.spiritualTotem,
      beastAspect: targetLevel < 6 ? '' : character.primalTotemChoices.beastAspect,
      totemicAttunement: targetLevel < 14 ? '' : character.primalTotemChoices.totemicAttunement,
    },
    abilities: nextAbilities,
    ...(nextAbilityIncreases ? { abilityScoreIncreases: { classId, selections: nextAbilityIncreases } } : {}),
    featAbilityIncreases,
    spells: undoSpellChanges(character.spells, history, targetLevel),
    equipment,
    levelUpHistory: nextHistory,
  }
}

export function rollbackPlayStateForLevel(playState: CharacterPlayState | undefined, targetLevel: number, maxHp: number) {
  if (!playState) return undefined
  return {
    ...playState,
    currentHp: Math.min(playState.currentHp, maxHp),
    spentHitDice: Math.min(playState.spentHitDice, targetLevel),
  }
}
