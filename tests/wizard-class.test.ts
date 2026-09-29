import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, wizardSpellProgression } from '../src/lib/classFeatures'

test('wizard cantrips and spell-slot progression match the reference at all 20 levels', () => {
  assert.deepEqual(wizardSpellProgression, [
    [3, [2]], [3, [3]], [3, [4, 2]], [4, [4, 3]], [4, [4, 3, 2]],
    [4, [4, 3, 3]], [4, [4, 3, 3, 1]], [4, [4, 3, 3, 2]], [4, [4, 3, 3, 3, 1]], [5, [4, 3, 3, 3, 2]],
    [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1]],
    [5, [4, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
  ])
})

test('wizard ASIs, core features and arcane traditions use reference levels', () => {
  const wizard = classFeatures.mago
  assert.deepEqual(
    wizard.features.filter(feature => feature.name === 'Incremento no Valor de Habilidade').map(feature => feature.level),
    [4, 8, 12, 16, 19],
  )
  assert.deepEqual(wizard.subclasses.map(school => [school.id, school.selectionLevel, school.features.map(feature => feature.level)]), [
    ['escola-de-abjuracao', 2, [2, 2, 6, 10, 14]],
    ['escola-de-adivinhacao', 2, [2, 2, 6, 10, 14]],
    ['escola-de-conjuracao', 2, [2, 2, 6, 10, 14]],
    ['escola-de-encantamento', 2, [2, 2, 6, 10, 14]],
    ['escola-de-evocacao', 2, [2, 2, 6, 10, 14]],
    ['escola-de-ilusao', 2, [2, 2, 6, 10, 14]],
    ['escola-de-necromancia', 2, [2, 2, 6, 10, 14]],
    ['escola-de-transmutacao', 2, [2, 2, 6, 10, 14]],
  ])
})

test('wizard spellcasting and arcane-school descriptions retain key reference rules', () => {
  const wizard = classFeatures.mago
  const spellcasting = wizard.features.find(feature => feature.name === 'Conjuração')!
  const arcaneRecovery = wizard.features.find(feature => feature.name === 'Recuperação Arcana')!
  const abjuration = wizard.subclasses.find(school => school.id === 'escola-de-abjuracao')!
  const divination = wizard.subclasses.find(school => school.id === 'escola-de-adivinhacao')!
  const enchantment = wizard.subclasses.find(school => school.id === 'escola-de-encantamento')!
  const evocation = wizard.subclasses.find(school => school.id === 'escola-de-evocacao')!
  const transmutation = wizard.subclasses.find(school => school.id === 'escola-de-transmutacao')!

  assert.match(spellcasting.description, /seis magias de mago de 1º nível/)
  assert.match(spellcasting.description, /duas magias de mago/)
  assert.match(spellcasting.description, /sem prepará-la/)
  assert.match(arcaneRecovery.description, /arredondada para cima/)
  assert.match(abjuration.features.find(feature => feature.name === 'Proteção Arcana')!.description, /Com 0 PV/)
  assert.match(divination.features.find(feature => feature.name === 'Prodígio')!.description, /uma substituição por rodada/)
  assert.match(enchantment.features.find(feature => feature.name === 'Alterar Memórias')!.description, /teste de resistência de Inteligência/)
  assert.match(evocation.features.find(feature => feature.name === 'Sobrecarga')!.description, /2d12 de dano necrótico/)
  assert.match(transmutation.features.find(feature => feature.name === 'Mestre Transmutador')!.description, /Restaurar Juventude/)
})
