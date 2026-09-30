import assert from 'node:assert/strict'
import test from 'node:test'
import { cantripsByClass, getSpellListForSelection, leveledSpellsByClass } from '../src/lib/spellCatalog'
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
