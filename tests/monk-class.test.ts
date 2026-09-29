import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, monkProgression } from '../src/lib/classFeatures'

test('monk core progression matches the reference at level thresholds and every level', () => {
  assert.deepEqual(monkProgression, [
    ['1d4', null, null], ['1d4', 2, '+3 m'], ['1d4', 3, '+3 m'], ['1d4', 4, '+3 m'], ['1d4', 5, '+3 m'],
    ['1d6', 6, '+4,5 m'], ['1d6', 7, '+4,5 m'], ['1d6', 8, '+4,5 m'], ['1d6', 9, '+4,5 m'], ['1d6', 10, '+6 m'],
    ['1d8', 11, '+6 m'], ['1d8', 12, '+6 m'], ['1d8', 13, '+6 m'], ['1d8', 14, '+7,5 m'], ['1d8', 15, '+7,5 m'],
    ['1d8', 16, '+7,5 m'], ['1d10', 17, '+7,5 m'], ['1d10', 18, '+9 m'], ['1d10', 19, '+9 m'], ['1d10', 20, '+9 m'],
  ])
})

test('monk class features and subclass progression follow the reference levels', () => {
  const monk = classFeatures.monge
  assert.deepEqual(monk.features.map(({ level, name }) => [level, name]), [
    [1, 'Defesa sem Armadura'], [1, 'Artes Marciais'], [2, 'Chi'], [2, 'Movimento sem Armadura'],
    [3, 'Defletir Projéteis'], [3, 'Tradição Monástica'], [4, 'Incremento no Valor de Habilidade'], [4, 'Queda Lenta'],
    [5, 'Ataque Extra'], [5, 'Ataque Atordoante'], [6, 'Golpes de Chi'], [7, 'Evasão'], [7, 'Mente Tranquila'],
    [8, 'Incremento no Valor de Habilidade'], [9, 'Aprimoramento de Movimento sem Armadura'], [10, 'Pureza Corporal'],
    [12, 'Incremento no Valor de Habilidade'], [13, 'Idiomas do Sol e da Lua'], [14, 'Alma de Diamante'],
    [15, 'Corpo Atemporal'], [16, 'Incremento no Valor de Habilidade'], [18, 'Corpo Vazio'],
    [19, 'Incremento no Valor de Habilidade'], [20, 'Auto Aperfeiçoamento'],
  ])
  assert.deepEqual(monk.features.filter(({ name }) => name === 'Incremento no Valor de Habilidade').map(({ level }) => level), [4, 8, 12, 16, 19])
  assert.deepEqual(monk.subclasses.map(({ selectionLevel, features }) => [selectionLevel, features.map(({ level }) => level)]), [
    [3, [3, 6, 11, 17]], [3, [3, 6, 11, 17]], [3, [3, 6, 11, 17]],
  ])
})
