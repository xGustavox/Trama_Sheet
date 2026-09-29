import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, druidSpellProgression } from '../src/lib/classFeatures'

test('druid cantrip and spell-slot progression matches the reference for every level', () => {
  assert.deepEqual(druidSpellProgression, [
    [2, [2]], [2, [3]], [2, [4, 2]], [3, [4, 3]], [3, [4, 3, 2]],
    [3, [4, 3, 3]], [3, [4, 3, 3, 1]], [3, [4, 3, 3, 2]], [3, [4, 3, 3, 3, 1]], [4, [4, 3, 3, 3, 2]],
    [4, [4, 3, 3, 3, 2, 1]], [4, [4, 3, 3, 3, 2, 1]], [4, [4, 3, 3, 3, 2, 1, 1]], [4, [4, 3, 3, 3, 2, 1, 1]], [4, [4, 3, 3, 3, 2, 1, 1, 1]],
    [4, [4, 3, 3, 3, 2, 1, 1, 1]], [4, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [4, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [4, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [4, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
  ])
})

test('druid ASIs, Wild Shape upgrades and Circle features use the levels in the reference', () => {
  const druid = classFeatures.druida
  assert.deepEqual(
    druid.features.filter(feature => feature.name === 'Incremento no Valor de Habilidade').map(feature => feature.level),
    [4, 8, 12, 16, 19],
  )
  assert.deepEqual(
    druid.features.filter(feature => feature.name === 'Aprimoramento de Forma Selvagem').map(feature => feature.level),
    [4, 8],
  )
  assert.deepEqual(
    druid.subclasses.map(subclass => [subclass.id, subclass.selectionLevel, subclass.features.map(feature => feature.level)]),
    [
      ['circulo-da-terra', 2, [2, 2, 2, 3, 6, 10, 14]],
      ['circulo-da-lua', 2, [2, 2, 6, 10, 14]],
    ],
  )
})

test('Circle of the Land offers one bonus cantrip and one terrain choice', () => {
  const land = classFeatures.druida.subclasses.find(subclass => subclass.id === 'circulo-da-terra')!
  const cantripChoice = land.features.find(feature => feature.name === 'Truque Adicional')?.choices?.[0]
  const terrainChoice = land.features.find(feature => feature.name === 'Terreno do Círculo')?.choices?.[0]

  assert.equal(cantripChoice?.id, 'land-bonus-cantrip')
  assert.equal(cantripChoice?.choose, 1)
  assert.equal(cantripChoice?.options.length, 8)
  assert.equal(terrainChoice?.choose, 1)
  assert.deepEqual(terrainChoice?.options.map(option => option.name), [
    'Ártico', 'Costa', 'Deserto', 'Floresta', 'Montanha', 'Pântano', 'Planície', 'Subterrâneo',
  ])
})

test('druid spell preparation and Wild Shape rules include the key reference limits', () => {
  const druid = classFeatures.druida
  const spellcasting = druid.features.find(feature => feature.name === 'Conjuração')!
  const wildShape = druid.features.find(feature => feature.name === 'Forma Selvagem')!

  assert.match(spellcasting.description, /nível de druida \+ seu modificador de Sabedoria/)
  assert.match(spellcasting.description, /1 minuto por nível da magia/)
  assert.match(wildShape.description, /ND máximo é 1\/4/)
  assert.match(wildShape.description, /descanso curto ou longo/)
  assert.match(wildShape.description, /ação bônus/)
  assert.match(wildShape.description, /não pode conjurar magias/i)
})
