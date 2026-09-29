import type { CharacterDetails } from './characterData'
import { findEquipment, normalizeEquipment, type EquipmentCatalog, type EquipmentGrant, type EquipmentItem, type Inventory, type ItemQuantity } from './equipment'

export type EquipmentContext = {
  className: string
  backgroundName: string
  backgroundEquipment: string[]
  character: Pick<CharacterDetails, 'characterClassId' | 'classSubclassId' | 'classFeatureChoices' | 'level' | 'primalPath' | 'primalTotemChoices' | 'raceId' | 'racialChoice'>
  proficientWithWarhammer: boolean
  proficientWithHeavyArmor: boolean
}
type ItemPick = { id: string; label: string; itemIds: string[] }
type Option = { id: string; label: string; items: ItemQuantity[]; picks: ItemPick[] }
export type EquipmentChoice = { key: string; label: string; options: Option[] }
export type StartingEquipmentPlan = { grants: EquipmentGrant[]; choices: EquipmentChoice[]; missing: string[] }

// 2014 class alternatives, cross-checked against 5e-bits/5e-database src/2014/en/5e-SRD-Classes.json.
// Quantity uses the catalog's listed unit: one "Flechas (20)" is one bundle, not 20 bundles.
export function startingEquipmentPlan(catalog: EquipmentCatalog, context: EquipmentContext, inventory: Inventory): StartingEquipmentPlan {
  const grants: EquipmentGrant[] = []
  const choices: EquipmentChoice[] = []
  const missing: string[] = []
  const klass = normalizeEquipment(context.className)
  const item = (itemId: string, quantity = 1): ItemQuantity => ({ itemId, quantity })
  const pack = (id: string) => catalog.packs.find(pack => pack.id === id)?.items ?? []
  const fixed = (key: string, label: string, items: ItemQuantity[], currencyCp = 0) => grants.push({ key, label, items, currencyCp })
  const option = (id: string, label: string, items: ItemQuantity[] = [], picks: ItemPick[] = []): Option => ({ id, label, items, picks })
  const pick = (id: string, label: string, filter: (item: EquipmentItem) => boolean): ItemPick => ({ id, label, itemIds: catalog.items.filter(filter).map(item => item.id) })
  const simple = (entry: EquipmentItem) => entry.category === 'weapons' && entry.subcategory.includes('simples')
  const simpleMelee = (entry: EquipmentItem) => simple(entry) && entry.subcategory.includes('corpo a corpo')
  const martial = (entry: EquipmentItem) => entry.category === 'weapons' && entry.subcategory.includes('marcial')
  const instrument = (entry: EquipmentItem) => entry.category === 'instruments'
  const specific = (...ids: string[]) => ids.map(id => option(id, catalog.items.find(item => item.id === id)?.name ?? id, [item(id)]))
  const flexible = (id: string, label: string, filter: (item: EquipmentItem) => boolean, count = 1, extra: ItemQuantity[] = []) =>
    option(id, label, extra, Array.from({ length: count }, (_, i) => pick(String(i), `${label}${count > 1 ? ` (${i + 1})` : ''}`, filter)))
  const choice = (id: string, label: string, options: Option[], source = `class:${klass}`) => choices.push({ key: `${source}:${id}`, label, options })
  const packs = (...ids: string[]) => choice('pack', 'Pacote inicial', ids.map(id => option(id, catalog.packs.find(pack => pack.id === id)?.name ?? id, pack(id))))
  const arcane = () => choice('focus', 'Componentes de conjuração', [
    ...specific('bolsa-de-componentes'), flexible('arcane-focus', 'Foco arcano', entry => entry.subcategory === 'Foco arcano'),
  ])
  const holy = () => choice('holy-symbol', 'Símbolo sagrado', [flexible('holy-symbol', 'Símbolo sagrado', entry => entry.subcategory === 'Símbolo sagrado')])
  const crossbow = () => option('crossbow', 'Besta leve e 20 virotes', [item('besta-leve'), item('virotes')])
  const martialChoice = () => choice('weapons', 'Armas principais', [
    flexible('shield', 'Arma marcial e escudo', martial, 1, [item('escudo')]), flexible('two', 'Duas armas marciais', martial, 2),
  ])
  const classFixed = (items: ItemQuantity[]) => fixed(`class:${klass}:fixed`, `Classe: ${context.className}`, items)
  switch (klass) {
    case 'barbaro':
      classFixed([...pack('explorer'), item('azagaia', 4)])
      choice('weapon', 'Arma principal', [...specific('machado-grande'), flexible('martial-melee', 'Arma marcial corpo a corpo', entry => martial(entry) && entry.subcategory.includes('corpo a corpo'))])
      choice('secondary', 'Armas adicionais', [option('hatchets', 'Duas machadinhas', [item('machadinha', 2)]), flexible('simple', 'Arma simples', simple)])
      break
    case 'bardo':
      classFixed([item('couro'), item('adaga')])
      choice('weapon', 'Arma principal', [...specific('rapieira', 'espada-longa'), flexible('simple', 'Arma simples', simple)])
      packs('diplomat', 'artist')
      choice('instrument', 'Instrumento musical', [flexible('instrument', 'Instrumento musical', instrument)])
      break
    case 'clerigo':
      classFixed([item('escudo')])
      choice('weapon', 'Arma principal', specific('maca', ...(context.proficientWithWarhammer ? ['martelo-de-guerra'] : [])))
      choice('armor', 'Armadura', specific('brunea', 'couro', ...(context.proficientWithHeavyArmor ? ['cota-de-malha'] : [])))
      choice('secondary', 'Arma adicional', [crossbow(), flexible('simple', 'Arma simples', simple)])
      packs('priest', 'explorer')
      holy()
      break
    case 'druida':
      classFixed([item('couro'), ...pack('explorer')])
      choice('shield', 'Escudo ou arma', [option('shield', 'Escudo de madeira', [item('escudo')]), flexible('simple', 'Arma simples', simple)])
      choice('weapon', 'Arma principal', [...specific('cimitarra'), flexible('simple-melee', 'Arma simples corpo a corpo', simpleMelee)])
      choice('focus', 'Foco druídico', [flexible('druidic', 'Foco druídico', entry => entry.subcategory === 'Foco druídico')])
      break
    case 'feiticeiro':
    case 'bruxo':
      classFixed([item('adaga', 2), ...(klass === 'bruxo' ? [item('couro')] : [])])
      choice('weapon', 'Arma principal', [crossbow(), flexible('simple', 'Arma simples', simple)])
      arcane()
      packs(...(klass === 'bruxo' ? ['scholar', 'dungeoneer'] : ['dungeoneer', 'explorer']))
      if (klass === 'bruxo') choice('additional', 'Arma simples adicional', [flexible('simple', 'Arma simples', simple)])
      break
    case 'guerreiro':
      choice('armor', 'Armadura', [option('chain', 'Cota de malha', [item('cota-de-malha')]), option('leather-bow', 'Couro, arco longo e 20 flechas', [item('couro'), item('arco-longo'), item('flechas')])])
      martialChoice()
      choice('secondary', 'Armas adicionais', [crossbow(), option('hatchets', 'Duas machadinhas', [item('machadinha', 2)])])
      packs('dungeoneer', 'explorer')
      break
    case 'ladino':
      classFixed([item('couro'), item('adaga', 2), item('ferramentas-de-ladrao')])
      choice('weapon', 'Arma principal', specific('rapieira', 'espada-curta'))
      choice('secondary', 'Arma adicional', [option('bow', 'Arco curto, aljava e 20 flechas', [item('arco-curto'), item('aljava'), item('flechas')]), ...specific('espada-curta')])
      packs('burglar', 'dungeoneer', 'explorer')
      break
    case 'mago':
      classFixed([item('grimorio')])
      choice('weapon', 'Arma principal', specific('bordao', 'adaga'))
      arcane()
      packs('scholar', 'explorer')
      break
    case 'monge':
      classFixed([item('dardo', 10)])
      choice('weapon', 'Arma principal', [...specific('espada-curta'), flexible('simple', 'Arma simples', simple)])
      packs('dungeoneer', 'explorer')
      break
    case 'paladino':
      classFixed([item('cota-de-malha')])
      martialChoice()
      choice('secondary', 'Armas adicionais', [option('javelins', 'Cinco azagaias', [item('azagaia', 5)]), flexible('simple-melee', 'Arma simples corpo a corpo', simpleMelee)])
      packs('priest', 'explorer')
      holy()
      break
    case 'patrulheiro':
      classFixed([item('arco-longo'), item('aljava'), item('flechas')])
      choice('armor', 'Armadura', specific('brunea', 'couro'))
      choice('weapons', 'Armas corpo a corpo', [option('shortswords', 'Duas espadas curtas', [item('espada-curta', 2)]), flexible('simple-melee', 'Duas armas simples corpo a corpo', simpleMelee, 2)])
      packs('dungeoneer', 'explorer')
      break
  }

  const background = normalizeEquipment(context.backgroundName)
  for (const [index, text] of context.backgroundEquipment.entries()) {
    const key = `background:${background}:${index}`
    const label = `Antecedente: ${context.backgroundName}`
    const purse = text.match(/^Bolsa com (\d+) po$/)
    if (purse) { fixed(key, label, [item('algibeira')], Number(purse[1]) * 100); continue }
    if (text === 'Mula e carroça no lugar das ferramentas de artesão') {
      fixed(key, label, [item('mula'), item('carroca')])
      continue
    }
    if (text === 'Livro de preces ou conta de orações') {
      choice(String(index), 'Objeto de devoção', specific('livro-de-preces', 'contas-de-oracoes'), `background:${background}`)
      continue
    }
    if (text === 'Símbolo sagrado') {
      choice(String(index), text, [flexible('holy', text, entry => entry.subcategory === 'Símbolo sagrado')], `background:${background}`)
      continue
    }
    if (text.includes('Conjunto de dados de osso ou baralho')) {
      choice(String(index), 'Jogo recebido do antecedente', specific('conjunto-de-dados', 'baralho-de-cartas'), `background:${background}`)
      continue
    }
    if (text.startsWith('Arma barata e incomum')) {
      choice(String(index), 'Arma do gladiador', specific('tridente', 'rede'), `background:${background}`)
      continue
    }
    const match = text.match(/^(\d+) (.+)$/)
    const name = match?.[2] ?? text
    const aliases: Record<string, string> = {
      'varetas de incenso': 'vareta-de-incenso', 'Vestimentas': 'robes',
      'Malagueta (clava)': 'porrete', 'Traje de artista': 'roupas-de-entretenimento',
      'Roupas comuns escuras com capuz': 'roupas-comuns', 'Tinta escura': 'tinta-frasco-de-30ml', 'Pena': 'caneta-tinteiro',
      'Estandarte ou outro símbolo de uma casa nobre': 'estandarte-de-casa-nobre',
      'Carta de um colega falecido com uma pergunta ainda sem resposta': 'carta-de-colega-falecido',
      'Fetiche de um inimigo caído': 'fetiche-de-inimigo-caido',
    }
    const found = findEquipment(catalog, aliases[name] ?? name)
    if (found) fixed(key, label, [item(found.id, Number(match?.[1] ?? 1))])
    else grants.push({ key, label, items: [], unlistedItems: [{ name, quantity: Number(match?.[1] ?? 1) }] })
  }

  if (klass === 'bruxo' && context.character.level >= 3) {
    const key = `${context.character.characterClassId}:${context.character.classSubclassId}:3:Dádiva do Pacto:dadiva-do-pacto`
    if (context.character.classFeatureChoices[key]?.includes('pacto-do-tomo')) fixed('feature:book-of-shadows', 'Dádiva do Pacto: Pacto do Tomo', [item('livro-das-sombras')])
  }
  if (klass === 'barbaro' && context.character.level >= 3 && context.character.primalPath === 'totem-warrior' && context.character.primalTotemChoices.spiritualTotem) {
    fixed('feature:spiritual-totem', 'Totem Espiritual', [item('totem-espiritual')])
  }
  // Proficiency and the ability to craft/conjure an item do not themselves grant ownership.
  for (const group of choices) {
    const selected = group.options.length === 1 ? group.options[0] : group.options.find(option => option.id === inventory.choices[group.key])
    if (!selected) { missing.push(group.label); continue }
    const items = [...selected.items]
    let complete = true
    for (const selection of selected.picks) {
      const selectedId = inventory.choices[`${group.key}/${selected.id}/${selection.id}`]
      if (!selection.itemIds.includes(selectedId)) { missing.push(selection.label); complete = false }
      else items.push(item(selectedId))
    }
    if (complete) fixed(group.key, group.key.startsWith('class:') ? `Classe: ${context.className} · ${group.label}` : `Antecedente: ${context.backgroundName} · ${group.label}`, items)
  }
  return { grants, choices, missing }
}
