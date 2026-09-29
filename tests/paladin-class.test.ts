import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures, paladinSpellProgression, rebaseClassFeatureChoicesForSubclass } from '../src/lib/classFeatures'

test('choosing a paladin oath preserves the base-class fighting style choice', () => {
  const classId = 'paladin-record-id'
  const subclassId = 'juramento-da-devocao'
  const styleKey = `${classId}::2:Estilo de Luta:estilo-de-luta`
  const scopedStyleKey = `${classId}:${subclassId}:2:Estilo de Luta:estilo-de-luta`
  const staleSubclassKey = `${classId}:${subclassId}:3:Juramento Sagrado:juramento`
  const choices = {
    [styleKey]: ['defesa'],
    [staleSubclassKey]: ['stale-choice'],
    'ability-score-increase:paladin-record-id:4:feat': ['actor'],
  }

  const rebased = rebaseClassFeatureChoicesForSubclass(choices, classId, '', subclassId, classFeatures.paladino.features)

  assert.deepEqual(rebased[scopedStyleKey], ['defesa'])
  assert.equal(rebased[styleKey], undefined)
  assert.equal(rebased[staleSubclassKey], undefined)
  assert.deepEqual(rebased['ability-score-increase:paladin-record-id:4:feat'], ['actor'])
})

test('paladin spell-slot progression matches the reference at every level', () => {
  assert.deepEqual(paladinSpellProgression, [
    [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
    [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
    [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
  ])
})

test('paladin features, fighting style options and oath features match the reference', () => {
  const paladin = classFeatures.paladino
  assert.deepEqual(paladin.features.map(({ level, name }) => [level, name]), [
    [1, 'Sentido Divino'], [1, 'Cura pelas Mãos'], [2, 'Estilo de Luta'], [2, 'Conjuração'],
    [2, 'Destruição Divina'], [3, 'Saúde Divina'], [3, 'Juramento Sagrado'], [4, 'Incremento no Valor de Habilidade'],
    [5, 'Ataque Extra'], [6, 'Aura de Proteção'], [8, 'Incremento no Valor de Habilidade'], [10, 'Aura da Coragem'],
    [11, 'Destruição Divina Aprimorada'], [12, 'Incremento no Valor de Habilidade'], [14, 'Toque Purificador'],
    [16, 'Incremento no Valor de Habilidade'], [18, 'Aprimoramentos de Aura'], [19, 'Incremento no Valor de Habilidade'],
  ])

  const styles = paladin.features.find(({ name }) => name === 'Estilo de Luta')!.choices![0].options
  assert.deepEqual(styles.map(({ id }) => id), ['armas-grandes', 'defesa', 'duelismo', 'protecao'])
  assert.ok(styles.every(({ description }) => description.length > 0))
  assert.deepEqual(paladin.subclasses.map(({ id, selectionLevel, features }) => [id, selectionLevel, features.map(({ level }) => level)]), [
    ['juramento-de-devocao', 3, [3, 3, 3, 7, 15, 20]],
    ['juramento-dos-ancioes', 3, [3, 3, 3, 7, 15, 20]],
    ['juramento-de-vinganca', 3, [3, 3, 3, 7, 15, 20]],
  ])
})
