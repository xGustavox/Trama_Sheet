import assert from 'node:assert/strict'
import test from 'node:test'
import { loadEquipmentCatalogFixture, openEquipmentTestDatabase } from './fixtures/equipmentCatalog'

test('database migrations seed one normalized catalog, enforce references and expose only read access', async () => {
  const db = await openEquipmentTestDatabase()
  try {
    const catalog = await loadEquipmentCatalogFixture()
    const rows = await db.query<{ id: string; data: Record<string, unknown> }>('select id, data from equipment_items order by id')
    assert.equal(rows.rows.length, 508)
    assert.ok(rows.rows.every(row => row.data.id === row.id && !('components' in row.data)))
    assert.equal(catalog.items.length, 508)
    const magicItems = catalog.items.filter(item => item.category === 'magic')
    assert.equal(magicItems.length, 253)
    assert.equal(magicItems.find(item => item.id === 'anel-de-estrelas-cadentes')?.attunement, 'ao ar livre durante a noite')
    assert.equal(magicItems.find(item => item.id === 'arma-de-alerta')?.priceCp, null)
    assert.equal(magicItems.find(item => item.id === 'barco-dobravel')?.priceCp, 800000)
    assert.equal(magicItems.find(item => item.id === 'colar-de-adaptacao')?.priceCp, null)
    assert.equal(magicItems.find(item => item.id === 'escudo-mais-3')?.rarity, 'muito raro')
    assert.equal(magicItems.find(item => item.id === 'estatua-poderes-mosca-de-ebano')?.priceCp, 800000)
    assert.equal(magicItems.find(item => item.id === 'faixas-de-ferro-de-bilarro')?.priceCp, null)
    assert.equal(magicItems.find(item => item.id === 'gema-de-visao')?.attunement, 'sim')
    assert.equal(magicItems.find(item => item.id === 'manto-da-arraia')?.attunement, null)
    assert.equal(magicItems.find(item => item.id === 'instrumento-dos-bardos-harpa-de-ollamh')?.rarity, 'lendário')
    assert.equal(magicItems.find(item => item.id === 'martelo-dos-trovoes')?.attunement, null)
    assert.equal(magicItems.find(item => item.id === 'pedra-ionica')?.rarity, 'variável')
    assert.equal(magicItems.find(item => item.id === 'pocao-de-cura')?.priceCp, 5000)
    assert.equal(magicItems.find(item => item.id === 'robe-do-arquimago')?.attunement, 'bruxo, feiticeiro ou mago')
    assert.equal(magicItems.find(item => item.id === 'robe-do-arquimago')?.description.includes('vantagem em testes de resistência'), true)
    assert.equal(magicItems.find(item => item.id === 'varinha-das-maravilhas')?.rarity, 'rara')
    assert.equal(magicItems.find(item => item.id === 'vingadora-sagrada')?.attunement, 'paladino')
    assert.ok(catalog.items.find(item => item.id === 'kit-de-refeicao')?.components?.length)
    assert.deepEqual(catalog.items.find(item => item.id === 'cota-de-malha')?.armor, {
      ac: 16, dexterity: 'none', strength: 13, stealthDisadvantage: true, shield: false,
    })
    const pack = await db.query<{ item_id: string; quantity: number }>("select item_id, quantity from equipment_pack_items where pack_id = 'burglar' order by item_id")
    assert.equal(pack.rows.find(row => row.item_id === 'piton')?.quantity, 10)
    assert.equal(pack.rows.find(row => row.item_id === 'oleo-frasco')?.quantity, 2)
    await assert.rejects(db.exec("insert into equipment_pack_items values ('burglar', 'missing', 1)"), /foreign key/)
    await assert.rejects(db.exec("update equipment_pack_items set quantity = 0 where pack_id = 'priest'"), /check constraint/)
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      assert.equal((await db.query('select * from equipment_items')).rows.length, catalog.items.length)
      assert.equal((await db.query('select * from equipment_packs')).rows.length, 7)
      assert.equal((await db.query('select * from equipment_item_components')).rows.length, catalog.items.reduce((count, item) => count + (item.components?.length ?? 0), 0))
      await assert.rejects(db.exec("delete from equipment_items where id = 'adaga'"), /permission denied/)
      await assert.rejects(db.exec("update equipment_pack_items set quantity = 99"), /permission denied/)
      await db.exec('reset role')
    }
    const rls = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname in ('equipment_items', 'equipment_packs', 'equipment_pack_items', 'equipment_item_components')")
    assert.equal(rls.rows.length, 4)
    assert.ok(rls.rows.every(row => row.relrowsecurity))
  } finally { await db.close() }
})
