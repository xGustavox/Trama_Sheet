import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, warlockInvocationIsAvailable, warlockSpellProgression } from '../src/lib/classFeatures'

test('warlock spell, pact-slot and invocation progression matches the reference at all levels', () => {
  assert.deepEqual(warlockSpellProgression, [
    [2, 2, 1, 1, 0], [2, 3, 2, 1, 2], [2, 4, 2, 2, 2], [3, 5, 2, 2, 3], [3, 6, 2, 3, 3],
    [3, 7, 2, 3, 4], [3, 8, 2, 4, 4], [3, 9, 2, 4, 4], [3, 10, 2, 5, 5], [4, 10, 2, 5, 5],
    [4, 11, 3, 5, 5], [4, 11, 3, 5, 6], [4, 12, 3, 5, 6], [4, 12, 3, 5, 6], [4, 13, 3, 5, 7],
    [4, 13, 3, 5, 7], [4, 14, 4, 5, 7], [4, 14, 4, 5, 8], [4, 15, 4, 5, 8], [4, 15, 4, 5, 8],
  ])
})

test('warlock gets the reference ASIs, invocation choices and patron feature levels', () => {
  const warlock = classFeatures.bruxo
  assert.deepEqual(
    warlock.features.filter(feature => feature.name === 'Incremento no Valor de Habilidade').map(feature => feature.level),
    [4, 8, 12, 16, 19],
  )
  const invocationChoices = warlock.features.flatMap(feature =>
    feature.choices?.filter(choice => choice.id === 'mystic-invocations').map(choice => [feature.level, choice.choose]) ?? [],
  )
  assert.deepEqual(invocationChoices, [[2, 2], [4, 1], [6, 1], [9, 1], [12, 1], [15, 1], [18, 1]])
  const initialInvocations = warlock.features.find(feature => feature.level === 2)?.choices?.[0].options ?? []
  assert.equal(new Set(initialInvocations.map(option => option.id)).size, initialInvocations.length)
  assert.equal(initialInvocations.length, 32)
  const chainInvocation = initialInvocations.find(option => option.id === 'voz-do-mestre-das-correntes')!
  const bladeInvocation = initialInvocations.find(option => option.id === 'lamina-sedenta')!
  const unrestrictedInvocation = initialInvocations.find(option => option.id === 'mascara-das-muitas-faces')!
  assert.equal(warlockInvocationIsAvailable(chainInvocation, 'pacto-da-corrente'), true)
  assert.equal(warlockInvocationIsAvailable(chainInvocation, 'pacto-da-lamina'), false)
  assert.equal(warlockInvocationIsAvailable(bladeInvocation, 'pacto-do-tomo'), false)
  assert.equal(warlockInvocationIsAvailable(unrestrictedInvocation, undefined), true)
  assert.deepEqual(
    warlock.subclasses.map(subclass => [subclass.id, subclass.selectionLevel, subclass.features.filter(feature => feature.name !== 'Lista de Magia Expandida').map(feature => feature.level)]),
    [
      ['arquifada', 1, [1, 6, 10, 14]],
      ['o-corruptor', 1, [1, 6, 10, 14]],
      ['o-grande-antigo', 1, [1, 6, 10, 14]],
    ],
  )
})
