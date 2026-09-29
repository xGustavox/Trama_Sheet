import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, rangerSpellProgression } from '../src/lib/classFeatures'

test('ranger known-spell and spell-slot progression matches every reference level', () => {
  assert.deepEqual(rangerSpellProgression, [
    [0, []], [2, [2]], [3, [3]], [3, [3]], [4, [4, 2]], [4, [4, 2]], [5, [4, 3]], [5, [4, 3]], [6, [4, 3, 2]], [6, [4, 3, 2]],
    [7, [4, 3, 3]], [7, [4, 3, 3]], [8, [4, 3, 3, 1]], [8, [4, 3, 3, 1]], [9, [4, 3, 3, 2]], [9, [4, 3, 3, 2]],
    [10, [4, 3, 3, 3, 1]], [10, [4, 3, 3, 3, 1]], [11, [4, 3, 3, 3, 2]], [11, [4, 3, 3, 3, 2]],
  ])
})

test('ranger features, fighting styles and archetype choices use the reference levels and options', () => {
  const ranger = classFeatures.patrulheiro
  assert.deepEqual(ranger.features.map(({ level, name }) => [level, name]), [
    [1, 'Inimigo Favorito'], [1, 'Explorador Natural'], [2, 'Estilo de Luta'], [2, 'Conjuração'],
    [3, 'Arquétipo de Patrulheiro'], [3, 'Prontidão Primitiva'], [4, 'Incremento no Valor de Habilidade'],
    [5, 'Ataque Extra'], [6, 'Aprimoramentos de Inimigo Favorito e Explorador Natural'],
    [8, 'Incremento no Valor de Habilidade'], [8, 'Caminho da Floresta'], [10, 'Aprimoramento de Explorador Natural'],
    [10, 'Mimetismo'], [12, 'Incremento no Valor de Habilidade'], [14, 'Aprimoramento de Inimigo Favorito'],
    [14, 'Desaparecer'], [16, 'Incremento no Valor de Habilidade'], [18, 'Sentidos Selvagens'],
    [19, 'Incremento no Valor de Habilidade'], [20, 'Matador de Inimigos'],
  ])
  const styles = ranger.features.find(({ name }) => name === 'Estilo de Luta')!.choices![0].options
  assert.deepEqual(styles.map(({ id }) => id), ['arquearia', 'duas-armas', 'defesa', 'duelismo'])
  assert.deepEqual(ranger.subclasses.map(({ id, selectionLevel, features }) => [id, selectionLevel, features.map(({ level }) => level)]), [
    ['cacador', 3, [3, 7, 11, 15]], ['mestre-das-bestas', 3, [3, 7, 11, 15]],
  ])
  assert.deepEqual(ranger.subclasses[0].features.map(({ choices }) => choices?.[0].choose), [1, 1, 1, 1])
})
