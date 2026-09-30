import type { EquipmentCatalog, EquipmentItem } from './equipment'
import { supabase } from './supabase'

let itemsRequest: Promise<EquipmentItem[]> | null = null
let packsRequest: Promise<EquipmentCatalog['packs']> | null = null

function requireSupabase() {
  if (!supabase) throw new Error('O serviço de dados do equipamento não está configurado.')
  return supabase
}

export async function loadEquipmentItems(): Promise<EquipmentItem[]> {
  if (itemsRequest) return itemsRequest
  const client = requireSupabase()
  itemsRequest = Promise.all([
    client.from('equipment_items').select('data').order('name'),
    client.from('equipment_item_components').select('kit_item_id, item_id, quantity').order('item_id'),
  ]).then(([items, components]) => {
    if (items.error) throw items.error
    if (components.error) throw components.error
    if (!items.data?.length) throw new Error('O catálogo de equipamentos está vazio.')
    const componentsByKit = new Map<string, NonNullable<EquipmentItem['components']>>()
    for (const component of components.data ?? []) {
      const kitComponents = componentsByKit.get(component.kit_item_id) ?? []
      kitComponents.push({ itemId: component.item_id, quantity: component.quantity })
      componentsByKit.set(component.kit_item_id, kitComponents)
    }
    return items.data.map(row => {
      const item = row.data as EquipmentItem
      return { ...item, components: componentsByKit.get(item.id) ?? [] }
    })
  }).catch(error => {
    itemsRequest = null
    throw error
  })
  return itemsRequest
}

function loadEquipmentPacks(): Promise<EquipmentCatalog['packs']> {
  if (packsRequest) return packsRequest
  const client = requireSupabase()
  packsRequest = Promise.all([
    client.from('equipment_packs').select('id, name, price_cp, source_page').order('name'),
    client.from('equipment_pack_items').select('pack_id, item_id, quantity').order('item_id'),
  ]).then(([packs, contents]) => {
    if (packs.error) throw packs.error
    if (contents.error) throw contents.error
    if (!packs.data?.length) throw new Error('O catálogo de pacotes de equipamento está vazio.')
    const contentsByPack = new Map<string, EquipmentCatalog['packs'][number]['items']>()
    for (const content of contents.data ?? []) {
      const packItems = contentsByPack.get(content.pack_id) ?? []
      packItems.push({ itemId: content.item_id, quantity: content.quantity })
      contentsByPack.set(content.pack_id, packItems)
    }
    return packs.data.map(pack => ({
      id: pack.id,
      name: pack.name,
      priceCp: pack.price_cp,
      sourcePage: pack.source_page,
      items: contentsByPack.get(pack.id) ?? [],
    }))
  }).catch(error => {
    packsRequest = null
    throw error
  })
  return packsRequest
}

export async function loadEquipmentCatalog(): Promise<EquipmentCatalog> {
  const [items, packs] = await Promise.all([loadEquipmentItems(), loadEquipmentPacks()])
  return { items, packs }
}

export function clearEquipmentCatalogCache() {
  itemsRequest = null
  packsRequest = null
}
