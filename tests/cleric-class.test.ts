import assert from 'node:assert/strict'
import test from 'node:test'
import { clericSpellProgression, classFeatures } from '../src/lib/classFeatures'

test('cleric cantrip and spell-slot progression matches the reference at all 20 levels', () => {
  assert.deepEqual(clericSpellProgression, [
    [3, [2]], [3, [3]], [3, [4, 2]], [4, [4, 3]], [4, [4, 3, 2]],
    [4, [4, 3, 3]], [4, [4, 3, 3, 1]], [4, [4, 3, 3, 2]], [4, [4, 3, 3, 3, 1]], [5, [4, 3, 3, 3, 2]],
    [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1]],
    [5, [4, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
  ])
})

test('cleric domains provide Knowledge choices and domain features at the reference levels', () => {
  const cleric = classFeatures.clerigo
  const knowledge = cleric.subclasses.find(subclass => subclass.id === 'dominio-do-conhecimento')!
  const blessings = knowledge.features.find(feature => feature.name === 'Bênçãos do Conhecimento')!

  assert.deepEqual(blessings.choices?.map(choice => [choice.id, choice.choose, choice.options.length]), [
    ['knowledge-skills', 2, 4],
    ['knowledge-languages', 2, 16],
  ])
  assert.deepEqual(
    cleric.features.filter(feature => feature.name.startsWith('Destruir Mortos-Vivos')).map(feature => feature.level),
    [5, 8, 11, 14, 17],
  )
  assert.deepEqual(
    cleric.subclasses.map(subclass => [subclass.id, subclass.selectionLevel, subclass.features.map(feature => feature.level)]),
    [
      ['dominio-do-conhecimento', 1, [1, 1, 2, 6, 8, 17]],
      ['dominio-da-enganacao', 1, [1, 1, 2, 6, 8, 17]],
      ['dominio-da-guerra', 1, [1, 1, 1, 2, 6, 8, 17]],
      ['dominio-da-luz', 1, [1, 1, 1, 2, 6, 8, 17]],
      ['dominio-da-natureza', 1, [1, 1, 1, 2, 6, 8, 17]],
      ['dominio-da-tempestade', 1, [1, 1, 1, 2, 6, 8, 17]],
      ['dominio-da-vida', 1, [1, 1, 1, 2, 6, 8, 17]],
    ],
  )
})

test('cleric spell preparation and domain spells are described as prepared without counting against the limit', () => {
  const cleric = classFeatures.clerigo
  const spellcasting = cleric.features.find(feature => feature.name === 'Conjuração')!
  const domainSpells = cleric.subclasses.flatMap(subclass => subclass.features)
    .find(feature => feature.name === 'Magias de Domínio')!

  assert.match(spellcasting.description, /nível de clérigo \+ seu modificador de Sabedoria/)
  assert.match(spellcasting.description, /como ritual/)
  assert.match(domainSpells.description, /sempre preparadas e não contam no limite/)
})
