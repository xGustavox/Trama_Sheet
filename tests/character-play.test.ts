import assert from 'node:assert/strict'
import test from 'node:test'
import type { CharacterDetails, CharacterPlayState } from '../src/lib/characterData'
import { availableSpellSlotLevels, availableSpellSlots, getInitialCharacterPlayState, recoverFromLongRest, recoverFromShortRest, toggleSpellSlot } from '../src/lib/characterPlay'

const spentState: CharacterPlayState = {
  currentHp: 3,
  temporaryHp: 4,
  spentSpellSlots: ['1:0', '2:0'],
}

test('initial play state preserves saved resources and defaults new characters to full hit points', () => {
  assert.deepEqual(getInitialCharacterPlayState({ maxHp: '15', playState: spentState } as CharacterDetails), spentState)
  assert.deepEqual(getInitialCharacterPlayState({ maxHp: '15' } as CharacterDetails), {
    currentHp: 15,
    temporaryHp: 0,
    spentSpellSlots: [],
  })
})

test('long rest restores hit points and all spell slots, and clears temporary hit points', () => {
  assert.deepEqual(recoverFromLongRest(17), {
    currentHp: 17,
    temporaryHp: 0,
    spentSpellSlots: [],
  })
})

test('short rest restores warlock pact slots but preserves other classes’ spell slots', () => {
  assert.deepEqual(recoverFromShortRest(spentState, 'bruxo'), {
    ...spentState,
    spentSpellSlots: [],
  })
  assert.equal(recoverFromShortRest(spentState, 'bardo'), spentState)
})

test('spell slot toggle marks one slot spent and toggles that same slot back', () => {
  const oneSpent = toggleSpellSlot({ ...spentState, spentSpellSlots: [] }, '2:1')
  assert.deepEqual(oneSpent.spentSpellSlots, ['2:1'])
  assert.deepEqual(toggleSpellSlot(oneSpent, '2:1').spentSpellSlots, [])
})

test('casting offers only unspent slots at the spell level or higher', () => {
  assert.deepEqual(availableSpellSlots([2, 2, 1], ['1:0', '2:1'], 2), ['2:0', '3:0'])
  assert.deepEqual(availableSpellSlotLevels([2, 2, 1], ['1:0', '2:1'], 2), [2, 3])
  assert.deepEqual(availableSpellSlotLevels([2, 2, 1], ['1:0', '2:1', '2:0', '3:0'], 2), [])
  assert.deepEqual(availableSpellSlots([2, 2, 1], ['1:0', '2:1', '2:0', '3:0'], 2), [])
})
