import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, eldritchKnightSpellProgression } from '../src/lib/classFeatures'

test('Eldritch Knight cantrips, spells known and spell slots match the reference at levels 3–20', () => {
  assert.deepEqual(eldritchKnightSpellProgression, [
    [2, 3, [2]], [2, 4, [3]], [2, 4, [3]], [2, 4, [3]], [2, 5, [4, 2]], [2, 6, [4, 2]],
    [2, 6, [4, 2]], [3, 7, [4, 3]], [3, 8, [4, 3]], [3, 8, [4, 3]], [3, 9, [4, 3, 2]],
    [3, 10, [4, 3, 2]], [3, 10, [4, 3, 2]], [3, 11, [4, 3, 3]], [3, 11, [4, 3, 3]],
    [3, 11, [4, 3, 3]], [3, 12, [4, 3, 3, 1]], [3, 13, [4, 3, 3, 1]],
  ])
})

test('fighter ASIs, class features and martial archetype features use the reference levels', () => {
  const fighter = classFeatures.guerreiro
  assert.deepEqual(
    fighter.features.filter(feature => feature.name === 'Incremento no Valor de Habilidade').map(feature => feature.level),
    [4, 6, 8, 12, 14, 16, 19],
  )
  assert.deepEqual(
    fighter.features.filter(feature => [
      'Estilo de Luta', 'Retomar o Fôlego', 'Surto de Ação (um uso)', 'Arquétipo Marcial', 'Ataque Extra',
      'Indomável (um uso)', 'Ataque Extra (2)', 'Indomável (dois usos)', 'Surto de Ação (dois usos)',
      'Indomável (três usos)', 'Ataque Extra (3)',
    ].includes(feature.name)).map(feature => [feature.level, feature.name]),
    [
      [1, 'Estilo de Luta'], [1, 'Retomar o Fôlego'], [2, 'Surto de Ação (um uso)'], [3, 'Arquétipo Marcial'],
      [5, 'Ataque Extra'], [9, 'Indomável (um uso)'], [11, 'Ataque Extra (2)'], [13, 'Indomável (dois usos)'],
      [17, 'Surto de Ação (dois usos)'], [17, 'Indomável (três usos)'], [20, 'Ataque Extra (3)'],
    ],
  )
  assert.deepEqual(fighter.subclasses.map(subclass => [subclass.id, subclass.selectionLevel, subclass.features.map(feature => feature.level)]), [
    ['campeao', 3, [3, 7, 10, 15, 18]],
    ['cavaleiro-arcano', 3, [3, 3, 7, 10, 15, 18]],
    ['mestre-de-batalha', 3, [3, 3, 7, 7, 10, 10, 15, 15, 18]],
  ])
})

test('fighter style, Battle Master choices and rules match the reference', () => {
  const fighter = classFeatures.guerreiro
  const styles = fighter.features.find(feature => feature.name === 'Estilo de Luta')!.choices![0]
  const champion = fighter.subclasses.find(subclass => subclass.id === 'campeao')!
  const championStyle = champion.features.find(feature => feature.name === 'Estilo de Luta Adicional')!.choices![0]
  const battleMaster = fighter.subclasses.find(subclass => subclass.id === 'mestre-de-batalha')!
  const maneuvers = battleMaster.features.find(feature => feature.name === 'Superioridade em Combate')!.choices![0]
  const tool = battleMaster.features.find(feature => feature.name === 'Estudioso da Guerra')!

  assert.equal(styles.choose, 1)
  assert.deepEqual(championStyle.options.map(option => option.id), styles.options.map(option => option.id))
  assert.equal(maneuvers.choose, 3)
  assert.equal(maneuvers.options.length, 16)
  assert.equal(tool.choices?.[0].choose, 1)
  assert.equal(tool.choices?.[0].options.length, 17)
  assert.match(styles.options.find(option => option.id === 'protecao')!.description, /alvo que não seja você/)
  assert.match(maneuvers.options.find(option => option.id === 'aparar')!.description, /use sua reação/)
  assert.match(maneuvers.options.find(option => option.id === 'rasteira')!.description, /Grande ou menor/)
})
