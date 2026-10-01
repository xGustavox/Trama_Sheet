export type EquipmentItem = {
  id: string
  name: string
  category: 'armor' | 'weapons' | 'tools' | 'instruments' | 'gear' | 'magic'
  subcategory: string
  rarity?: string
  attunement?: string | null
  priceCp: number | null
  weightKg: number | null
  unit: string
  description: string
  properties: string[]
  sourcePage: number | null
  aliases: string[]
  components?: { itemId: string; quantity: number | null }[]
  maxUses?: number
  armor?: { ac: number; dexterity: 'full' | 'max2' | 'none'; strength: number | null; stealthDisadvantage: boolean; shield: boolean }
  weapon?: { damage: string; damageType: string; range: string | null }
}
export type ItemQuantity = { itemId: string; quantity: number }
export type EquipmentPack = { id: string; name: string; priceCp: number; sourcePage: number; items: ItemQuantity[] }
export type EquipmentCatalog = { items: EquipmentItem[]; packs: EquipmentPack[] }
export const normalizeEquipment = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export const findEquipment = (catalog: EquipmentCatalog, name: string) => catalog.items.find(item =>
  [item.id, item.name, ...item.aliases].some(alias => normalizeEquipment(alias) === normalizeEquipment(name)))
export const isEquippable = (item: EquipmentItem | undefined) => Boolean(item?.armor || item?.weapon)

export function getArmorClassBreakdown(armor: EquipmentItem | undefined, shield: EquipmentItem | undefined, dexterityModifier: number, unarmoredBonus = 0) {
  const hasArmor = Boolean(armor?.armor)
  const armorDexterityBonus = !armor?.armor || armor.armor.dexterity === 'full'
    ? dexterityModifier
    : armor.armor.dexterity === 'max2' ? Math.min(2, dexterityModifier) : 0

  return [
    { key: 'base', label: armor?.armor ? `Armadura · ${armor.name}` : 'Base sem armadura', value: armor?.armor?.ac ?? 10 },
    {
      key: 'dexterity',
      label: armor?.armor?.dexterity === 'none' ? 'Destreza (não aplicada)' : armor?.armor?.dexterity === 'max2' ? 'Destreza (máx. +2)' : 'Destreza',
      value: armorDexterityBonus,
    },
    ...(!hasArmor && unarmoredBonus !== 0
      ? [{ key: 'unarmored-defense', label: 'Defesa sem armadura', value: unarmoredBonus }]
      : []),
    { key: 'shield', label: shield?.armor ? `Escudo · ${shield.name}` : 'Escudo (não equipado)', value: shield?.armor?.ac ?? 0 },
  ]
}

export function calculateArmorClass(armor: EquipmentItem | undefined, shield: EquipmentItem | undefined, dexterityModifier: number, unarmoredBonus = 0) {
  return getArmorClassBreakdown(armor, shield, dexterityModifier, unarmoredBonus)
    .reduce((total, contribution) => total + contribution.value, 0)
}

const simpleWeaponClasses = new Set(['barbaro', 'bardo', 'bruxo', 'clerigo', 'druida', 'guerreiro', 'ladino', 'monge', 'paladino', 'patrulheiro'])
const martialWeaponClasses = new Set(['barbaro', 'guerreiro', 'paladino', 'patrulheiro'])
const namedWeaponProficiencies: Record<string, string[]> = {
  bardo: ['besta de mao', 'espada longa', 'rapieira', 'espada curta'],
  druida: ['clava grande', 'adaga', 'dardo', 'azagaia', 'maca', 'bordao', 'cimitarra', 'foice curta', 'funda', 'lanca'],
  feiticeiro: ['adaga', 'dardo', 'funda', 'bordao', 'besta leve'],
  ladino: ['besta de mao', 'espada longa', 'rapieira', 'espada curta'],
  mago: ['adaga', 'dardo', 'funda', 'bordao', 'besta leve'],
  monge: ['espada curta'],
}

