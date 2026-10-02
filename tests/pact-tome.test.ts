import assert from 'node:assert/strict'
import test from 'node:test'
import { hasWarlockPact, getPactTomeCantrips, getWarlockInvocationSpellGrants, isValidPactTomeCantripSelection, warlockPactChoiceKey, warlockTomeCantripChoiceKey } from '../src/lib/pactTome'
import { getSpellLevel } from '../src/lib/spellCatalog'

test('pact choices apply only to the matching warlock and subclass', () => {
  const choices = { [warlockPactChoiceKey('bruxo', 'arquifada')]: ['pacto-da-corrente'] }
  assert.equal(hasWarlockPact('bruxo', 'arquifada', choices, 'pacto-da-corrente'), true)
  assert.equal(hasWarlockPact('bruxo', 'arquifada', choices, 'pacto-do-tomo'), false)
  assert.equal(hasWarlockPact('bruxo', 'o-corruptor', choices, 'pacto-da-corrente'), false)
  assert.equal(hasWarlockPact('mago', 'arquifada', choices, 'pacto-da-corrente'), false)
})

test('Pacto do Tomo exige exatamente três truques distintos das listas de classe', () => {
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Consertar', 'Luz']), true)
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Consertar', 'Luz'], ['amizade']), false)
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Consertar', 'Luz'], ['LUZ']), false)
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Consertar', 'Luz'], ['Mensagem']), true)
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Consertar']), false)
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Amizade', 'Luz']), false)
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Consertar', 'Magia Inventada']), false)
  assert.equal(isValidPactTomeCantripSelection(['Amizade', 'Consertar', 'Luz', 'Mensagem']), false)
})

test('selected Pact of the Tome cantrips remain listed even when the book is not equipped', () => {
  const choices = {
    [warlockPactChoiceKey('bruxo', 'arquifada')]: ['pacto-do-tomo'],
    [warlockTomeCantripChoiceKey('bruxo', 'arquifada')]: ['Luz', 'Consertar', 'Mensagem'],
  }
  assert.deepEqual(getPactTomeCantrips('bruxo', 'arquifada', choices), ['Luz', 'Consertar', 'Mensagem'])
  assert.deepEqual(getPactTomeCantrips('bruxo', 'o-corruptor', choices), [])
  assert.deepEqual(getPactTomeCantrips('mago', 'arquifada', choices), [])
})

test('Pact of the Tome resolves saved choices when the class record ID is not the class slug', () => {
  const classRecordId = 'class-record-id-123'
  const subclassId = 'arquifada'
  const choices = {
    [warlockPactChoiceKey(classRecordId, subclassId)]: ['pacto-do-tomo'],
    [warlockTomeCantripChoiceKey(classRecordId, subclassId)]: ['Luz', 'Consertar', 'Mensagem'],
  }

  assert.equal(hasWarlockPact('bruxo', subclassId, choices, 'pacto-do-tomo', classRecordId), true)
  assert.deepEqual(getPactTomeCantrips('bruxo', subclassId, choices, classRecordId), ['Luz', 'Consertar', 'Mensagem'])
})

test('selected spell-granting invocations resolve the correct spell, level, and casting mode', () => {
  const grants = getWarlockInvocationSpellGrants([
    'armadura-de-sombras', 'encharcar-a-mente', 'sinal-de-mau-agouro', 'influencia-enganadora',
  ])
  assert.deepEqual(grants.map(({ invocationId, spellName, level, casting }) => ({ invocationId, spellName, level, casting })), [
    { invocationId: 'armadura-de-sombras', spellName: 'Armadura Arcana', level: 1, casting: 'at-will' },
    { invocationId: 'encharcar-a-mente', spellName: 'Lentidão', level: 3, casting: 'pact-slot-once-per-long-rest' },
    { invocationId: 'sinal-de-mau-agouro', spellName: 'Rogar Maldição', level: 3, casting: 'pact-slot-once-per-long-rest' },
  ])
  for (const { spellName, level } of grants) assert.equal(getSpellLevel(spellName, 'bruxo'), level, `${spellName} must use its real spell level`)
  assert.deepEqual(getWarlockInvocationSpellGrants(['not-an-invocation']), [])
})
