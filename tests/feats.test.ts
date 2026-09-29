import assert from 'node:assert/strict'
import test from 'node:test'
import { feats, getFeatAbilityBonus, getFeatPrerequisiteFailure } from '../src/lib/feats'

const findFeat = (id: string) => {
  const feat = feats.find((item) => item.id === id)
  assert.ok(feat)
  return feat
}

test('feat catalog has unique stable IDs and marks the PDF repeatable feat', () => {
  assert.equal(new Set(feats.map(({ id }) => id)).size, feats.length)
  assert.equal(feats.find(({ name }) => name === 'Adepto Elemental')?.repeatable, true)
  assert.equal(feats.filter(({ repeatable }) => repeatable).length, 1)
})

test('ability and spellcasting prerequisites are enforced with their unmet requirement', () => {
  assert.equal(getFeatPrerequisiteFailure(findFeat('duelista-defensivo'), { dexterity: '12' }, false, []), 'Destreza 13 ou maior.')
  assert.equal(getFeatPrerequisiteFailure(findFeat('duelista-defensivo'), { dexterity: '13' }, false, []), '')
  assert.equal(getFeatPrerequisiteFailure(findFeat('conjurador-de-ritual'), { intelligence: '12', wisdom: '12' }, false, []), 'Inteligência ou Sabedoria 13 ou maior.')
  assert.equal(getFeatPrerequisiteFailure(findFeat('adepto-elemental'), {}, false, []), 'Capacidade de conjurar pelo menos uma magia.')
  assert.equal(getFeatPrerequisiteFailure(findFeat('adepto-elemental'), {}, true, []), '')
})

test('armor prerequisites accept the exact armor training or all-armors proficiency', () => {
  assert.equal(getFeatPrerequisiteFailure(findFeat('maestria-em-armadura-pesada'), {}, false, ['Armaduras médias']), 'Proficiência em armadura pesada.')
  assert.equal(getFeatPrerequisiteFailure(findFeat('maestria-em-armadura-pesada'), {}, false, ['Todas as armaduras', 'Escudos']), '')
  assert.equal(getFeatPrerequisiteFailure(findFeat('protecao-moderada'), {}, false, ['Armaduras leves']), '')
})

test('feat ability increases apply the PDF ability and respect its choice and 20-point cap', () => {
  assert.deepEqual(getFeatAbilityBonus(findFeat('ator'), { charisma: '17' }), { ability: 'charisma', amount: 1 })
  assert.deepEqual(getFeatAbilityBonus(findFeat('ator'), { charisma: '20' }), { ability: 'charisma', amount: 0 })
  assert.deepEqual(getFeatAbilityBonus(findFeat('atleta'), { strength: '18', dexterity: '19' }, 'dexterity'), { ability: 'dexterity', amount: 1 })
  assert.equal(getFeatAbilityBonus(findFeat('atleta'), { strength: '18' }, 'wisdom'), null)
})
