import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, sorcererSpellProgression } from '../src/lib/classFeatures'

test('sorcerer cantrips, spells known and spell slots match the reference at all 20 levels', () => {
  assert.deepEqual(sorcererSpellProgression, [
    [4, 2, [2]], [4, 3, [3]], [4, 4, [4, 2]], [5, 5, [4, 3]], [5, 6, [4, 3, 2]],
    [5, 7, [4, 3, 3]], [5, 8, [4, 3, 3, 1]], [5, 9, [4, 3, 3, 2]], [5, 10, [4, 3, 3, 3, 1]], [6, 11, [4, 3, 3, 3, 2]],
    [6, 12, [4, 3, 3, 3, 2, 1]], [6, 12, [4, 3, 3, 3, 2, 1]], [6, 13, [4, 3, 3, 3, 2, 1, 1]], [6, 13, [4, 3, 3, 3, 2, 1, 1]], [6, 14, [4, 3, 3, 3, 2, 1, 1, 1]],
    [6, 14, [4, 3, 3, 3, 2, 1, 1, 1]], [6, 15, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [6, 15, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [6, 16, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [6, 16, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
  ])
})

test('sorcerer ASIs, Metamagic choices and origin features are granted at reference levels', () => {
  const sorcerer = classFeatures.feiticeiro
  assert.deepEqual(
    sorcerer.features.filter(feature => feature.name === 'Incremento no Valor de Habilidade').map(feature => feature.level),
    [4, 8, 12, 16, 19],
  )

  const metamagic = sorcerer.features.filter(feature => feature.choices?.some(choice => choice.id === 'sorcerer-metamagic'))
  assert.deepEqual(metamagic.map(feature => [feature.level, feature.choices?.[0].choose]), [[3, 2], [10, 1], [17, 1]])
  assert.equal(metamagic[0].choices?.[0].options.length, 8)

  assert.deepEqual(sorcerer.subclasses.map(origin => [origin.id, origin.selectionLevel, origin.features.map(feature => feature.level)]), [
    ['linhagem-draconica', 1, [1, 1, 6, 14, 18]],
    ['magia-selvagem', 1, [1, 1, 6, 14, 18]],
  ])
})

test('sorcerer origin descriptions preserve important reference restrictions', () => {
  const sorcerer = classFeatures.feiticeiro
  const wildMagic = sorcerer.subclasses.find(origin => origin.id === 'magia-selvagem')!
  const draconic = sorcerer.subclasses.find(origin => origin.id === 'linhagem-draconica')!

  assert.match(wildMagic.features.find(feature => feature.name === 'Surto de Magia Selvagem')!.description, /resultado 1/)
  assert.match(wildMagic.features.find(feature => feature.name === 'Marés de Caos')!.description, /imediatamente após conjurar/)
  assert.match(wildMagic.features.find(feature => feature.name === 'Bombardeio de Magia')!.description, /em cada um dos seus turnos/)
  assert.match(draconic.features.find(feature => feature.name === 'Presença Dracônica')!.description, /à sua escolha/)
})
