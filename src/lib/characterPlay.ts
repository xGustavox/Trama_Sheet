import type { CharacterDetails, CharacterPlayState } from './characterData'

export function getInitialCharacterPlayState(character: CharacterDetails): CharacterPlayState {
  return character.playState ?? {
    currentHp: Number(character.maxHp) || 0,
    temporaryHp: 0,
    spentSpellSlots: [],
  }
}

export function recoverFromShortRest(state: CharacterPlayState, characterClassId: string): CharacterPlayState {
  if (characterClassId !== 'bruxo') return state
  return { ...state, spentSpellSlots: [] }
}

export function recoverFromLongRest(maxHp: number): CharacterPlayState {
  return { currentHp: maxHp, temporaryHp: 0, spentSpellSlots: [] }
}

export function toggleSpellSlot(state: CharacterPlayState, slotId: string): CharacterPlayState {
  const spentSpellSlots = state.spentSpellSlots.includes(slotId)
    ? state.spentSpellSlots.filter((id) => id !== slotId)
    : [...state.spentSpellSlots, slotId]
  return { ...state, spentSpellSlots }
}

export function availableSpellSlots(spellSlots: number[], spentSpellSlots: string[], minimumLevel: number) {
  return spellSlots.flatMap((count, index) => {
    const level = index + 1
    if (level < minimumLevel) return []
    return Array.from({ length: count }, (_, slotIndex) => `${level}:${slotIndex}`)
      .filter((slotId) => !spentSpellSlots.includes(slotId))
  })
}

export function availableSpellSlotLevels(spellSlots: number[], spentSpellSlots: string[], minimumLevel: number) {
  return [...new Set(availableSpellSlots(spellSlots, spentSpellSlots, minimumLevel).map((slotId) => Number(slotId.split(':')[0])))]
}
