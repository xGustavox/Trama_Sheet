import spellDetailsData from './spell-details.json'

export type SpellDetails = {
  name: string
  castingTime: string
  range: string
  components: string
  duration: string
}

const normalizeSpellName = (name: string) => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]/g, '')

const spellDetailsByName = new Map(
  (spellDetailsData as SpellDetails[]).map((spell) => [normalizeSpellName(spell.name), spell]),
)

// Keep names already used by saved characters while resolving them to the PDF catalog.
const spellNameAliases: Record<string, string> = {
  enfraquecerointelecto: 'enfraquecer intelecto',
  semipleno: 'semiplano',
  infringirferimentos: 'infligir ferimentos',
  guardioesespirituais: 'espiritos guardioes',
  banquetedosherois: 'banquetedeherois',
  vidafalsa: 'vitalidadefalsa',
  construir: 'fabricar',
  dominarcriatura: 'dominar monstro',
}

export const allSpellDetails = spellDetailsData as SpellDetails[]

export function getSpellDetails(name: string): SpellDetails | undefined {
  const normalizedName = normalizeSpellName(name)
  const alias = spellNameAliases[normalizedName]
  return spellDetailsByName.get(alias ? normalizeSpellName(alias) : normalizedName)
}