function normalizedWeaponName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function getWeaponAttackModifier(
  item: EquipmentItem | undefined,
  classId: string,
  subclassId: string,
  classLevel: number,
  strengthModifier: number,
  dexterityModifier: number,
  proficiencyBonus: number,
  wearingArmor: boolean,
  wearingShield: boolean,
) {
  if (!item?.weapon) return null

  const normalizedClassId = normalizedWeaponName(classId)
  const normalizedSubclassId = normalizedWeaponName(subclassId)
  const subcategory = normalizedWeaponName(item.subcategory)
  const properties = item.properties.map(normalizedWeaponName)
  const isSimple = subcategory.includes('simples')
  const isMartial = subcategory.includes('marcial')
  const name = normalizedWeaponName(item.name)
  const hasSimpleProficiency = simpleWeaponClasses.has(normalizedClassId) && isSimple
  const hasMartialProficiency = martialWeaponClasses.has(normalizedClassId) && isMartial
  const hasSubclassMartialProficiency = (normalizedClassId === 'bardo' && classLevel >= 3 && normalizedSubclassId === 'colegio-da-bravura'
    || normalizedClassId === 'clerigo' && ['dominio-da-guerra', 'dominio-da-tempestade'].includes(normalizedSubclassId)) && isMartial
  const hasNamedProficiency = (namedWeaponProficiencies[normalizedClassId] ?? []).includes(name)
  const isMonkWeapon = normalizedClassId === 'monge'
    && classLevel >= 1
    && !wearingArmor
    && !wearingShield
    && (isSimple && subcategory.includes('corpo a corpo') || name === 'espada curta')
    && !properties.some((property) => property.includes('pesada') || property.includes('duas maos'))
  const ability = subcategory.includes('a distancia') ? 'dexterity' : 'strength'
  const abilityModifier = ability === 'dexterity' ? dexterityModifier : strengthModifier
  const proficient = hasSimpleProficiency || hasMartialProficiency || hasSubclassMartialProficiency || hasNamedProficiency || isMonkWeapon

  return { ability, proficient, modifier: abilityModifier + (proficient ? proficiencyBonus : 0) }
}

export type InventoryEntry = {
  id: string
  itemId: string | null
  name: string
  category?: EquipmentItem['category']
  quantity: number
  equipped: boolean
  notes: string
  attackBonus?: number
  remainingUses?: number
  source: string
  sourceLabel: string
}
export type Inventory = {
  version: 2
  initialEquipmentConfirmed: boolean
  entries: InventoryEntry[]
  choices: Record<string, string>
  applied: Record<string, string>
  currencyCp: number
  currencyBalances?: CurrencyBalances
  legacyNotes: string
}

export function equipOneInventoryUnit(inventory: Inventory, entryId: string, catalog: EquipmentCatalog): Inventory {
  const requested = inventory.entries.find(entry => entry.id === entryId && !entry.equipped)
  if (!requested) return inventory
  const requestedItem = requested.itemId ? catalog.items.find(item => item.id === requested.itemId) : findEquipment(catalog, requested.name)
  const replacesArmorSlot = requestedItem?.armor ? requestedItem.armor.shield : null
  const availableInventory = replacesArmorSlot === null ? inventory : {
    ...inventory,
    entries: inventory.entries.map(entry => {
      if (entry.id === entryId || !entry.equipped) return entry
      const item = entry.itemId ? catalog.items.find(candidate => candidate.id === entry.itemId) : findEquipment(catalog, entry.name)
      return item?.armor && item.armor.shield === replacesArmorSlot ? { ...entry, equipped: false } : entry
    }),
  }
  const target = availableInventory.entries.find(entry => entry.id === entryId && !entry.equipped)
  if (!target) return inventory
  if (target.quantity <= 1) {
    return { ...availableInventory, entries: availableInventory.entries.map(entry => entry.id === entryId ? { ...entry, equipped: true } : entry) }
  }
  const equippedUses = target.remainingUses === undefined ? undefined : Math.ceil(target.remainingUses / target.quantity)
  const equippedCopy: InventoryEntry = {
    ...target,
    id: createInventoryEntryId(),
    quantity: 1,
    equipped: true,
    ...(equippedUses === undefined ? {} : { remainingUses: equippedUses }),
  }
  return {
    ...availableInventory,
    entries: availableInventory.entries.flatMap(entry => entry.id === entryId
      ? [{ ...entry, quantity: entry.quantity - 1, ...(equippedUses === undefined ? {} : { remainingUses: entry.remainingUses! - equippedUses }) }, equippedCopy]
      : [entry]),
  }
}

