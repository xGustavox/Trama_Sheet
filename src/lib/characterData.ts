export type AbilityScoreMethod = 'manual-roll' | 'standard-array' | 'point-buy'
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

export type CharacterPlayState = {
  currentHp: number
  temporaryHp: number
  spentSpellSlots: string[]
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
  abilityScoreMethod: AbilityScoreMethod | ''
  abilities: Record<string, string>
  abilityScoreIncreases?: AbilityScoreIncreases
  featAbilityIncreases?: Record<string, { ability: string; amount: number }>
  racialAbilityChoices: string[]
  raceLanguageChoices: string[]
  backgroundLanguageChoices: string[]
  merchantAlternative: 'navigator-tools' | 'language' | ''
  appliedRacialBonuses: Record<string, number>
  skillProficiencies: string[]
  bardInstrumentChoices: string[]
  toolProficiencyChoices: string[]
  backgroundEquipmentChoice: string
  equipment: string
  spells: string
  feats: string
  playState?: CharacterPlayState
  activeConditions?: string[]
  frameColor?: string
  darkMode?: boolean
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
