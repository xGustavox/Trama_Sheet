import assert from 'node:assert/strict'
import test from 'node:test'
import { bardSpellProgression, classFeatures } from '../src/lib/classFeatures'

test('bard spell progression matches the reference at all 20 levels', () => {
  assert.equal(bardSpellProgression.length, 20)
  assert.deepEqual(bardSpellProgression.map(([cantrips]) => cantrips), [
    2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  ])
  assert.deepEqual(bardSpellProgression.map(([, known]) => known), [
    4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 22,
  ])
  assert.deepEqual(bardSpellProgression.map(([, , slots]) => slots), [
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
    [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
    [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
  ])
})

test('bard subclass features and Expertise are granted at the levels shown in the reference', () => {
  const bard = classFeatures.bardo
  assert.deepEqual(
    bard.features.filter(feature => feature.name === 'Aptidão').map(feature => feature.level),
    [3, 10],
  )
  assert.deepEqual(
    bard.subclasses.map(subclass => [subclass.id, subclass.selectionLevel, subclass.features.map(feature => feature.level)]),
    [
      ['colegio-do-conhecimento', 3, [3, 3, 6, 14]],
      ['colegio-da-bravura', 3, [3, 3, 6, 14]],
    ],
  )
})