export type EquipmentGrant = { key: string; label: string; items: ItemQuantity[]; unlistedItems?: { name: string; quantity: number }[]; currencyCp?: number }
export const emptyInventory = (): Inventory => ({ version: 2, initialEquipmentConfirmed: false, entries: [], choices: {}, applied: {}, currencyCp: 0, currencyBalances: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, legacyNotes: '' })

function createInventoryEntryId() {
  const browserCrypto = globalThis.crypto
  if (browserCrypto && typeof browserCrypto.randomUUID === 'function') return browserCrypto.randomUUID()

  const bytes = new Uint8Array(16)
  if (browserCrypto && typeof browserCrypto.getRandomValues === 'function') browserCrypto.getRandomValues(bytes)
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256) })
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function equipmentGrantFingerprint(grant: EquipmentGrant) {
  return JSON.stringify({ items: [...grant.items].sort((a, b) => a.itemId.localeCompare(b.itemId) || a.quantity - b.quantity), ...(grant.unlistedItems?.length ? { unlistedItems: grant.unlistedItems } : {}), currencyCp: grant.currencyCp ?? 0 })
}

export function addInventoryItem(inventory: Inventory, item: EquipmentItem, quantity = 1, source = 'manual', sourceLabel = 'Adicionado pelo jogador'): Inventory {
  const existing = inventory.entries.find(entry => entry.itemId === item.id && entry.source === source && !entry.equipped)
  return { ...inventory, entries: existing
    ? inventory.entries.map(entry => entry.id === existing.id ? { ...entry, quantity: entry.quantity + quantity, ...(item.maxUses ? { remainingUses: (entry.remainingUses ?? entry.quantity * item.maxUses) + quantity * item.maxUses } : {}) } : entry)
    : [...inventory.entries, { id: createInventoryEntryId(), itemId: item.id, name: item.name, category: item.category, quantity, equipped: false, notes: '', source, sourceLabel, ...(item.maxUses ? { remainingUses: quantity * item.maxUses } : {}) }] }
}

export function addPack(inventory: Inventory, catalog: EquipmentCatalog, packId: string): Inventory {
  const pack = catalog.packs.find(pack => pack.id === packId)
  if (!pack) return inventory
  return pack.items.reduce((next, line) => {
    const item = catalog.items.find(item => item.id === line.itemId)
    if (!item) throw new Error(`Item ausente no catálogo: ${line.itemId}`)
    return addInventoryItem(next, item, line.quantity, `pack:${pack.id}`, pack.name)
  }, inventory)
}

