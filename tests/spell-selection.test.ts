import assert from 'node:assert/strict'
import test from 'node:test'
import { getKnownSpellCountAtClassLevel, getMaximumSpellCountAtOrAboveLevel, getSpellLearningThreshold, getSpellSlotsAtClassLevel } from '../src/lib/classFeatures'
import { canSelectSpellAtSlot, groupSpellChoicesByLevel } from '../src/lib/spellSelection'

test('known-spell area capacity follows class-level progression, independently from spell slots', () => {
  assert.deepEqual([1, 2, 3].map((level) => getKnownSpellCountAtClassLevel('bardo', '', level)), [4, 5, 6])
  assert.deepEqual([1, 2, 3].map((level) => getSpellSlotsAtClassLevel('bardo', '', level)), [[2], [3], [4, 2]])
  assert.deepEqual([1, 2, 3].map((level) => getKnownSpellCountAtClassLevel('mago', '', level)), [6, 8, 10])
  assert.deepEqual([1, 2, 3].map((level) => getKnownSpellCountAtClassLevel('bruxo', '', level)), [2, 3, 4])
  assert.deepEqual([1, 2, 3].map((level) => getKnownSpellCountAtClassLevel('feiticeiro', '', level)), [2, 3, 4])
  assert.deepEqual([1, 2, 3].map((level) => getKnownSpellCountAtClassLevel('patrulheiro', '', level)), [0, 2, 3])
  assert.equal(getKnownSpellCountAtClassLevel('guerreiro', 'cavaleiro-arcano', 2), null)
  assert.equal(getKnownSpellCountAtClassLevel('guerreiro', 'cavaleiro-arcano', 3), 3)
  assert.equal(getKnownSpellCountAtClassLevel('ladino', 'trapaceiro-arcano', 3), 3)
})

test('learned-spell classes unlock each spell tier after the previous-level known-spell quota', () => {
  assert.equal(getSpellLearningThreshold('bardo', '', 1), 0)
  assert.equal(getSpellLearningThreshold('bardo', '', 2), 5)
  assert.equal(getSpellLearningThreshold('bardo', '', 3), 7)
  assert.equal(getSpellLearningThreshold('feiticeiro', '', 2), 3)
  assert.equal(getSpellLearningThreshold('bruxo', '', 3), 5)
  assert.equal(getSpellLearningThreshold('patrulheiro', '', 2), 3)
  assert.equal(getSpellLearningThreshold('patrulheiro', '', 3), 5)
})

test('wizard spellbook and half-caster subclass thresholds follow their own progressions', () => {
  assert.equal(getSpellLearningThreshold('mago', '', 2), 8)
  assert.equal(getSpellLearningThreshold('mago', '', 3), 12)
  assert.equal(getSpellLearningThreshold('guerreiro', 'cavaleiro-arcano', 2), 4)
  assert.equal(getSpellLearningThreshold('ladino', 'trapaceiro-arcano', 3), 8)
})

test('prepared casters do not have a learned-spell tier gate', () => {
  assert.equal(getSpellLearningThreshold('clerigo', '', 2), null)
  assert.equal(getSpellLearningThreshold('druida', '', 3), null)
  assert.equal(getSpellLearningThreshold('paladino', '', 2), null)
})

test('known spell limits account for replacements at each level without requiring historical selections', () => {
  assert.equal(getMaximumSpellCountAtOrAboveLevel('bruxo', '', 4, 2), 4)
  assert.equal(getMaximumSpellCountAtOrAboveLevel('bruxo', '', 4, 3), 0)
  assert.equal(getMaximumSpellCountAtOrAboveLevel('bruxo', '', 5, 2), 6)
  assert.equal(getMaximumSpellCountAtOrAboveLevel('bruxo', '', 5, 3), 2)
  assert.equal(getMaximumSpellCountAtOrAboveLevel('mago', '', 4, 2), 4)

  const warlockLevelFourLimit = (level: number) => getMaximumSpellCountAtOrAboveLevel('bruxo', '', 4, level)
  assert.equal(canSelectSpellAtSlot([1, 1, 1, 2, 0], 4, 2, warlockLevelFourLimit, 2), true)
  assert.equal(canSelectSpellAtSlot([1, 1, 1, 2, 0], 4, 1, warlockLevelFourLimit, 2), true)
  assert.equal(canSelectSpellAtSlot([2, 2, 2, 2, 0], 4, 2, warlockLevelFourLimit, 2), false)
  assert.equal(canSelectSpellAtSlot([1, 1, 1, 2, 0], 0, 2, warlockLevelFourLimit, 2), true)
  assert.equal(canSelectSpellAtSlot([1, 2, 2, 2, 2], 0, 2, warlockLevelFourLimit, 2), false)
  assert.equal(canSelectSpellAtSlot([1, 1], 2, 2, warlockLevelFourLimit, 2), false)
})

test('one selection panel preserves selected spell levels and still enforces bard progression limits', () => {
  assert.deepEqual(groupSpellChoicesByLevel(
    ['Invisibilidade', 'Curar Ferimentos', 'Passo Nebuloso'],
    { 'Curar Ferimentos': 1, Invisibilidade: 2, 'Passo Nebuloso': 2 },
  ), {
    1: ['Curar Ferimentos'],
    2: ['Invisibilidade', 'Passo Nebuloso'],
  })

  const bardLevelThreeLimit = (level: number) => getMaximumSpellCountAtOrAboveLevel('bardo', '', 3, level)
  assert.equal(bardLevelThreeLimit(2), 2)
  assert.equal(canSelectSpellAtSlot([1, 1, 1, 1, 1, 2], 0, 2, bardLevelThreeLimit, 2), true)
  assert.equal(canSelectSpellAtSlot([1, 1, 1, 1, 2, 2], 0, 2, bardLevelThreeLimit, 2), false)
})
