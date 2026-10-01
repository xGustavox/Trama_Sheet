import type { CharacterDetails, CharacterPlayState } from './characterData'

export function getInitialCharacterPlayState(character: CharacterDetails): CharacterPlayState {
  const state = character.playState ?? {
    currentHp: Number(character.maxHp) || 0,
    temporaryHp: 0,
    spentSpellSlots: [],
  }
  const maxHp = Math.max(0, Number(character.maxHp) || 0)
  return {
    ...state,
    currentHp: Math.max(0, Math.min(maxHp, Number(state.currentHp) || 0)),
    temporaryHp: Math.max(0, Number(state.temporaryHp) || 0),
  }
}

export function adjustHitPoints(state: CharacterPlayState, currentHpChange: number, temporaryHpChange: number, maxHp: number): CharacterPlayState {
  return {
    ...state,
    currentHp: Math.max(0, Math.min(Math.max(0, maxHp), state.currentHp + Math.trunc(currentHpChange))),
    temporaryHp: Math.max(0, state.temporaryHp + Math.trunc(temporaryHpChange)),
  }
}

export function applyHitPointAdjustment(startingState: CharacterPlayState, adjustment: number, maxHp: number): CharacterPlayState {
  const netAdjustment = Math.trunc(adjustment)
  if (netAdjustment >= 0) {
    return {
      ...startingState,
      currentHp: Math.min(Math.max(0, maxHp), startingState.currentHp + netAdjustment),
    }
  }

  const damage = -netAdjustment
  const temporaryDamage = Math.min(startingState.temporaryHp, damage)
  const currentDamage = Math.min(startingState.currentHp, Math.max(0, damage - startingState.temporaryHp))
  return {
    ...startingState,
    currentHp: startingState.currentHp - currentDamage,
    temporaryHp: startingState.temporaryHp - temporaryDamage,
  }
}

export function applyHitPointDamage(state: CharacterPlayState, amount: number): CharacterPlayState {
  let remainingDamage = Math.max(0, Math.trunc(amount))
  const temporaryDamage = Math.min(state.temporaryHp, remainingDamage)
  remainingDamage -= temporaryDamage
  return {
    ...state,
    temporaryHp: state.temporaryHp - temporaryDamage,
    currentHp: Math.max(0, state.currentHp - remainingDamage),
  }
}

export function healHitPoints(state: CharacterPlayState, amount: number, maxHp: number): CharacterPlayState {
  return {
    ...state,
    currentHp: Math.min(Math.max(0, maxHp), state.currentHp + Math.max(0, Math.trunc(amount))),
  }
}

export function setTemporaryHitPoints(state: CharacterPlayState, amount: number): CharacterPlayState {
  return { ...state, temporaryHp: Math.max(0, Math.trunc(amount)) }
}

export function recoverFromShortRest(state: CharacterPlayState, characterClassId: string): CharacterPlayState {
  if (characterClassId !== 'bruxo') return state
  return { ...state, spentSpellSlots: [] }
}

export function recoverFromLongRest(maxHp: number): CharacterPlayState {
  return { currentHp: maxHp, temporaryHp: 0, spentSpellSlots: [], deathSaveSuccesses: [], deathSaveFailures: [] }
}

export function toggleDeathSaveMark(marks: boolean[], index: number): boolean[] {
  return Array.from({ length: 3 }, (_, current) => current === index ? !Boolean(marks[current]) : Boolean(marks[current]))
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
