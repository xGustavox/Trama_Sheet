import assert from 'node:assert/strict'
import test from 'node:test'
import type { CharacterDetails, CharacterPlayState } from '../src/lib/characterData'
import { adjustHitPoints, applyHitPointDamage, availableSpellSlotLevels, availableSpellSlots, getInitialCharacterPlayState, healHitPoints, recoverFromLongRest, recoverFromShortRest, setTemporaryHitPoints, toggleSpellSlot } from '../src/lib/characterPlay'

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

test('damage consumes temporary hit points first and carries excess damage into current hit points', () => {
  assert.deepEqual(applyHitPointDamage({ ...spentState, currentHp: 12, temporaryHp: 4 }, 2), {
    ...spentState,
    currentHp: 12,
    temporaryHp: 2,
  })
  assert.deepEqual(applyHitPointDamage({ ...spentState, currentHp: 12, temporaryHp: 4 }, 7), {
    ...spentState,
    currentHp: 9,
    temporaryHp: 0,
  })
  assert.deepEqual(applyHitPointDamage({ ...spentState, currentHp: 2, temporaryHp: 0 }, 5), {
    ...spentState,
    currentHp: 0,
    temporaryHp: 0,
  })
})

test('healing restores normal hit points only and never exceeds the maximum', () => {
  assert.deepEqual(healHitPoints({ ...spentState, currentHp: 12, temporaryHp: 4 }, 5, 15), {
    ...spentState,
    currentHp: 15,
    temporaryHp: 4,
  })
  assert.equal(healHitPoints({ ...spentState, currentHp: 15 }, 3, 15).currentHp, 15)
})

test('temporary hit points replace rather than add, and direct adjustments stay within HP bounds', () => {
  assert.equal(setTemporaryHitPoints({ ...spentState, temporaryHp: 4 }, 10).temporaryHp, 10)
  assert.equal(setTemporaryHitPoints({ ...spentState, temporaryHp: 4 }, 0).temporaryHp, 0)
  assert.deepEqual(adjustHitPoints({ ...spentState, currentHp: 14, temporaryHp: 3 }, 5, -2, 15), {
    ...spentState,
    currentHp: 15,
    temporaryHp: 1,
  })
  assert.deepEqual(adjustHitPoints({ ...spentState, currentHp: 2 }, -5, -5, 15), {
    ...spentState,
    currentHp: 0,
    temporaryHp: 0,
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
