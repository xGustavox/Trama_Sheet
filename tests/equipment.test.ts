import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { addInventoryItem, addPack, calculateArmorClass, convertCurrency, currencyDenominations, emptyInventory, equipOneInventoryUnit, equipmentGrantFingerprint, findEquipment, getArmorClassBreakdown, getCurrencyBalances, getCurrencyDisplay, getWeaponAttackModifier, isEquippable, readInventory, reconcileEquipment } from '../src/lib/equipment'
import { startingEquipmentPlan, type EquipmentContext } from '../src/lib/startingEquipment'
import { loadEquipmentCatalogFixture } from './fixtures/equipmentCatalog'

const catalog = await loadEquipmentCatalogFixture()

const context = (className = 'Mago'): EquipmentContext => ({
  className, backgroundName: 'Sábio', backgroundEquipment: ['Tinta escura', 'Pena', 'Faca pequena', 'Carta de um colega falecido com uma pergunta ainda sem resposta', 'Roupas comuns', 'Bolsa com 10 po'],
  character: { characterClassId: 'class-id', classSubclassId: '', classFeatureChoices: {}, level: 1, primalPath: '', primalTotemChoices: { spiritualTotem: '', beastAspect: '', totemicAttunement: '' }, raceId: '', racialChoice: '' },
  proficientWithHeavyArmor: false, proficientWithWarhammer: false,
})
const count = (inventory: ReturnType<typeof emptyInventory>, id: string) => inventory.entries.filter(entry => entry.itemId === id).reduce((sum, entry) => sum + entry.quantity, 0)

test('currency denominations are ordered from lowest to highest value', () => {
  assert.deepEqual(currencyDenominations.map(({ code }) => code), ['cp', 'sp', 'ep', 'gp', 'pp'])
})

test('currency display chooses the largest exact coin denomination without rounding', () => {
  assert.deepEqual(getCurrencyDisplay(1000), { amount: 1, code: 'pp', name: 'platina' })
  assert.deepEqual(getCurrencyDisplay(200), { amount: 2, code: 'gp', name: 'ouro' })
  assert.deepEqual(getCurrencyDisplay(150), { amount: 3, code: 'ep', name: 'electro' })
  assert.deepEqual(getCurrencyDisplay(60), { amount: 6, code: 'sp', name: 'prata' })
  assert.deepEqual(getCurrencyDisplay(25), { amount: 25, code: 'cp', name: 'cobre' })
  assert.deepEqual(getCurrencyDisplay(0), { amount: 0, code: 'gp', name: 'ouro' })
})

test('currency balances split total copper into denomination counts without losing value', () => {
  const balances = getCurrencyBalances(1726)
  assert.deepEqual(balances, { gp: 7, sp: 2, ep: 0, cp: 6, pp: 1 })
  assert.equal(currencyDenominations.reduce((total, { code, valueCp }) => total + balances[code] * valueCp, 0), 1726)
})

test('currency conversion spends only complete source-coin groups and preserves total value', () => {
  const balances = { gp: 3, sp: 17, ep: 1, cp: 4, pp: 0 }
  const converted = convertCurrency(balances, 'sp', 'gp', 17)
  assert.deepEqual(converted, { ...balances, sp: 7, gp: 4 })
  assert.equal(currencyDenominations.reduce((total, { code, valueCp }) => total + converted![code] * valueCp, 0),
    currencyDenominations.reduce((total, { code, valueCp }) => total + balances[code] * valueCp, 0))
  assert.deepEqual(convertCurrency(balances, 'gp', 'sp', 2), { ...balances, gp: 1, sp: 37 })
  assert.equal(convertCurrency(balances, 'cp', 'gp', 4), null)
  assert.equal(convertCurrency(balances, 'sp', 'gp', 18), null)
  assert.equal(convertCurrency(balances, 'gp', 'gp', 1), null)
})

test('only catalog weapons and armor can be equipped', () => {
  assert.equal(isEquippable(findEquipment(catalog, 'Cota de malha')), true)
  assert.equal(isEquippable(findEquipment(catalog, 'Adaga')), true)
  assert.equal(isEquippable(findEquipment(catalog, 'Kit de primeiros-socorros')), false)
  assert.equal(isEquippable(findEquipment(catalog, 'Roupas comuns')), false)
  assert.equal(isEquippable(undefined), false)
})

