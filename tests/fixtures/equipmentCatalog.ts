import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import type { EquipmentCatalog, EquipmentItem } from '../../src/lib/equipment'

export async function openEquipmentTestDatabase() {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated;')
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260926160000_equipment_catalog.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930160000_equipment_components_normalized.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930170000_magic_items.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930180000_magic_items_part_2.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930190000_magic_items_part_3.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930200000_magic_items_part_4.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930210000_magic_items_part_5.sql', import.meta.url), 'utf8'))
  return db
}

export async function loadEquipmentCatalogFixture(): Promise<EquipmentCatalog> {
  const db = await openEquipmentTestDatabase()
  try {
    const [items, components, packs, packItems] = await Promise.all([
      db.query<{ data: EquipmentItem }>('select data from equipment_items order by name'),
      db.query<{ kit_item_id: string; item_id: string; quantity: number | null }>('select kit_item_id, item_id, quantity from equipment_item_components order by item_id'),
      db.query<{ id: string; name: string; price_cp: number; source_page: number }>('select id, name, price_cp, source_page from equipment_packs order by name'),
      db.query<{ pack_id: string; item_id: string; quantity: number }>('select pack_id, item_id, quantity from equipment_pack_items order by item_id'),
    ])
    const componentsByKit = new Map<string, NonNullable<EquipmentItem['components']>>()
    for (const component of components.rows) {
      const components = componentsByKit.get(component.kit_item_id) ?? []
      components.push({ itemId: component.item_id, quantity: component.quantity })
      componentsByKit.set(component.kit_item_id, components)
    }
    const itemsByPack = new Map<string, EquipmentCatalog['packs'][number]['items']>()
    for (const item of packItems.rows) {
      const items = itemsByPack.get(item.pack_id) ?? []
      items.push({ itemId: item.item_id, quantity: item.quantity })
      itemsByPack.set(item.pack_id, items)
    }
    return {
      items: items.rows.map(({ data }) => ({ ...data, components: componentsByKit.get(data.id) ?? [] })),
      packs: packs.rows.map(pack => ({ id: pack.id, name: pack.name, priceCp: pack.price_cp, sourcePage: pack.source_page, items: itemsByPack.get(pack.id) ?? [] })),
    }
  } finally {
    await db.close()
  }
}
