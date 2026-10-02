import { cantripsByClass, getRitualSpellOptions } from './spellCatalog'

export const pactTomeCantripCount = 3

export function normalizePactTomeCantripName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export type WarlockInvocationSpellGrant = {
  invocationId: string
  spellName: string
  level: number
  casting: 'at-will' | 'pact-slot-once-per-long-rest'
}

const warlockInvocationSpellGrants: WarlockInvocationSpellGrant[] = [
  { invocationId: 'armadura-de-sombras', spellName: 'Armadura Arcana', level: 1, casting: 'at-will' },
  { invocationId: 'correntes-de-carceri', spellName: 'Imobilizar Monstro', level: 5, casting: 'at-will' },
  { invocationId: 'encharcar-a-mente', spellName: 'Lentidão', level: 3, casting: 'pact-slot-once-per-long-rest' },
  { invocationId: 'escultor-de-carne', spellName: 'Metamorfose', level: 4, casting: 'pact-slot-once-per-long-rest' },
  { invocationId: 'idioma-bestial', spellName: 'Falar com Animais', level: 1, casting: 'at-will' },
  { invocationId: 'lacaios-do-caos', spellName: 'Conjurar Elemental', level: 5, casting: 'pact-slot-once-per-long-rest' },
  { invocationId: 'larapio-dos-cinco-destinos', spellName: 'Perdição', level: 1, casting: 'pact-slot-once-per-long-rest' },
  { invocationId: 'mascara-das-muitas-faces', spellName: 'Disfarçar-se', level: 1, casting: 'at-will' },
  { invocationId: 'mestre-das-infindaveis-formas', spellName: 'Alterar-se', level: 2, casting: 'at-will' },
  { invocationId: 'palavra-terriver', spellName: 'Confusão', level: 4, casting: 'pact-slot-once-per-long-rest' },
  { invocationId: 'passo-ascendente', spellName: 'Levitação', level: 2, casting: 'at-will' },
  { invocationId: 'salto-transcendental', spellName: 'Salto', level: 1, casting: 'at-will' },
  { invocationId: 'sinal-de-mau-agouro', spellName: 'Rogar Maldição', level: 3, casting: 'pact-slot-once-per-long-rest' },
  { invocationId: 'sussurros-da-sepultura', spellName: 'Falar com os Mortos', level: 3, casting: 'at-will' },
  { invocationId: 'sussurros-sedutores', spellName: 'Compulsão', level: 4, casting: 'pact-slot-once-per-long-rest' },
  { invocationId: 'vigor-abissal', spellName: 'Vida Falsa', level: 1, casting: 'at-will' },
  { invocationId: 'visao-mistica', spellName: 'Detectar Magia', level: 1, casting: 'at-will' },
  { invocationId: 'visoes-de-reinos-distantes', spellName: 'Olho Arcano', level: 4, casting: 'at-will' },
  { invocationId: 'visoes-nas-brumas', spellName: 'Imagem Silenciosa', level: 1, casting: 'at-will' },
]

export function getWarlockInvocationSpellGrants(selectedInvocationIds: string[]) {
  const selected = new Set(selectedInvocationIds)
  return warlockInvocationSpellGrants.filter(({ invocationId }) => selected.has(invocationId))
}

export function warlockPactChoiceKey(classId: string, subclassId: string) {
  return `${classId}:${subclassId}:3:Dádiva do Pacto:dadiva-do-pacto`
}

export function hasWarlockPact(classId: string, subclassId: string, choices: Record<string, string[]>, pactId: string, choiceClassId = classId) {
  return classId === 'bruxo' && choices[warlockPactChoiceKey(choiceClassId, subclassId)]?.includes(pactId) === true
}

export function warlockTomeCantripChoiceKey(classId: string, subclassId: string) {
  return `${warlockPactChoiceKey(classId, subclassId)}:truques-do-tomo`
}

export function getPactTomeCantrips(classId: string, subclassId: string, choices: Record<string, string[]>, choiceClassId = classId) {
  if (!hasWarlockPact(classId, subclassId, choices, 'pacto-do-tomo', choiceClassId)) return []
  return choices[warlockTomeCantripChoiceKey(choiceClassId, subclassId)] ?? []
}

export function ancientSecretsRitualChoiceKey(invocationChoiceKey: string) {
  return `${invocationChoiceKey}:rituais-do-livro`
}

export function isValidAncientSecretsRitualSelection(selection: string[]) {
  const available = new Set(getRitualSpellOptions(1).map(({ name }) => name))
  return selection.length === 2 && new Set(selection).size === 2 && selection.every((spell) => available.has(spell))
}

export function isValidPactTomeCantripSelection(selection: string[], knownCantrips: string[] = []) {
  const available = new Set(Object.values(cantripsByClass).flat())
  const known = new Set(knownCantrips.map(normalizePactTomeCantripName))
  return selection.length === pactTomeCantripCount
    && new Set(selection).size === selection.length
    && selection.every((cantrip) => available.has(cantrip) && !known.has(normalizePactTomeCantripName(cantrip)))
}