test('each equip action equips one unit from a stack and keeps the remaining quantity', () => {
  const dagger = findEquipment(catalog, 'Adaga')!
  const inventory = addInventoryItem(emptyInventory(), dagger, 4)
  const stack = inventory.entries[0]
  const firstEquip = equipOneInventoryUnit(inventory, stack.id, catalog)

  assert.deepEqual(firstEquip.entries.map(({ quantity, equipped }) => ({ quantity, equipped })), [
    { quantity: 3, equipped: false },
    { quantity: 1, equipped: true },
  ])
  assert.equal(firstEquip.entries.reduce((total, entry) => total + entry.quantity, 0), 4)

  const secondEquip = equipOneInventoryUnit(firstEquip, stack.id, catalog)
  assert.deepEqual(secondEquip.entries.map(({ quantity, equipped }) => ({ quantity, equipped })), [
    { quantity: 2, equipped: false },
    { quantity: 1, equipped: true },
    { quantity: 1, equipped: true },
  ])
  assert.equal(secondEquip.entries.reduce((total, entry) => total + entry.quantity, 0), 4)
})

test('equipping armor replaces armor in the same slot but preserves the shield', () => {
  const halfPlate = findEquipment(catalog, 'Meia-Armadura')!
  const chainMail = findEquipment(catalog, 'Cota de Malha')!
  const shield = findEquipment(catalog, 'Escudo')!
  let inventory = addInventoryItem(emptyInventory(), halfPlate)
  inventory = addInventoryItem(inventory, chainMail)
  inventory = addInventoryItem(inventory, shield)
  inventory = equipOneInventoryUnit(inventory, inventory.entries[0].id, catalog)
  inventory = equipOneInventoryUnit(inventory, inventory.entries[1].id, catalog)
  inventory = equipOneInventoryUnit(inventory, inventory.entries[2].id, catalog)

  assert.deepEqual(inventory.entries.filter(entry => entry.equipped).map(entry => entry.name), ['Cota de Malha', 'Escudo'])
})

test('adding an item matching equipped gear creates a separate unequipped stack', () => {
  const dagger = findEquipment(catalog, 'Adaga')!
  const inventory = addInventoryItem(emptyInventory(), dagger)
  const equipped = equipOneInventoryUnit(inventory, inventory.entries[0].id, catalog)
  const withMoreDaggers = addInventoryItem(equipped, dagger)

  assert.deepEqual(withMoreDaggers.entries.map(({ quantity, equipped: isEquipped }) => ({ quantity, equipped: isEquipped })), [
    { quantity: 1, equipped: true },
    { quantity: 1, equipped: false },
  ])
})

test('armor class uses the equipped armor, its Dexterity limit and the shield', () => {
  const halfPlate = findEquipment(catalog, 'Meia-Armadura')!
  const chainMail = findEquipment(catalog, 'Cota de Malha')!
  const leather = findEquipment(catalog, 'Couro')!
  const chainShirt = findEquipment(catalog, 'Camisão de Malha')!
  const shield = findEquipment(catalog, 'Escudo')!

  assert.equal(calculateArmorClass(halfPlate, undefined, 3), 17)
  assert.equal(calculateArmorClass(chainMail, undefined, 1), 16)
  assert.equal(calculateArmorClass(chainMail, undefined, 4), 16)
  assert.equal(calculateArmorClass(leather, undefined, 3), 14)
  assert.equal(calculateArmorClass(chainShirt, undefined, -1), 12)
  assert.equal(calculateArmorClass(halfPlate, shield, 3), 19)
  assert.equal(calculateArmorClass(undefined, undefined, 2, 3), 15)

  assert.deepEqual(getArmorClassBreakdown(halfPlate, shield, 3).map(({ key, value }) => [key, value]), [
    ['base', 15],
    ['dexterity', 2],
    ['shield', 2],
  ])
  assert.deepEqual(getArmorClassBreakdown(undefined, shield, 2, 3).map(({ key, value }) => [key, value]), [
    ['base', 10],
    ['dexterity', 2],
    ['unarmored-defense', 3],
    ['shield', 2],
  ])
})