// Applied fingerprints survive removal/consumption. Unchanged grants never resurrect items.
// Changing a creation choice replaces only that source, preserving manual and other grants.
export function reconcileEquipment(inventory: Inventory, grants: EquipmentGrant[], catalog: EquipmentCatalog): Inventory {
  const currencyBalances = inventory.currencyBalances ?? getCurrencyBalances(inventory.currencyCp)
  const reconciledCurrencyBalances = currencyBalancesTotalCp(currencyBalances) === inventory.currencyCp
    ? currencyBalances
    : getCurrencyBalances(inventory.currencyCp)
  let next: Inventory = { ...inventory, currencyBalances: reconciledCurrencyBalances, entries: [...inventory.entries], applied: { ...inventory.applied } }
  const active = new Set(grants.map(grant => grant.key))
  for (const key of Object.keys(next.applied)) {
    if (active.has(key)) continue
    const previous = JSON.parse(next.applied[key]) as { currencyCp?: number }
    const previousCurrencyCp = previous.currencyCp ?? 0
    const nextCurrencyCp = Math.max(0, next.currencyCp - previousCurrencyCp)
    next.currencyBalances = applyCurrencyCpDelta(next.currencyBalances ?? getCurrencyBalances(next.currencyCp), nextCurrencyCp - next.currencyCp)
    next.currencyCp = nextCurrencyCp
    next.entries = next.entries.filter(entry => entry.source !== key)
    delete next.applied[key]
  }
  for (const grant of grants) {
    const fingerprint = equipmentGrantFingerprint(grant)
    if (next.applied[grant.key] === fingerprint) continue
    const previous = next.applied[grant.key] ? JSON.parse(next.applied[grant.key]) as { currencyCp: number } : null
    next.entries = next.entries.filter(entry => entry.source !== grant.key)
    const previousCurrencyCp = next.currencyCp
    next.currencyCp = Math.max(0, next.currencyCp + (grant.currencyCp ?? 0) - (previous?.currencyCp ?? 0))
    next.currencyBalances = applyCurrencyCpDelta(next.currencyBalances ?? getCurrencyBalances(previousCurrencyCp), next.currencyCp - previousCurrencyCp)
    for (const line of grant.items) {
      const item = catalog.items.find(item => item.id === line.itemId)
      if (!item) throw new Error(`Item ausente no catálogo: ${line.itemId}`)
      next = addInventoryItem(next, item, line.quantity, grant.key, grant.label)
    }
    for (const item of grant.unlistedItems ?? []) {
      next.entries.push({ id: createInventoryEntryId(), itemId: null, name: item.name, quantity: item.quantity, equipped: false, notes: '', source: grant.key, sourceLabel: grant.label })
    }
    next.applied[grant.key] = fingerprint
  }
  return next
}

