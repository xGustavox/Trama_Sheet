export type AbilityScoreMethod = 'manual-roll' | 'standard-array' | 'point-buy'
export type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
export type PrimalPath = 'berserker' | 'totem-warrior' | ''
export type PrimalTotem = 'eagle' | 'wolf' | 'bear' | ''
export type PrimalTotemChoices = {
  spiritualTotem: PrimalTotem
  beastAspect: PrimalTotem
  totemicAttunement: PrimalTotem
}

export type AbilityScoreIncreases = {
  classId: string
  selections: Record<string, string[]>
}

export type LevelUpHistoryEntry = {
  hitPointGain?: number
  hitPointMode?: 'average' | 'rolled'
  hitPointRoll?: number
  spellChanges?: { field: 'knownSpells' | 'bonusSpells' | 'bonusCantrips'; added: string; replaced?: string; source?: 'class-progression' }[]
  invocationReplacements?: { sourceKey: string; oldId: string; newId: string }[]
}

export type CharacterPlayState = {
  currentHp: number
  temporaryHp: number
  spentSpellSlots: string[]
  spentHitDice: number
  usedInvocationSpellUses?: string[]
  deathSaveSuccesses?: boolean[]
  deathSaveFailures?: boolean[]
}

export type CharacterDetails = {
  name: string
  level: number
  experiencePoints: string
  maxHp: string
  portraitUrl: string
  portraitPath: string
  raceId: string
  racialChoice: string
  characterClassId: string
  classSubclassId: string
  classFeatureChoices: Record<string, string[]>
  primalPath: PrimalPath
  primalTotemChoices: PrimalTotemChoices
  backgroundId: string
  age: string
  height: string
  weight: string
  alignment: string
  eyeColor?: string
  skin?: string
  hair?: string
  personalityTraits?: string
  ideals?: string
  bonds?: string
  flaws?: string
  backstory?: string
  notes?: string
  abilityScoreMethod: AbilityScoreMethod | ''
  abilities: Record<string, string>
  abilityScoreOverrides?: Partial<Record<AbilityKey, number>>
  abilityScoreIncreases?: AbilityScoreIncreases
  featAbilityIncreases?: Record<string, { ability: string; amount: number }>
  levelUpHistory?: Record<string, LevelUpHistoryEntry>
  racialAbilityChoices: string[]
  raceLanguageChoices: string[]
  backgroundLanguageChoices: string[]
  backgroundSkillChoices?: string[]
  merchantAlternative: 'navigator-tools' | 'language' | ''
  appliedRacialBonuses: Record<string, number>
  skillProficiencies: string[]
  bardInstrumentChoices: string[]
  toolProficiencyChoices: string[]
  backgroundEquipmentChoice: string
  equipment: string
  spells: string
  feats: string
  armorClassOverride?: number
  movementSpeedOverride?: number
  playState?: CharacterPlayState
  activeConditions?: string[]
  frameColor?: string
  darkMode?: boolean
  sheetBackgroundPath?: string
  sheetBackgroundUrl?: string
}

const abilityKeys: AbilityKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']

export function getEffectiveAbilityScores(character: Pick<CharacterDetails, 'abilities' | 'abilityScoreOverrides'>) {
  const effective = { ...character.abilities }
  for (const key of abilityKeys) {
    const override = character.abilityScoreOverrides?.[key]
    if (Number.isSafeInteger(override) && override! >= 1 && override! <= 30) effective[key] = String(override)
  }
  return effective
}

export type CharacterDraft = {
  id: string
  character: CharacterDetails
  furthestStep: number
  lastStep: number
}

export type CharacterRecord = {
  id: string
  name: string
  level: number
  experience_points: number
  max_hit_points: number | null
  portrait_path: string | null
  race_id: string | null
  character_class_id: string | null
  background_id: string | null
  details: CharacterDetails
  created_at: string
  race: { name: string } | null
  character_class: { name: string } | null
  background: { name: string } | null
  portrait_url?: string
}