test('catalog contains every concrete PDF table row and references real pack components', () => {
  assert.equal(new Set(catalog.items.map(item => item.id)).size, catalog.items.length)
  assert.equal(catalog.items.filter(item => item.sourcePage === 145).length, 13)
  assert.equal(catalog.items.filter(item => item.sourcePage === 149).length, 37)
  assert.equal(catalog.items.filter(item => item.sourcePage === 150).length, 99)
  assert.equal(catalog.items.filter(item => item.sourcePage === 154).length, 50)
  assert.equal(catalog.packs.length, 7)
  for (const pack of catalog.packs) for (const line of pack.items) {
    assert.ok(catalog.items.some(item => item.id === line.itemId), line.itemId)
    assert.ok(Number.isInteger(line.quantity) && line.quantity > 0)
  }
  for (const kit of catalog.items) for (const component of kit.components ?? []) {
    assert.ok(catalog.items.some(item => item.id === component.itemId), `${kit.id}: ${component.itemId}`)
    assert.ok(component.quantity === null || Number.isInteger(component.quantity) && component.quantity > 0)
  }
  assert.equal(findEquipment(catalog, 'Kit de primeiros-socorros')?.maxUses, 10)
  assert.equal(findEquipment(catalog, 'Cota de malha')?.armor?.ac, 16)
  assert.equal(findEquipment(catalog, 'Cota de malha')?.armor?.dexterity, 'none')
  assert.equal(findEquipment(catalog, 'Besta leve')?.weightKg, 2.5)
  assert.equal(findEquipment(catalog, 'Flechas (20)')?.priceCp, 100)
  assert.equal(findEquipment(catalog, 'Kit de refeição')?.priceCp, null)
})

test('weapon attack modifiers use Strength for melee, Dexterity for ranged, and add proficiency when trained', () => {
  const rapier = findEquipment(catalog, 'Rapieira')!
  const longbow = findEquipment(catalog, 'Arco Longo')!
  const shortbow = findEquipment(catalog, 'Arco Curto')!
  const shortsword = findEquipment(catalog, 'Espada Curta')!
  const greatsword = findEquipment(catalog, 'Espada Grande')!
  const quarterstaff = findEquipment(catalog, 'Bordão')!

  assert.deepEqual(getWeaponAttackModifier(rapier, 'paladino', '', 7, 2, 1, 3, true, true), { ability: 'strength', proficient: true, modifier: 5 })
  assert.deepEqual(getWeaponAttackModifier(longbow, 'paladino', '', 7, 2, 1, 3, true, true), { ability: 'dexterity', proficient: true, modifier: 4 })
  assert.deepEqual(getWeaponAttackModifier(shortsword, 'monge', '', 1, 1, 3, 2, false, false), { ability: 'strength', proficient: true, modifier: 3 })
  assert.deepEqual(getWeaponAttackModifier(shortsword, 'monge', '', 1, 1, 3, 2, true, false), { ability: 'strength', proficient: true, modifier: 3 })
  assert.deepEqual(getWeaponAttackModifier(quarterstaff, 'monge', '', 1, 2, 1, 2, true, false), { ability: 'strength', proficient: true, modifier: 4 })
  assert.deepEqual(getWeaponAttackModifier(rapier, 'mago', '', 5, 0, 3, 3, false, false), { ability: 'strength', proficient: false, modifier: 0 })
  assert.deepEqual(getWeaponAttackModifier(rapier, 'paladino', '', 1, 1, 4, 2, false, false), { ability: 'strength', proficient: true, modifier: 3 })
  assert.deepEqual(getWeaponAttackModifier(shortbow, 'mago', '', 1, 4, -1, 2, false, false), { ability: 'dexterity', proficient: false, modifier: -1 })
  assert.deepEqual(getWeaponAttackModifier(greatsword, 'bardo', 'colegio-da-bravura', 2, 0, 1, 2, false, false), { ability: 'strength', proficient: false, modifier: 0 })
  assert.deepEqual(getWeaponAttackModifier(greatsword, 'bardo', 'colegio-da-bravura', 3, 0, 1, 2, false, false), { ability: 'strength', proficient: true, modifier: 2 })
})

test('packs share canonical items, preserve quantities and retain source ownership', () => {
  let inventory = addPack(emptyInventory(), catalog, 'burglar')
  inventory = addPack(inventory, catalog, 'priest')
  assert.equal(count(inventory, 'mochila'), 2)
  assert.equal(count(inventory, 'vela'), 15)
  assert.equal(count(inventory, 'racoes-de-viagem'), 7)
  assert.equal(count(inventory, 'piton'), 10)
  inventory.entries = inventory.entries.filter(entry => entry.source !== 'pack:burglar')
  assert.equal(count(inventory, 'vela'), 10)
  assert.equal(count(inventory, 'racoes-de-viagem'), 2)
  assert.equal(count(inventory, 'piton'), 0)
})

