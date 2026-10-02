import assert from 'node:assert/strict'
import test from 'node:test'
import type { CharacterDetails } from '../src/lib/characterData'
import { rollbackCharacterLevels, rollbackPlayStateForLevel } from '../src/lib/levelRollback'

function character(overrides: Partial<CharacterDetails> = {}): CharacterDetails {
  return {
    name: 'Personagem',
    level: 5,
    experiencePoints: '6500',
    maxHp: '38',
    portraitUrl: '',
    portraitPath: '',
    raceId: '',
    racialChoice: '',
    characterClassId: 'bruxo',
    classSubclassId: '',
    classFeatureChoices: {},
    primalPath: '',
    primalTotemChoices: { spiritualTotem: '', beastAspect: '', totemicAttunement: '' },
    backgroundId: '',
    age: '',
    height: '',
    weight: '',
    alignment: '',
    abilityScoreMethod: '',
    abilities: { strength: '10', dexterity: '12', constitution: '14', intelligence: '10', wisdom: '10', charisma: '16' },
    racialAbilityChoices: [],
    raceLanguageChoices: [],
    backgroundLanguageChoices: [],
    merchantAlternative: '',
    appliedRacialBonuses: {},
    skillProficiencies: [],
    bardInstrumentChoices: [],
    toolProficiencyChoices: [],
    backgroundEquipmentChoice: '',
    equipment: '',
    spells: '{}',
    feats: '[]',
    ...overrides,
  }
}

test('losing levels reverses only their choices, ability bonuses, hit points, and granted items', () => {
  const book = { id: 'book', itemId: 'livro-das-sombras', name: 'Livro das Sombras', quantity: 1, equipped: true, notes: '', source: 'feature:livro-das-sombras', sourceLabel: 'Pacto do Tomo' }
  const manualBook = { ...book, id: 'manual-book', source: 'manual', sourceLabel: 'Adicionado pelo jogador' }
  const inventory = { version: 2, initialEquipmentConfirmed: true, entries: [book, manualBook], choices: {}, applied: {}, currencyCp: 0, legacyNotes: '' }
  const result = rollbackCharacterLevels(character({
    level: 5,
    maxHp: '38',
    abilities: { strength: '10', dexterity: '12', constitution: '14', intelligence: '10', wisdom: '10', charisma: '19' },
    classFeatureChoices: {
      'bruxo::2:Invocações Místicas:mystic-invocations': ['visao-do-diabo'],
      'bruxo::3:Dádiva do Pacto:dadiva-do-pacto': ['pacto-do-tomo'],
      'bruxo::4:Incremento no Valor de Habilidade:some-choice': ['mantido'],
      'ability-score-increase:bruxo:4:mode': ['feat'],
      'ability-score-increase:bruxo:4:feat': ['resiliente'],
    },
    abilityScoreIncreases: { classId: 'bruxo', selections: { 'ability-score-increase:bruxo:4': ['charisma'] } },
    featAbilityIncreases: { 'ability-score-increase:bruxo:4:feat': { ability: 'charisma', amount: 1 } },
    equipment: JSON.stringify(inventory),
    levelUpHistory: { '4': { hitPointGain: 6 }, '5': { hitPointGain: 5 } },
  }), 2)

  assert.equal(result.level, 2)
  assert.equal(result.maxHp, '27')
  assert.equal(result.abilities.charisma, '16')
  assert.deepEqual(result.abilityScoreIncreases?.selections, {})
  assert.deepEqual(result.featAbilityIncreases, {})
  assert.deepEqual(Object.keys(result.classFeatureChoices), ['bruxo::2:Invocações Místicas:mystic-invocations'])
  const entries = JSON.parse(result.equipment).entries as { source: string }[]
  assert.deepEqual(entries.map(({ source }) => source), ['manual'])
  assert.deepEqual(Object.keys(result.levelUpHistory ?? {}), [])
})

