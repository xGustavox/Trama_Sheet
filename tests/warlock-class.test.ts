import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, planWarlockInvocationChoices, warlockInvocationIsAvailable, warlockSpellProgression } from '../src/lib/classFeatures'

const invocationChoiceForLevel = (level: number) => classFeatures.bruxo.features
  .find((feature) => feature.level === level && feature.choices?.some((choice) => choice.id === 'mystic-invocations'))!
  .choices!.find((choice) => choice.id === 'mystic-invocations')!

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

test('warlock replacement is applied before new invocation choices and can free the replaced invocation', () => {
  const options = classFeatures.bruxo.features.flatMap((feature) =>
    (feature.choices ?? []).filter((choice) => choice.id === 'mystic-invocations').flatMap((choice) => choice.options),
  )
  const choice = invocationChoiceForLevel(4)
  const replacement = { 4: { oldId: 'armadura-de-sombras', newId: 'explosao-agonizante' } }
  const initialPlan = planWarlockInvocationChoices({
    levels: [4],
    knownIds: ['armadura-de-sombras', 'idioma-bestial'],
    options,
    choicesByLevel: { 4: { key: 'warlock:4', choice } },
    selectedChoices: {},
    replacements: replacement,
  })[0]

  assert.equal(initialPlan.replacementApplied, true)
  assert.ok(initialPlan.options.some((option) => option.id === 'armadura-de-sombras'))
  assert.ok(!initialPlan.options.some((option) => option.id === 'explosao-agonizante'))
  assert.ok(!initialPlan.options.some((option) => option.id === 'idioma-bestial'))

  const completedPlan = planWarlockInvocationChoices({
    levels: [4],
    knownIds: ['armadura-de-sombras', 'idioma-bestial'],
    options,
    choicesByLevel: { 4: { key: 'warlock:4', choice } },
    selectedChoices: { 'warlock:4': ['armadura-de-sombras'] },
    replacements: replacement,
  })[0]
  assert.equal(completedPlan.selectedAtLevelIsValid, true)
})

test('warlock cannot choose an invocation already selected at an earlier gained level', () => {
  const options = classFeatures.bruxo.features.flatMap((feature) =>
    (feature.choices ?? []).filter((choice) => choice.id === 'mystic-invocations').flatMap((choice) => choice.options),
  )
  const choiceAtFour = invocationChoiceForLevel(4)
  const choiceAtSix = invocationChoiceForLevel(6)
  const plans = planWarlockInvocationChoices({
    levels: [4, 5, 6],
    knownIds: ['armadura-de-sombras'],
    options,
    choicesByLevel: { 4: { key: 'warlock:4', choice: choiceAtFour }, 6: { key: 'warlock:6', choice: choiceAtSix } },
    selectedChoices: { 'warlock:4': ['explosao-agonizante'], 'warlock:6': ['explosao-agonizante'] },
    replacements: {},
  })

  assert.ok(!plans[1].options.some((option) => option.id === 'explosao-agonizante'))
  assert.equal(plans[2].selectedAtLevelIsValid, false)
})