test('equipment IDs still work in browsers without crypto.randomUUID', () => {
  const browserCrypto = globalThis.crypto
  const original = Object.getOwnPropertyDescriptor(browserCrypto, 'randomUUID')
  Object.defineProperty(browserCrypto, 'randomUUID', { configurable: true, value: undefined })
  try {
    const item = findEquipment(catalog, 'Adaga')!
    const added = addInventoryItem(emptyInventory(), item)
    const reconciled = reconcileEquipment(emptyInventory(), [{ key: 'class:test', label: 'Classe', items: [{ itemId: item.id, quantity: 1 }] }], catalog)

    assert.match(added.entries[0].id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
    assert.match(reconciled.entries[0].id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
  } finally {
    if (original) Object.defineProperty(browserCrypto, 'randomUUID', original)
    else Reflect.deleteProperty(browserCrypto, 'randomUUID')
  }
})

test('class alternatives do not grant both options; ammo is one listed bundle', () => {
  const ctx = context('Guerreiro')
  const inventory = emptyInventory()
  inventory.choices = {
    'class:guerreiro:armor': 'leather-bow', 'class:guerreiro:weapons': 'two',
    'class:guerreiro:weapons/two/0': 'rapieira', 'class:guerreiro:weapons/two/1': 'espada-curta',
    'class:guerreiro:secondary': 'hatchets', 'class:guerreiro:pack': 'dungeoneer',
  }
  const plan = startingEquipmentPlan(catalog, ctx, inventory)
  assert.deepEqual(plan.missing, [])
  const result = reconcileEquipment(inventory, plan.grants, catalog)
  for (const id of ['couro', 'arco-longo', 'flechas', 'rapieira', 'espada-curta']) assert.equal(count(result, id), 1, id)
  assert.equal(count(result, 'machadinha'), 2)
  assert.equal(count(result, 'cota-de-malha'), 0)
  assert.equal(count(result, 'escudo'), 0)
  assert.equal(count(result, 'virotes'), 0)
  assert.equal(count(result, 'piton'), 10)
})

test('consumed grants stay consumed across serialization; changing one choice preserves others', () => {
  const ctx = context()
  let inventory = emptyInventory()
  inventory.choices = { 'class:mago:weapon': 'adaga', 'class:mago:focus': 'bolsa-de-componentes', 'class:mago:pack': 'scholar' }
  inventory = reconcileEquipment(inventory, startingEquipmentPlan(catalog, ctx, inventory).grants, catalog)
  assert.equal(count(inventory, 'grimorio'), 1)
  assert.equal(inventory.currencyCp, 1000)
  inventory.entries = inventory.entries.filter(entry => entry.itemId !== 'grimorio')
  inventory.currencyCp = 317
  const dagger = inventory.entries.find(entry => entry.itemId === 'adaga')!
  dagger.notes = 'Presente da avó'
  dagger.equipped = true
  inventory = addInventoryItem(inventory, findEquipment(catalog, 'Mochila')!, 3)
  inventory = readInventory(JSON.stringify(inventory), catalog)
  const unchanged = reconcileEquipment(inventory, startingEquipmentPlan(catalog, ctx, inventory).grants, catalog)
  assert.deepEqual(unchanged, inventory)
  inventory.choices['class:mago:pack'] = 'explorer'
  const changed = reconcileEquipment(inventory, startingEquipmentPlan(catalog, ctx, inventory).grants, catalog)
  assert.equal(count(changed, 'grimorio'), 0)
  assert.equal(count(changed, 'mochila'), 4)
  assert.equal(count(changed, 'livro'), 0)
  assert.equal(count(changed, 'racoes-de-viagem'), 10)
  assert.equal(changed.entries.find(entry => entry.id === dagger.id)?.notes, 'Presente da avó')
  assert.equal(changed.currencyCp, 317)
})

test('all 12 classes have resolvable alternatives; repeated weapons are allowed', () => {
  const expectedPackChoices: Record<string, string[]> = {
    Bardo: ['diplomat', 'artist'], Clérigo: ['priest', 'explorer'], Bruxo: ['scholar', 'explorer'],
    Feiticeiro: ['dungeoneer', 'explorer'], Guerreiro: ['dungeoneer', 'explorer'],
    Ladino: ['burglar', 'dungeoneer', 'explorer'], Mago: ['scholar', 'explorer'],
    Monge: ['dungeoneer', 'explorer'], Paladino: ['priest', 'explorer'], Patrulheiro: ['dungeoneer', 'explorer'],
  }
  for (const name of ['Bárbaro', 'Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro', 'Guerreiro', 'Ladino', 'Mago', 'Monge', 'Paladino', 'Patrulheiro']) {
    const ctx = context(name)
    const inventory = emptyInventory()
    const initial = startingEquipmentPlan(catalog, ctx, inventory)
    assert.ok(initial.choices.length >= 2, name)
    if (expectedPackChoices[name]) {
      assert.deepEqual(initial.choices.find(group => group.key.endsWith(':pack'))?.options.map(option => option.id), expectedPackChoices[name], `${name} package options`)
    } else {
      const expectedPack = catalog.packs.find(pack => pack.id === 'explorer')!
      const fixedItems = initial.grants.find(grant => grant.key === `class:${name === 'Bárbaro' ? 'barbaro' : 'druida'}:fixed`)!.items
      for (const packItem of expectedPack.items) {
        assert.ok(fixedItems.some(item => item.itemId === packItem.itemId && item.quantity >= packItem.quantity), `${name}: missing ${packItem.itemId} from fixed explorer pack`)
      }
    }
    for (const group of initial.choices) {
      for (const option of group.options) {
        for (const line of option.items) assert.ok(catalog.items.some(item => item.id === line.itemId), `${name}: ${line.itemId}`)
        for (const pick of option.picks) assert.ok(pick.itemIds.length > 0, `${name}: ${pick.label}`)
      }
      const option = group.options.at(-1)!
      inventory.choices[group.key] = option.id
      for (const pick of option.picks) inventory.choices[`${group.key}/${option.id}/${pick.id}`] = pick.itemIds[0]
    }
    assert.deepEqual(startingEquipmentPlan(catalog, ctx, inventory).missing, [], name)
  }
})

test('cleric proficiency gates warhammer and heavy armor; paladin only gets melee alternatives', () => {
  const cleric = context('Clérigo')
  const options = (ctx: EquipmentContext, id: string) => startingEquipmentPlan(catalog, ctx, emptyInventory()).choices.find(group => group.key.endsWith(`:${id}`))!.options
  assert.deepEqual(options(cleric, 'weapon').map(option => option.id), ['maca'])
  assert.ok(!options(cleric, 'armor').some(option => option.id === 'cota-de-malha'))
  cleric.proficientWithWarhammer = true
  cleric.proficientWithHeavyArmor = true
  assert.ok(options(cleric, 'weapon').some(option => option.id === 'martelo-de-guerra'))
  assert.ok(options(cleric, 'armor').some(option => option.id === 'cota-de-malha'))
  const ids = options(context('Paladino'), 'secondary')[1].picks[0].itemIds
  assert.ok(ids.includes('lanca'))
  assert.ok(!ids.includes('arco-curto'))
})

test('Book of Shadows is gated by active class, level and choice, not stale choice values', () => {
  const ctx = context('Bruxo')
  const key = 'class-id::3:Dádiva do Pacto:dadiva-do-pacto'
  ctx.character.classFeatureChoices[key] = ['pacto-do-tomo']
  const granted = () => startingEquipmentPlan(catalog, ctx, emptyInventory()).grants.some(grant => grant.key === 'feature:book-of-shadows')
  assert.equal(granted(), false)
  ctx.character.level = 3
  assert.equal(granted(), true)
  ctx.character.classSubclassId = 'new-patron'
  assert.equal(granted(), false)
  ctx.character.classSubclassId = ''
  ctx.character.classFeatureChoices[key] = ['pacto-da-lamina']
  assert.equal(granted(), false)
})

test('every current background item and selected tool resolves, with explicit alternatives', () => {
  // Inspect the source-owned background definitions; keep this check sensitive to new unmatched grants.
  const source = readFileSync(new URL('../src/components/CharacterCreationWizard.tsx', import.meta.url), 'utf8')
  const block = source.slice(source.indexOf('const backgroundRules:'), source.indexOf('const abilityLabels'))
  const arrays = [...block.matchAll(/equipment: \[([^\]]+)\]/g)]
  for (const array of arrays) {
    const texts = [...array[1].matchAll(/'([^']+)'/g)].map(match => match[1].replace('Instrumento musical do tipo escolhido', 'Alaúde').replace('Ferramentas de artesão do tipo escolhido', 'Ferramentas de carpinteiro'))
    const ctx = { ...context(), backgroundEquipment: texts }
    const plan = startingEquipmentPlan(catalog, ctx, emptyInventory())
    assert.ok(!plan.missing.some(message => message.startsWith('Defina o item')), plan.missing.join('; '))
  }
  for (const name of ['Ferramentas de calígrafo', 'Ferramentas de couro', 'Materiais de pintor', 'Suprimentos de oleiro', 'Saltério', 'Chifre', 'Charamela', 'Viola', 'Corda de seda (15 m)', 'Anel de sinete']) assert.ok(findEquipment(catalog, name), name)
  const merchant = startingEquipmentPlan(catalog, { ...context(), backgroundEquipment: ['Mula e carroça no lugar das ferramentas de artesão'] }, emptyInventory())
  assert.deepEqual(merchant.grants.find(grant => grant.key.startsWith('background:'))?.items, [{ itemId: 'mula', quantity: 1 }, { itemId: 'carroca', quantity: 1 }])
})

test('unlisted fixed background items enter inventory without becoming unresolved choices', () => {
  const ctx = { ...context(), backgroundEquipment: ['2 Relíquia da família'] }
  const plan = startingEquipmentPlan(catalog, ctx, emptyInventory())
  assert.ok(!plan.missing.some(message => message.startsWith('Defina o item')))
  const grant = plan.grants.find(candidate => candidate.key.startsWith('background:'))!
  assert.deepEqual(grant.unlistedItems, [{ name: 'Relíquia da família', quantity: 2 }])
  const inventory = reconcileEquipment(emptyInventory(), [grant], catalog)
  assert.deepEqual(inventory.entries.map(({ itemId, name, quantity }) => ({ itemId, name, quantity })), [{ itemId: null, name: 'Relíquia da família', quantity: 2 }])
  const restored = readInventory(JSON.stringify(inventory), catalog)
  assert.deepEqual(reconcileEquipment(restored, [grant], catalog), restored)
  assert.equal(equipmentGrantFingerprint({ key: 'same', label: 'Same', items: [], currencyCp: 0 }), '{"items":[],"currencyCp":0}')
})

test('legacy text and selected packs survive migration and version 2 round-trip', () => {
  const legacy = readInventory(JSON.stringify({ armor: 'Couro', weapons: 'Adaga', miscellaneous: 'Relíquia da família', packs: ['scholar'] }), catalog)
  assert.equal(count(legacy, 'couro'), 1)
  assert.equal(count(legacy, 'adaga'), 1)
  assert.equal(count(legacy, 'pergaminho-uma-folha'), 10)
  assert.equal(legacy.entries.find(entry => entry.name === 'Relíquia da família')?.itemId, null)
  assert.deepEqual(readInventory(JSON.stringify(legacy), catalog), legacy)
  assert.equal(readInventory('Uma espada herdada\nNotas antigas').legacyNotes, 'Uma espada herdada\nNotas antigas')
})

test('partially malformed version 2 inventory remains safe to render in the equipment step', () => {
  const inventory = readInventory(JSON.stringify({
    version: 2,
    entries: [{ itemId: 'adaga', name: 'Adaga herdada', quantity: 2 }],
    choices: null,
    applied: { stale: '{' },
  }), catalog)

  assert.deepEqual(inventory.choices, {})
  assert.deepEqual(inventory.applied, {})
  assert.equal(inventory.entries[0].source, 'legacy')
  assert.equal(inventory.entries[0].sourceLabel, 'Inventário anterior')
  assert.doesNotThrow(() => reconcileEquipment(inventory, startingEquipmentPlan(catalog, context(), inventory).grants, catalog))
})

test('inventory preserves editable category and attack bonus overrides', () => {
  const inventory = readInventory(JSON.stringify({
    version: 2,
    entries: [{ id: 'weapon-entry', itemId: 'adaga', name: 'Adaga personalizada', category: 'weapons', quantity: 1, equipped: true, attackBonus: 5 }],
  }), catalog)

  assert.equal(inventory.entries[0].category, 'weapons')
  assert.equal(inventory.entries[0].attackBonus, 5)
  assert.deepEqual(readInventory(JSON.stringify(inventory), catalog), inventory)
})
