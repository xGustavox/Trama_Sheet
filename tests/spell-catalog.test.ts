import assert from 'node:assert/strict'
import test from 'node:test'
import { cantripsByClass, getAllSpellOptions, getAlwaysPreparedSpells, getClericDomainSpellsByLevel, getGrantedClassCantrips, getRitualSpellOptions, getSpellListForSelection, leveledSpellsByClass } from '../src/lib/spellCatalog'
import { allSpellDetails, getSpellDetails } from '../src/lib/spellDetails'

test('spell catalog covers every spell level available to each listed class', () => {
  assert.deepEqual(Object.keys(leveledSpellsByClass).sort(), [
    'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'mago', 'paladino', 'patrulheiro',
  ])
  for (const [className, spellLevels] of Object.entries(leveledSpellsByClass)) {
    const highestLevel = className === 'paladino' || className === 'patrulheiro' ? 5 : 9
    assert.deepEqual(Object.keys(spellLevels).map(Number).sort((first, second) => first - second), Array.from({ length: highestLevel }, (_, index) => index + 1))
    for (const spells of Object.values(spellLevels)) {
      assert.ok(spells.length > 0)
      assert.equal(new Set(spells).size, spells.length)
    }
  }
})

test('higher-level options remain class-specific and cantrips are not offered to half casters', () => {
  assert.ok(leveledSpellsByClass.mago[9].includes('Desejo'))
  assert.ok(leveledSpellsByClass.paladino[5].includes('Onda Destrutiva'))
  assert.ok(leveledSpellsByClass.patrulheiro[5].includes('Aljava Veloz'))
  assert.equal(leveledSpellsByClass.paladino[6], undefined)
  assert.equal(leveledSpellsByClass.patrulheiro[6], undefined)
  assert.equal(cantripsByClass.paladino, undefined)
  assert.equal(cantripsByClass.patrulheiro, undefined)
})

test('paladin oath spells are selectable at their actual spell level without duplicating base-list spells', () => {
  const vengeance = getSpellListForSelection('paladino', 'juramento-de-vinganca')
  assert.ok(vengeance[1].includes('Marca do Caçador'))
  assert.ok(vengeance[2].includes('Imobilizar Pessoa'))
  assert.ok(vengeance[3].includes('Velocidade'))
  assert.ok(vengeance[4].includes('Porta Dimensional'))
  assert.ok(vengeance[5].includes('Vidência'))
  assert.equal(vengeance[2].filter((spell) => spell === 'Passo Nebuloso').length, 1)
  assert.equal(Object.values(getSpellListForSelection('paladino', '')).flat().includes('Marca do Caçador'), false)
})

test('other subclass spell expansions are added only to the selected subclass', () => {
  const warlock = getSpellListForSelection('bruxo', 'arquifada')
  assert.ok(warlock[1].includes('Fogo das Fadas'))
  assert.ok(warlock[5].includes('Dominar Pessoa'))
  assert.equal(getSpellListForSelection('bruxo', 'o-corruptor')[1].includes('Fogo das Fadas'), false)

  const cleric = getSpellListForSelection('clerigo', 'dominio-da-luz')
  assert.ok(cleric[1].includes('Mãos Flamejantes'))
  assert.ok(cleric[3].includes('Bola de Fogo'))
  assert.equal(Object.values(getSpellListForSelection('clerigo', '')).flat().includes('Bola de Fogo'), false)

  const landDruid = getSpellListForSelection('druida', 'circulo-da-terra', 'artico')
  assert.ok(landDruid[2].includes('Imobilizar Pessoa'))
  assert.ok(landDruid[5].includes('Cone de Frio'))
  assert.equal(getSpellListForSelection('druida', 'circulo-da-terra', 'deserto')[2].includes('Passo Nebuloso'), false)
})

