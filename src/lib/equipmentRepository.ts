import { equipmentCatalog, type EquipmentCatalog, type EquipmentItem } from './equipment'
import { supabase } from './supabase'

export async function loadEquipmentCatalog(): Promise<EquipmentCatalog> {
  if (!supabase) return equipmentCatalog
  const [items, packs, contents, components] = await Promise.all([
    supabase.from('equipment_items').select('data').order('name'),
    supabase.from('equipment_packs').select('id, name, price_cp, source_page').order('name'),
    supabase.from('equipment_pack_items').select('pack_id, item_id, quantity').order('item_id'),
    supabase.from('equipment_item_components').select('kit_item_id, item_id, quantity').order('item_id'),
  ])
  const error = items.error ?? packs.error ?? contents.error ?? components.error
  if (error) throw error
  if (!items.data?.length || !packs.data?.length) throw new Error('Catálogo de equipamentos vazio.')
  return {
    items: items.data.map(row => {
      const item = row.data as EquipmentItem
      return { ...item, components: (components.data ?? []).filter(line => line.kit_item_id === item.id).map(line => ({ itemId: line.item_id, quantity: line.quantity })) }
    }),
    packs: packs.data.map(pack => ({ id: pack.id, name: pack.name, priceCp: pack.price_cp, sourcePage: pack.source_page,
      items: (contents.data ?? []).filter(line => line.pack_id === pack.id).map(line => ({ itemId: line.item_id, quantity: line.quantity })) })),
  }
}
