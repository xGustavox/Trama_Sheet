import assert from 'node:assert/strict'
import test from 'node:test'
import { classFeatures } from '../src/lib/classFeatures'
import { hasLevelUpChoices } from '../src/lib/experience'
import type { CharacterDetails } from '../src/lib/characterData'

test('barbarian class features are available to the character sheet at each attained level', () => {
  const barbarian = classFeatures.barbaro

  assert.ok(barbarian)
  assert.deepEqual(barbarian.features.filter(({ level }) => level <= 1).map(({ name }) => name), [
    'Fúria',
    'Defesa sem Armadura',
  ])
  assert.ok(barbarian.features.some(({ level, name }) => level <= 5 && name === 'Ataque Extra'))
  assert.ok(barbarian.features.some(({ level, name }) => level === 4 && name === 'Incremento no Valor de Habilidade'))
  assert.ok(barbarian.features.some(({ level, name }) => level === 19 && name === 'Incremento no Valor de Habilidade'))
})

test('level ups open the choice flow only when the barbarian gains a choice', () => {
  const character = {
    characterClassId: 'barbarian-record-id',
    classSubclassId: '',
    classFeatureChoices: {},
    abilityScoreIncreases: undefined,
    primalPath: '',
    primalTotemChoices: { spiritualTotem: '', beastAspect: '', totemicAttunement: '' },
    level: 1,
  } as CharacterDetails

  assert.equal(hasLevelUpChoices(character, 'barbaro', classFeatures.barbaro, 2), false)
  assert.equal(hasLevelUpChoices(character, 'barbaro', classFeatures.barbaro, 3), true)
  assert.equal(hasLevelUpChoices({ ...character, level: 3, primalPath: 'berserker' }, 'barbaro', classFeatures.barbaro, 4), true)
})
