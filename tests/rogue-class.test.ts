import assert from 'node:assert/strict'
import test from 'node:test'
import { arcaneTricksterSpellProgression, classFeatures, rogueSneakAttackProgression } from '../src/lib/classFeatures'

test('Rogue Sneak Attack and ASI progression matches all levels in the reference', () => {
  assert.deepEqual(rogueSneakAttackProgression, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10])
  assert.deepEqual(
    classFeatures.ladino.features.filter(feature => feature.name === 'Incremento no Valor de Habilidade').map(feature => feature.level),
    [4, 8, 10, 12, 16, 19],
  )
})

test('Arcane Trickster cantrips, spells known and spell slots match the reference at levels 3–20', () => {
  assert.deepEqual(arcaneTricksterSpellProgression, [
    [3, 3, [2]], [3, 4, [3]], [3, 4, [3]], [3, 4, [3]], [3, 5, [4, 2]], [3, 6, [4, 2]],
    [3, 6, [4, 2]], [4, 7, [4, 3]], [4, 8, [4, 3]], [4, 8, [4, 3]], [4, 9, [4, 3, 2]],
    [4, 10, [4, 3, 2]], [4, 10, [4, 3, 2]], [4, 11, [4, 3, 3]], [4, 11, [4, 3, 3]],
    [4, 11, [4, 3, 3]], [4, 12, [4, 3, 3, 1]], [4, 13, [4, 3, 3, 1]],
  ])
})

test('Rogue Expertise is selectable at levels 1 and 6 from proficient skills or thieves’ tools', () => {
  const expertise = classFeatures.ladino.features.filter(feature => feature.name === 'Especialização')
  assert.deepEqual(expertise.map(feature => [feature.level, feature.choices?.[0].choose]), [[1, 2], [6, 2]])
  assert.equal(expertise[0].choices?.[0].options.length, 19)
  assert.deepEqual(
    classFeatures.ladino.subclasses.map(subclass => [subclass.id, subclass.selectionLevel, subclass.features.map(feature => feature.level)]),
    [
      ['assassino', 3, [3, 3, 9, 13, 17]],
      ['ladrao', 3, [3, 3, 9, 13, 17]],
      ['trapaceiro-arcano', 3, [3, 3, 9, 13, 17]],
    ],
  )
})

test('Rogue subclass descriptions include the reference triggers and restrictions', () => {
  const rogue = classFeatures.ladino
  const assassin = rogue.subclasses.find(subclass => subclass.id === 'assassino')!
  const thief = rogue.subclasses.find(subclass => subclass.id === 'ladrao')!
  const trickster = rogue.subclasses.find(subclass => subclass.id === 'trapaceiro-arcano')!

  assert.match(assassin.features.find(feature => feature.name === 'Assassinar')!.description, /ainda não tenha agido/)
  assert.match(assassin.features.find(feature => feature.name === 'Golpe Letal')!.description, /Constituição/)
  assert.match(thief.features.find(feature => feature.name === 'Mãos Rápidas')!.description, /abrir uma fechadura/)
  assert.match(trickster.features.find(feature => feature.name === 'Emboscada Mágica')!.description, /estiver escondido/)
  assert.match(trickster.features.find(feature => feature.name === 'Ladrão de Magia')!.description, /inclua você na área/)
})