test('spell rollback reverses replacement chains in descending lost-level order', () => {
  const result = rollbackCharacterLevels(character({
    level: 4,
    spells: JSON.stringify({ knownSpells: ['Magia Base', 'Magia Inicial', 'Magia Substituta', 'Magia Posterior'] }),
    levelUpHistory: {
      '2': { hitPointGain: 4, spellChanges: [{ field: 'knownSpells', added: 'Magia Inicial' }] },
      '3': { hitPointGain: 5, spellChanges: [{ field: 'knownSpells', added: 'Magia Substituta', replaced: 'Magia Inicial' }] },
      '4': { hitPointGain: 3, spellChanges: [{ field: 'knownSpells', added: 'Magia Posterior' }] },
    },
  }), 1)

  assert.deepEqual(JSON.parse(result.spells).knownSpells, ['Magia Base'])
})

test('lost invocation replacement restores the old choice before removing choices from that level', () => {
  const result = rollbackCharacterLevels(character({
    level: 5,
    classFeatureChoices: {
      'bruxo::2:Invocações Místicas:mystic-invocations': ['visao-do-diabo', 'invocacao-antiga'],
      'bruxo::4:Invocações Místicas:mystic-invocations': ['passo-ascendente'],
      'bruxo::5:Invocações Místicas:mystic-invocations': ['invocacao-final'],
      'bruxo::2:Invocações Místicas:mystic-invocations:rituais': ['Compreender Idiomas'],
    },
    levelUpHistory: {
      '4': {
        hitPointGain: 5,
        invocationReplacements: [{
          sourceKey: 'bruxo::2:Invocações Místicas:mystic-invocations',
          oldId: 'invocacao-antiga',
          newId: 'passo-ascendente',
        }],
      },
      '5': {
        hitPointGain: 5,
        invocationReplacements: [{
          sourceKey: 'bruxo::2:Invocações Místicas:mystic-invocations',
          oldId: 'passo-ascendente',
          newId: 'invocacao-final',
        }],
      },
    },
  }), 3)

  assert.deepEqual(result.classFeatureChoices['bruxo::2:Invocações Místicas:mystic-invocations'], ['visao-do-diabo', 'invocacao-antiga'])
  assert.deepEqual(result.classFeatureChoices['bruxo::2:Invocações Místicas:mystic-invocations:rituais'], ['Compreender Idiomas'])
  assert.equal(result.classFeatureChoices['bruxo::4:Invocações Místicas:mystic-invocations'], undefined)
  assert.equal(result.classFeatureChoices['bruxo::5:Invocações Místicas:mystic-invocations'], undefined)
})

test('losing a subclass threshold clears that subclass even when its class record uses a different ID', () => {
  const result = rollbackCharacterLevels(character({
    level: 5,
    characterClassId: 'fighter-record-id',
    classSubclassId: 'campeao',
    classFeatureChoices: {
      'fighter-record-id:campeao:3:Crítico Aprimorado:feature': ['selected'],
      'fighter-record-id::2:Retomar o Fôlego:feature': ['kept'],
    },
  }), 2, 'guerreiro')

  assert.equal(result.classSubclassId, '')
  assert.deepEqual(result.classFeatureChoices, { 'fighter-record-id::2:Retomar o Fôlego:feature': ['kept'] })
})

test('untracked legacy spells and hit points are preserved rather than guessed', () => {
  const legacySpells = '["Magia antiga"]'
  const result = rollbackCharacterLevels(character({ level: 4, maxHp: '30', spells: legacySpells }), 3)

  assert.equal(result.spells, legacySpells)
  assert.equal(result.maxHp, '30')
})

test('level rollback lowers current hit points only when the recorded maximum falls below them', () => {
  const state = { currentHp: 31, temporaryHp: 4, spentSpellSlots: ['1:0'], spentHitDice: 4 }
  assert.deepEqual(rollbackPlayStateForLevel(state, 2, 27), { ...state, currentHp: 27, spentHitDice: 2 })
  assert.equal(rollbackPlayStateForLevel(state, 2, 38)?.currentHp, 31)
})
