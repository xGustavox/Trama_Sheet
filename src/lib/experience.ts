import type { CharacterDetails } from './characterData'
import { getNewlyKnownSpellCountAtClassLevel, type ClassFeatureData } from './classFeatures'

export const experienceThresholds = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
] as const

export function formatExperienceInput(value: string | number) {
  const digits = String(value).replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function parseExperienceInput(value: string) {
  return value.replace(/\D/g, '')
}

export function levelForExperience(experience: number) {
  const safeExperience = Math.max(0, Math.trunc(Number.isFinite(experience) ? experience : 0))
  return experienceThresholds.reduce((level, threshold, index) => safeExperience >= threshold ? index + 1 : level, 1)
}

export function hitPointGainForLevel(hitDieSize: number, constitutionModifier: number, rolledResult?: number) {
  const dieValue = rolledResult ?? Math.ceil((hitDieSize + 1) / 2)
  return Math.max(1, dieValue + constitutionModifier)
}

export function hasConfirmedAbilityIncrease(character: CharacterDetails, level: number) {
  const key = `ability-score-increase:${character.characterClassId}:${level}`
  const mode = character.classFeatureChoices[`${key}:mode`]?.[0]
  if (mode === 'feat') return Boolean(character.classFeatureChoices[`${key}:feat`]?.[0])
  const selected = character.classFeatureChoices[key] ?? []
  const confirmed = character.abilityScoreIncreases?.classId === character.characterClassId
    ? character.abilityScoreIncreases.selections[key]
    : undefined
  return (selected.length === 1 || selected.length === 2) && JSON.stringify(selected) === JSON.stringify(confirmed)
}

export function hasLevelUpChoices(character: CharacterDetails, classId: string, classData: ClassFeatureData | undefined, targetLevel: number) {
  if (targetLevel <= character.level) return false
  if (classId === 'barbaro') {
    if (character.level < 3 && targetLevel >= 3 && !character.primalPath) return true
    if (character.primalPath === 'totem-warrior' && [
      [3, 'spiritualTotem'],
      [6, 'beastAspect'],
      [14, 'totemicAttunement'],
    ].some(([level, key]) => character.level < Number(level) && targetLevel >= Number(level) && !character.primalTotemChoices[key as 'spiritualTotem' | 'beastAspect' | 'totemicAttunement'])) return true
  }
  if (classId === 'bruxo' && targetLevel > character.level) {
    const invocationPrefix = `${character.characterClassId}:${character.classSubclassId}:`
    if (Object.entries(character.classFeatureChoices).some(([key, selected]) =>
      key.startsWith(invocationPrefix) && key.endsWith(':mystic-invocations') && selected.length > 0,
    )) return true
  }
  if (Array.from({ length: targetLevel - character.level }, (_, index) => character.level + index + 1)
    .some((level) => getNewlyKnownSpellCountAtClassLevel(classId, character.classSubclassId, level) > 0)) return true
  const canReplaceKnownSpells = ['bardo', 'bruxo', 'feiticeiro', 'patrulheiro'].includes(classId)
    || classId === 'guerreiro' && character.classSubclassId === 'cavaleiro-arcano'
    || classId === 'ladino' && character.classSubclassId === 'trapaceiro-arcano'
  if (canReplaceKnownSpells && targetLevel > character.level) {
    try {
      const spells: unknown = JSON.parse(character.spells)
      if (spells && typeof spells === 'object' && !Array.isArray(spells)
        && Array.isArray((spells as { knownSpells?: unknown }).knownSpells)
        && (spells as { knownSpells: unknown[] }).knownSpells.some((spell) => typeof spell === 'string')) return true
    } catch {
      // Invalid saved spell data must not prevent ordinary level-up choices.
    }
  }
  if (!classData) return false
  const subclassLevel = classData.subclasses[0]?.selectionLevel
  if (subclassLevel && character.level < subclassLevel && targetLevel >= subclassLevel && !character.classSubclassId) return true

  const selectedSubclass = classData.subclasses.find((subclass) => subclass.id === character.classSubclassId)
  const features = [
    ...classData.features.filter((feature) => feature.level > character.level && feature.level <= targetLevel),
    ...(selectedSubclass?.features.filter((feature) => feature.level > character.level && feature.level <= targetLevel) ?? []),
  ]
  return features.some((feature) =>
    (feature.name.toLocaleLowerCase('pt-BR').includes('incremento no valor de habilidade') && !hasConfirmedAbilityIncrease(character, feature.level)) ||
    (feature.choices ?? []).some((choice) => {
      const key = `${character.characterClassId}:${character.classSubclassId}:${feature.level}:${feature.name}:${choice.id}`
      return (character.classFeatureChoices[key]?.length ?? 0) < choice.choose
    }),
  )
}
