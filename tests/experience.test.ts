import assert from 'node:assert/strict'
import test from 'node:test'
import { formatExperienceInput, hasConfirmedAbilityIncrease, hasLevelUpChoices, experienceThresholds, levelForExperience, parseExperienceInput } from '../src/lib/experience'
import type { CharacterDetails } from '../src/lib/characterData'
import type { ClassFeatureData } from '../src/lib/classFeatures'

test('experience levels change exactly at D&D progression thresholds', () => {
  assert.equal(experienceThresholds[7], 34000)
  assert.equal(levelForExperience(22999), 6)
  assert.equal(levelForExperience(23000), 7)
  assert.equal(levelForExperience(33999), 7)
  assert.equal(levelForExperience(34000), 8)
  assert.equal(levelForExperience(355000), 20)
})

test('experience below zero or non-finite values safely remains level 1', () => {
  assert.equal(levelForExperience(-1), 1)
  assert.equal(levelForExperience(Number.NaN), 1)
  assert.equal(levelForExperience(Number.POSITIVE_INFINITY), 1)
})

test('XP input groups thousands with periods while calculations receive digits only', () => {
  assert.equal(formatExperienceInput(10000), '10.000')
  assert.equal(formatExperienceInput('150000'), '150.000')
  assert.equal(formatExperienceInput(''), '')
  assert.equal(parseExperienceInput('1.500'), '1500')
  assert.equal(parseExperienceInput('12a.345'), '12345')
})

test('only level-ups that unlock a choice require the ficha drawer', () => {
  const character = {
    level: 2,
    characterClassId: 'paladin-record-id',
    classSubclassId: '',
    classFeatureChoices: {},
  } as CharacterDetails
  const classData: ClassFeatureData = {
    features: [{
      level: 3,
      name: 'Estilo de Combate',
      description: '',
      choices: [{ id: 'style', name: 'Estilo', choose: 1, options: [{ id: 'defense', name: 'Defesa', description: '' }] }],
    }],
    subclasses: [{ id: 'oath', name: 'Juramento', selectionLevel: 3, features: [] }],
  }

  assert.equal(hasLevelUpChoices(character, 'paladino', classData, 2), false)
  assert.equal(hasLevelUpChoices(character, 'paladino', classData, 3), true)
  assert.equal(hasLevelUpChoices(character, 'paladino', { features: [], subclasses: [] }, 3), false)
})

test('warlock level-ups open for new known spells and invocation replacement when available', () => {
  const classData: ClassFeatureData = { features: [], subclasses: [] }
  const character = {
    level: 2,
    characterClassId: 'bruxo',
    classSubclassId: 'corruptor',
    classFeatureChoices: { 'bruxo:corruptor:2:Invocações Místicas:mystic-invocations': ['armadura-de-sombras'] },
  } as CharacterDetails

  assert.equal(hasLevelUpChoices(character, 'bruxo', classData, 3), true)
  assert.equal(hasLevelUpChoices(character, 'bruxo', classData, 2), false)
  assert.equal(hasLevelUpChoices({ ...character, classFeatureChoices: {} }, 'bruxo', classData, 3), true)
  assert.equal(hasLevelUpChoices({ ...character, level: 19, classFeatureChoices: {} }, 'bruxo', classData, 20), false)
})

test('learned-spell class level-ups open the drawer when a known spell can be replaced', () => {
  const classData: ClassFeatureData = { features: [], subclasses: [] }
  const bard = {
    level: 4,
    characterClassId: 'bardo',
    classSubclassId: 'colegio-do-conhecimento',
    classFeatureChoices: {},
    spells: JSON.stringify({ knownSpells: ['Enfeitiçar Pessoa'] }),
  } as CharacterDetails
  const cleric = { ...bard, characterClassId: 'clerigo' } as CharacterDetails
  const arcaneKnight = { ...bard, characterClassId: 'guerreiro', classSubclassId: 'cavaleiro-arcano' } as CharacterDetails

  assert.equal(hasLevelUpChoices(bard, 'bardo', classData, 5), true)
  assert.equal(hasLevelUpChoices(bard, 'bardo', classData, 4), false)
  assert.equal(hasLevelUpChoices(cleric, 'clerigo', classData, 5), false)
  assert.equal(hasLevelUpChoices(arcaneKnight, 'guerreiro', classData, 5), true)
})

test('level-ups open spell choices when class progression grants new known spells', () => {
  const classData: ClassFeatureData = { features: [], subclasses: [] }
  const ranger = {
    level: 1,
    characterClassId: 'patrulheiro',
    classSubclassId: '',
    classFeatureChoices: {},
    spells: '{}',
  } as CharacterDetails
  const wizard = { ...ranger, characterClassId: 'mago' } as CharacterDetails
  const cleric = { ...ranger, characterClassId: 'clerigo' } as CharacterDetails

  assert.equal(hasLevelUpChoices(ranger, 'patrulheiro', classData, 2), true)
  assert.equal(hasLevelUpChoices(wizard, 'mago', classData, 2), true)
  assert.equal(hasLevelUpChoices(cleric, 'clerigo', classData, 2), false)
})

test('a subclass threshold or ASI prompts for choices before saving the new level', () => {
  const character = {
    level: 3,
    characterClassId: 'fighter-record-id',
    classSubclassId: 'champion',
    classFeatureChoices: {},
  } as CharacterDetails
  const classData: ClassFeatureData = {
    features: [{ level: 4, name: 'Incremento no Valor de Habilidade', description: '' }],
    subclasses: [{ id: 'champion', name: 'Campeão', selectionLevel: 3, features: [] }],
  }
  const awaitingSubclass = { ...character, level: 2, classSubclassId: '' }

  assert.equal(hasLevelUpChoices(awaitingSubclass, 'fighter', classData, 3), true)
  assert.equal(hasLevelUpChoices(character, 'fighter', classData, 4), true)
})

test('a previously confirmed ASI is not applied a second time after XP goes down and back up', () => {
  const key = 'ability-score-increase:fighter-record-id:4'
  const character = {
    level: 3,
    characterClassId: 'fighter-record-id',
    classSubclassId: 'champion',
    classFeatureChoices: { [key]: ['strength'], [`${key}:mode`]: ['ability'] },
    abilityScoreIncreases: { classId: 'fighter-record-id', selections: { [key]: ['strength'] } },
  } as CharacterDetails
  const classData: ClassFeatureData = {
    features: [{ level: 4, name: 'Incremento no Valor de Habilidade', description: '' }],
    subclasses: [{ id: 'champion', name: 'Campeão', selectionLevel: 3, features: [] }],
  }

  assert.equal(hasConfirmedAbilityIncrease(character, 4), true)
  assert.equal(hasLevelUpChoices(character, 'fighter', classData, 4), false)
})

test('barbarian path and totem choices are handled outside the generic class feature registry', () => {
  const barbarian = {
    level: 2,
    characterClassId: 'barbarian-record-id',
    classSubclassId: '',
    classFeatureChoices: {},
    primalPath: '',
    primalTotemChoices: { spiritualTotem: '', beastAspect: '', totemicAttunement: '' },
  } as CharacterDetails
  assert.equal(hasLevelUpChoices(barbarian, 'barbaro', undefined, 3), true)

  const totemic = { ...barbarian, level: 5, primalPath: 'totem-warrior' as const, primalTotemChoices: { spiritualTotem: 'wolf' as const, beastAspect: '', totemicAttunement: '' } }
  assert.equal(hasLevelUpChoices(totemic, 'barbaro', undefined, 6), true)
  assert.equal(hasLevelUpChoices(totemic, 'barbaro', undefined, 14), true)
})