test('PDF spell details cover every class spell and cantrip without renaming saved selections', () => {
  const classSpellNames = new Set([
    ...Object.values(cantripsByClass).flat(),
    ...Object.values(leveledSpellsByClass).flatMap((levels) => Object.values(levels).flat()),
  ])

  assert.equal(allSpellDetails.length, 362)
  assert.equal(new Set(allSpellDetails.map((spell) => spell.name)).size, allSpellDetails.length)
  for (const spell of allSpellDetails) {
    assert.ok(spell.castingTime)
    assert.ok(spell.range)
    assert.ok(spell.components)
    assert.ok(spell.duration)
  }
  for (const name of classSpellNames) {
    assert.ok(getSpellDetails(name), `missing PDF details for ${name}`)
  }
})

test('spell-name aliases resolve metadata for existing catalog spell names', () => {
  assert.equal(getSpellDetails('Construir')?.name, 'FABRICAR')
  assert.equal(getSpellDetails('Dominar Criatura')?.name, 'DOMINAR MONSTRO')
  assert.equal(getSpellDetails('Guardiões Espirituais')?.name, 'ESPÍRITOS GUARDIÕES')
  assert.equal(getSpellDetails('Infringir Ferimentos')?.name, 'INFLIGIR FERIMENTOS')
})

test('cleric domain spells match the seven reference tables and unlock at cleric levels 1, 3, 5, 7 and 9', () => {
  const expectedDomains: Record<string, Record<number, string[]>> = {
    'dominio-do-conhecimento': {
      1: ['Comando', 'Identificação'], 2: ['Augúrio', 'Sugestão'], 3: ['Dificultar Detecção', 'Falar com os Mortos'],
      4: ['Olho Arcano', 'Confusão'], 5: ['Conhecimento Lendário', 'Vidência'],
    },
    'dominio-da-enganacao': {
      1: ['Enfeitiçar Pessoa', 'Disfarçar-se'], 2: ['Reflexos', 'Passos sem Pegadas'], 3: ['Piscar', 'Dissipar Magia'],
      4: ['Porta Dimensional', 'Metamorfose'], 5: ['Dominar Pessoa', 'Modificar Memória'],
    },
    'dominio-da-guerra': {
      1: ['Auxílio Divino', 'Escudo da Fé'], 2: ['Arma Mágica', 'Arma Espiritual'], 3: ['Manto do Cruzado', 'Guardiões Espirituais'],
      4: ['Movimentação Livre', 'Pele de Pedra'], 5: ['Coluna de Chamas', 'Imobilizar Monstro'],
    },
    'dominio-da-luz': {
      1: ['Mãos Flamejantes', 'Fogo das Fadas'], 2: ['Esfera Flamejante', 'Raio Ardente'], 3: ['Luz do Dia', 'Bola de Fogo'],
      4: ['Guardião da Fé', 'Muralha de Fogo'], 5: ['Coluna de Chamas', 'Vidência'],
    },
    'dominio-da-natureza': {
      1: ['Amizade Animal', 'Falar com Animais'], 2: ['Pele de Árvore', 'Crescer Espinhos'], 3: ['Ampliar Plantas', 'Muralha de Vento'],
      4: ['Dominar Besta', 'Vinha Esmagadora'], 5: ['Praga de Insetos', 'Caminhar em Árvores'],
    },
    'dominio-da-tempestade': {
      1: ['Névoa Obscurecente', 'Onda Trovejante'], 2: ['Lufada de Vento', 'Despedaçar'], 3: ['Convocar Relâmpagos', 'Nevasca'],
      4: ['Controlar a Água', 'Tempestade de Gelo'], 5: ['Onda Destrutiva', 'Praga de Insetos'],
    },
    'dominio-da-vida': {
      1: ['Bênção', 'Curar Ferimentos'], 2: ['Restauração Menor', 'Arma Espiritual'], 3: ['Sinal de Esperança', 'Revivificar'],
      4: ['Proteção contra a Morte', 'Guardião da Fé'], 5: ['Curar Ferimentos em Massa', 'Reviver os Mortos'],
    },
  }

  for (const [domainId, expectedSpells] of Object.entries(expectedDomains)) {
    assert.deepEqual(getClericDomainSpellsByLevel(domainId, 20), expectedSpells, `${domainId} must match its full reference table`)
    for (const [spellLevel, spells] of Object.entries(expectedSpells)) {
      const clericUnlockLevel = Number(spellLevel) * 2 - 1
      assert.equal(getClericDomainSpellsByLevel(domainId, clericUnlockLevel - 1)[Number(spellLevel)] !== undefined, false)
      assert.deepEqual(getClericDomainSpellsByLevel(domainId, clericUnlockLevel)[Number(spellLevel)], spells)
    }
  }
  assert.deepEqual(getClericDomainSpellsByLevel('dominio-da-luz', 1), { 1: expectedDomains['dominio-da-luz'][1] })
  assert.deepEqual(getClericDomainSpellsByLevel('juramento-de-devocao', 20), {})
})

