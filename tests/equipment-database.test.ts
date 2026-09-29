import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { equipmentCatalog } from '../src/lib/equipment'

test('migration seeds exact catalog, enforces pack references and exposes only read access', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated;')
    await db.exec(readFileSync(new URL('../supabase/migrations/20260926160000_equipment_catalog.sql', import.meta.url), 'utf8'))
    const rows = await db.query<{ data: unknown }>('select data from equipment_items order by id')
    assert.deepEqual(rows.rows.map(row => row.data), [...equipmentCatalog.items].sort((a, b) => a.id.localeCompare(b.id)))
    const pack = await db.query<{ item_id: string; quantity: number }>("select item_id, quantity from equipment_pack_items where pack_id = 'burglar' order by item_id")
    assert.equal(pack.rows.find(row => row.item_id === 'piton')?.quantity, 10)
    assert.equal(pack.rows.find(row => row.item_id === 'oleo-frasco')?.quantity, 2)
    await assert.rejects(db.exec("insert into equipment_pack_items values ('burglar', 'missing', 1)"), /foreign key/)
    await assert.rejects(db.exec("update equipment_pack_items set quantity = 0 where pack_id = 'priest'"), /check constraint/)
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      assert.equal((await db.query('select * from equipment_items')).rows.length, equipmentCatalog.items.length)
      assert.equal((await db.query('select * from equipment_packs')).rows.length, 7)
      assert.equal((await db.query('select * from equipment_item_components')).rows.length, equipmentCatalog.items.reduce((count, item) => count + (item.components?.length ?? 0), 0))
      await assert.rejects(db.exec("delete from equipment_items where id = 'adaga'"), /permission denied/)
      await assert.rejects(db.exec("update equipment_pack_items set quantity = 99"), /permission denied/)
      await db.exec('reset role')
    }
    const rls = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname in ('equipment_items', 'equipment_packs', 'equipment_pack_items', 'equipment_item_components')")
    assert.equal(rls.rows.length, 4)
    assert.ok(rls.rows.every(row => row.relrowsecurity))
  } finally { await db.close() }
})