export function readInventory(value: string, catalog?: EquipmentCatalog): Inventory {
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { /* Legacy free text is preserved below. */ }
  if (isRecord(parsed) && parsed.version === 2 && Array.isArray(parsed.entries)) {
    const choices = isRecord(parsed.choices)
      ? Object.fromEntries(Object.entries(parsed.choices).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {}
    const applied = isRecord(parsed.applied)
      ? Object.fromEntries(Object.entries(parsed.applied).filter((entry): entry is [string, string] => {
        if (typeof entry[1] !== 'string') return false
        try { return isRecord(JSON.parse(entry[1])) } catch { return false }
      }))
      : {}
    const parsedCurrencyCp = typeof parsed.currencyCp === 'number' && Number.isSafeInteger(parsed.currencyCp) ? Math.max(0, parsed.currencyCp) : null
    const storedCurrencyBalances = readCurrencyBalances(parsed.currencyBalances)
    const storedBalancesMatchLegacyTotal = storedCurrencyBalances !== null
      && parsedCurrencyCp !== null
      && currencyBalancesTotalCp(storedCurrencyBalances) === parsedCurrencyCp
    const legacyCurrencyCp = parsedCurrencyCp ?? (storedCurrencyBalances ? currencyBalancesTotalCp(storedCurrencyBalances) : 0)
    const currencyBalances = storedBalancesMatchLegacyTotal
      ? storedCurrencyBalances!
      : parsedCurrencyCp !== null
        ? getCurrencyBalances(parsedCurrencyCp)
        : storedCurrencyBalances ?? getCurrencyBalances(0)
    return {
      ...emptyInventory(),
      initialEquipmentConfirmed: parsed.initialEquipmentConfirmed === true,
      choices,
      applied,
      currencyCp: legacyCurrencyCp,
      currencyBalances,
      legacyNotes: typeof parsed.legacyNotes === 'string' ? parsed.legacyNotes : '',
      entries: parsed.entries.map((rawEntry, index) => {
        const entry = isRecord(rawEntry) ? rawEntry : {}
        return {
          id: typeof entry.id === 'string' ? entry.id : `legacy:${index}`,
          itemId: typeof entry.itemId === 'string' ? entry.itemId : null,
          name: typeof entry.name === 'string' ? entry.name : 'Item legado',
          ...(entry.category === 'armor' || entry.category === 'weapons' || entry.category === 'tools' || entry.category === 'instruments' || entry.category === 'gear' ? { category: entry.category } : {}),
          quantity: typeof entry.quantity === 'number' && Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1,
          equipped: entry.equipped === true,
          notes: typeof entry.notes === 'string' ? entry.notes : '',
          ...(typeof entry.attackBonus === 'number' && Number.isFinite(entry.attackBonus) ? { attackBonus: entry.attackBonus } : {}),
          ...(typeof entry.remainingUses === 'number' && Number.isSafeInteger(entry.remainingUses) && entry.remainingUses >= 0 ? { remainingUses: entry.remainingUses } : {}),
          source: typeof entry.source === 'string' ? entry.source : 'legacy',
          sourceLabel: typeof entry.sourceLabel === 'string' ? entry.sourceLabel : 'Inventário anterior',
        }
      }),
    }
  }
  let inventory = emptyInventory()
  if (parsed && typeof parsed === 'object' && 'packs' in parsed && Array.isArray(parsed.packs)) {
    if (!catalog) return { ...inventory, legacyNotes: value }
    for (const category of ['armor', 'weapons', 'tools', 'instruments', 'miscellaneous']) {
      const text = (parsed as Record<string, unknown>)[category]
      if (typeof text !== 'string') continue
      for (const line of text.split('\n').map(line => line.trim()).filter(Boolean)) {
        const item = findEquipment(catalog, line)
        if (item) inventory = addInventoryItem(inventory, item)
        else inventory.entries.push({ id: crypto.randomUUID(), itemId: null, name: line, quantity: 1, equipped: false, notes: '', source: 'legacy', sourceLabel: 'Inventário anterior' })
      }
    }
    for (const pack of new Set(parsed.packs)) if (typeof pack === 'string') inventory = addPack(inventory, catalog, pack)
  } else inventory.legacyNotes = value
  return inventory
}

export function formatPrice(cp: number | null) {
  if (cp === null) return '—'
  if (cp % 100 === 0) return `${cp / 100} po`
  if (cp % 10 === 0) return `${cp / 10} pp`
  return `${cp} pc`
}

export function getCurrencyDisplay(currencyCp: number) {
  const denominations = [
    { code: 'pp', value: 1000, name: 'platina' },
    { code: 'gp', value: 100, name: 'ouro' },
    { code: 'ep', value: 50, name: 'electro' },
    { code: 'sp', value: 10, name: 'prata' },
    { code: 'cp', value: 1, name: 'cobre' },
  ] as const
  const denomination = (currencyCp > 0 && denominations.find(({ value }) => Number.isInteger(currencyCp * 100 / value)))
    || denominations.find(({ code }) => code === 'gp')!
  return { amount: Math.round(currencyCp / denomination.value * 100) / 100, code: denomination.code, name: denomination.name }
}

export const currencyDenominations = [
  { code: 'cp', label: 'Cobre', valueCp: 1 },
  { code: 'sp', label: 'Prata', valueCp: 10 },
  { code: 'ep', label: 'Electrum', valueCp: 50 },
  { code: 'gp', label: 'Ouro', valueCp: 100 },
  { code: 'pp', label: 'Platina', valueCp: 1000 },
] as const

export type CurrencyCode = typeof currencyDenominations[number]['code']
export type CurrencyBalances = Record<CurrencyCode, number>

function currencyBalancesTotalCp(balances: CurrencyBalances) {
  return currencyDenominations.reduce((total, { code, valueCp }) => total + balances[code] * valueCp, 0)
}

function readCurrencyBalances(value: unknown): CurrencyBalances | null {
  if (!isRecord(value)) return null
  const balances = Object.fromEntries(currencyDenominations.map(({ code }) => [code, value[code]])) as CurrencyBalances
  if (!currencyDenominations.every(({ code }) => Number.isSafeInteger(balances[code]) && balances[code] >= 0)) return null
  return Number.isSafeInteger(currencyBalancesTotalCp(balances)) ? balances : null
}

export function getCurrencyBalances(currencyCp: number): CurrencyBalances {
  let remaining = Math.max(0, Math.trunc(currencyCp))
  const balances = Object.fromEntries(currencyDenominations.map(({ code }) => [code, 0])) as CurrencyBalances
  for (const { code, valueCp } of [...currencyDenominations].sort((left, right) => right.valueCp - left.valueCp)) {
    balances[code] = Math.floor(remaining / valueCp)
    remaining %= valueCp
  }
  return balances
}

function applyCurrencyCpDelta(balances: CurrencyBalances, deltaCp: number): CurrencyBalances {
  if (deltaCp === 0) return balances
  if (deltaCp > 0) {
    const added = getCurrencyBalances(deltaCp)
    return Object.fromEntries(currencyDenominations.map(({ code }) => [code, balances[code] + added[code]])) as CurrencyBalances
  }

  const totalCp = currencyBalancesTotalCp(balances)
  const amountToRemove = -deltaCp
  if (amountToRemove >= totalCp) return getCurrencyBalances(0)

  const next = { ...balances }
  let remaining = amountToRemove
  for (const { code, valueCp } of currencyDenominations) {
    const spent = Math.min(next[code], Math.floor(remaining / valueCp))
    next[code] -= spent
    remaining -= spent * valueCp
  }
  if (remaining > 0) {
    const coinToBreak = currencyDenominations.find(({ code, valueCp }) => valueCp > remaining && next[code] > 0)
    if (!coinToBreak) return getCurrencyBalances(totalCp - amountToRemove)
    next[coinToBreak.code] -= 1
    const change = getCurrencyBalances(coinToBreak.valueCp - remaining)
    for (const { code } of currencyDenominations) next[code] += change[code]
  }
  return next
}

export function convertCurrency(balances: CurrencyBalances, source: CurrencyCode, target: CurrencyCode, amount: number): CurrencyBalances | null {
  if (source === target || !Number.isSafeInteger(amount) || amount < 1 || amount > balances[source]) return null

  const sourceValue = currencyDenominations.find(({ code }) => code === source)!.valueCp
  const targetValue = currencyDenominations.find(({ code }) => code === target)!.valueCp
  const ratio = Math.max(sourceValue, targetValue) / Math.min(sourceValue, targetValue)
  const sourceSpent = sourceValue > targetValue ? amount : Math.floor(amount / ratio) * ratio
  const targetReceived = sourceValue > targetValue ? amount * ratio : Math.floor(amount / ratio)
  if (targetReceived < 1 || !Number.isSafeInteger(balances[target] + targetReceived)) return null

  return {
    ...balances,
    [source]: balances[source] - sourceSpent,
    [target]: balances[target] + targetReceived,
  }
}

export function equipmentDetails(item: EquipmentItem) {
  if (item.armor) {
    const armor = item.armor
    return `CA ${armor.shield ? '+' : ''}${armor.ac}${armor.dexterity === 'full' ? ' + Des' : armor.dexterity === 'max2' ? ' + Des (máx. 2)' : ''}${armor.strength ? ` · For ${armor.strength}` : ''}${armor.stealthDisadvantage ? ' · Desvantagem em Furtividade' : ''}`
  }
  if (item.weapon) return `${item.weapon.damage} ${item.weapon.damageType} · ${item.properties.join(', ')}`
  if (item.category === 'magic') return [item.rarity, item.attunement ? `Requer sintonização${item.attunement === 'sim' ? '' : ` (${item.attunement})`}` : 'Sem sintonização', ...item.properties].filter(Boolean).join(' · ')
  return item.properties.join(', ') || item.unit
}