test('cleric, paladin and Land Circle bonus spells are always prepared at their unlock levels', () => {
  assert.deepEqual(getAlwaysPreparedSpells('clerigo', 'dominio-da-luz', 1), {
    1: ['Mãos Flamejantes', 'Fogo das Fadas'],
  })
  assert.deepEqual(getAlwaysPreparedSpells('paladino', 'juramento-de-vinganca', 2), {})
  assert.deepEqual(getAlwaysPreparedSpells('paladino', 'juramento-de-vinganca', 3), {
    1: ['Perdição', 'Marca do Caçador'],
  })
  assert.deepEqual(getAlwaysPreparedSpells('paladino', 'juramento-de-vinganca', 5)[2], ['Imobilizar Pessoa', 'Passo Nebuloso'])
  assert.deepEqual(getAlwaysPreparedSpells('druida', 'circulo-da-terra', 2, 'floresta'), {})
  assert.deepEqual(getAlwaysPreparedSpells('druida', 'circulo-da-terra', 3, 'floresta'), {
    2: ['Patas de Aranha', 'Pele de Árvore'],
  })
  assert.deepEqual(getAlwaysPreparedSpells('druida', 'circulo-da-terra', 5, 'floresta')[3], ['Convocar Relâmpagos', 'Ampliar Plantas'])
})

test('Light domain and the selected Land Circle cantrip are granted without replacing class choices', () => {
  assert.deepEqual(getGrantedClassCantrips('clerigo', 'dominio-da-luz', 1), ['Luz'])
  assert.deepEqual(getGrantedClassCantrips('clerigo', 'dominio-da-vida', 20), [])
  assert.deepEqual(getGrantedClassCantrips('druida', 'circulo-da-terra', 1, 'orientacao'), [])
  assert.deepEqual(getGrantedClassCantrips('druida', 'circulo-da-terra', 2, 'produzir-chamas'), ['Criar Chamas'])
  assert.deepEqual(getGrantedClassCantrips('druida', 'circulo-da-terra', 2, 'unknown'), [])
})

test('ritual list contains Pact of the Chain spell and only includes spells up to the requested level', () => {
  const firstLevelRituals = getRitualSpellOptions(1)
  assert.ok(firstLevelRituals.some(({ name, level }) => name === 'Convocar Familiar' && level === 1))
  assert.ok(firstLevelRituals.some(({ name, level }) => name === 'Identificação' && level === 1))
  assert.ok(firstLevelRituals.every(({ level }) => level === 1))
  assert.ok(getRitualSpellOptions(2).some(({ level }) => level === 2))
})

test('Magical Secrets can browse spells and cantrips from every class up to the bard spell-tier limit', () => {
  const available = getAllSpellOptions(3, true)
  assert.ok(available.some(({ name, level }) => name === 'Luz' && level === 0))
  assert.ok(available.some(({ name, level }) => name === 'Druidismo' && level === 0))
  assert.ok(available.some(({ name, level }) => name === 'Bola de Fogo' && level === 3))
  assert.ok(!available.some(({ level }) => level > 3))
})
