export type FeatureOption = {
  id: string
  name: string
  description: string
  level?: number
  pact?: string
}

export type FeatureChoice = {
  id: string
  name: string
  choose: number
  options: FeatureOption[]
}

export type ClassFeature = {
  level: number
  name: string
  description: string
  choices?: FeatureChoice[]
}

export function rebaseClassFeatureChoicesForSubclass(
  choices: Record<string, string[]>,
  classId: string,
  previousSubclassId: string,
  nextSubclassId: string,
  classFeatureList: ClassFeature[],
) {
  if (previousSubclassId === nextSubclassId) return choices

  const previousPrefix = `${classId}:${previousSubclassId}:`
  const nextPrefix = `${classId}:${nextSubclassId}:`
  const rebased = Object.fromEntries(Object.entries(choices).filter(([key]) =>
    !key.startsWith(previousPrefix) && !key.startsWith(nextPrefix),
  ))

  for (const feature of classFeatureList) {
    for (const choice of feature.choices ?? []) {
      const suffix = `${feature.level}:${feature.name}:${choice.id}`
      const selected = choices[`${previousPrefix}${suffix}`]
      if (selected?.length) rebased[`${nextPrefix}${suffix}`] = selected
    }
  }

  return rebased
}

export type ClassSubclass = {
  id: string
  name: string
  selectionLevel: number
  features: ClassFeature[]
}

export type ClassFeatureData = {
  features: ClassFeature[]
  subclasses: ClassSubclass[]
}

const asi = (level: number): ClassFeature => ({
  level,
  name: 'Incremento no Valor de Habilidade',
  description: 'Aumente um valor de habilidade em 2, ou dois valores em 1, até o máximo de 20; se permitido, escolha um talento em vez disso.',
})

const option = (id: string, name: string, description: string, level?: number): FeatureOption => ({ id, name, description, level })

const battleManeuvers = [
  option('aparar', 'Aparar', 'Quando outra criatura causar dano a você com um ataque corpo a corpo, use sua reação e gaste um dado de superioridade para reduzir o dano em uma rolagem do dado + seu modificador de Destreza.'),
  option('ameacador', 'Ataque Ameaçador', 'Ao atingir uma criatura com um ataque com arma, gaste um dado de superioridade, some-o ao dano e force um teste de resistência de Sabedoria. Em caso de falha, o alvo fica amedrontado até o fim do seu próximo turno.'),
  option('encontrao', 'Ataque de Encontrão', 'Ao atingir uma criatura com um ataque com arma, gaste um dado de superioridade, some-o ao dano e force um teste de resistência de Força. Uma criatura Grande ou menor que falhar é empurrada até 4,5 m para longe de você.'),
  option('finta', 'Ataque de Finta', 'Como ação bônus, gaste um dado de superioridade para ganhar vantagem no próximo ataque contra uma criatura a até 1,5 m de você neste turno. Se atingir, some o dado ao dano.'),
  option('manobra', 'Ataque de Manobra', 'Ao atingir uma criatura com um ataque com arma, gaste um dado de superioridade e some-o ao dano. Escolha uma criatura aliada que possa vê-lo ou ouvi-lo: ela pode usar a reação para mover até metade do deslocamento sem provocar ataque de oportunidade do alvo.'),
  option('precisao', 'Ataque de Precisão', 'Quando fizer uma jogada de ataque com arma contra uma criatura, gaste um dado de superioridade e some-o à jogada. Você pode decidir depois de rolar o d20, mas antes de os efeitos do ataque serem aplicados.'),
  option('desarmante', 'Ataque Desarmante', 'Ao atingir uma criatura com um ataque com arma, gaste um dado de superioridade, some-o ao dano e force um teste de resistência de Força. Em caso de falha, uma criatura Grande ou menor derruba no chão um objeto que esteja segurando, à sua escolha.'),
  option('estendido', 'Ataque Estendido', 'Ao fazer um ataque corpo a corpo no seu turno, gaste um dado de superioridade para aumentar seu alcance naquele ataque em 1,5 m. Se atingir, some o dado ao dano.'),
  option('provocante', 'Ataque Provocante', 'Ao atingir uma criatura com um ataque com arma, gaste um dado de superioridade, some-o ao dano e force um teste de resistência de Sabedoria. Em caso de falha, o alvo tem desvantagem nas jogadas de ataque contra criaturas que não sejam você até o fim do seu próximo turno.'),
  option('trespassante', 'Ataque Trespassante', 'Ao atingir uma criatura com um ataque corpo a corpo com arma, gaste um dado de superioridade para causar dano a outra criatura a até 1,5 m do alvo e dentro do seu alcance. Se a jogada original também atingiria essa criatura, ela sofre dano igual ao resultado do dado de superioridade.'),
  option('contra-atacar', 'Contra-Atacar', 'Quando uma criatura errar um ataque corpo a corpo contra você, use sua reação e gaste um dado de superioridade para fazer um ataque corpo a corpo contra ela. Se atingir, some o dado ao dano.'),
  option('distrativo', 'Golpe Distrativo', 'Ao atingir uma criatura com um ataque com arma, gaste um dado de superioridade e some-o ao dano. A próxima jogada de ataque contra o alvo feita por uma criatura que não seja você tem vantagem, se ocorrer antes do início do seu próximo turno.'),
  option('comandante', 'Golpe do Comandante', 'Ao realizar a ação Atacar no seu turno, abra mão de um ataque e use uma ação bônus para direcionar um aliado que possa vê-lo ou ouvi-lo. Ele pode usar a reação para fazer um ataque com arma e, se atingir, soma o dado de superioridade gasto ao dano.'),
  option('inspirar', 'Inspirar', 'Como ação bônus, escolha uma criatura aliada que possa vê-lo ou ouvi-lo e gaste um dado de superioridade. Ela recebe pontos de vida temporários iguais ao resultado do dado + seu modificador de Carisma.'),
  option('passo-evasivo', 'Passo Evasivo', 'Quando se mover no seu turno, gaste um dado de superioridade e some o resultado à sua CA até parar de se mover.'),
  option('rasteira', 'Rasteira', 'Ao atingir uma criatura com um ataque com arma, gaste um dado de superioridade, some-o ao dano e force um teste de resistência de Força. Em caso de falha, uma criatura Grande ou menor fica caída.'),
]

const artisanToolOptions = [
  'Suprimentos de alquimista', 'Suprimentos de cervejeiro', 'Ferramentas de calígrafo', 'Ferramentas de carpinteiro',
  'Ferramentas de cartógrafo', 'Ferramentas de sapateiro', 'Utensílios de cozinheiro', 'Ferramentas de vidreiro',
  'Ferramentas de joalheiro', 'Ferramentas de couro', 'Ferramentas de pedreiro', 'Materiais de pintor',
  'Suprimentos de oleiro', 'Ferramentas de ferreiro', 'Ferramentas de funileiro', 'Ferramentas de tecelão',
  'Ferramentas de entalhador',
].map((name) => option(name, name, `Proficiência com ${name.toLocaleLowerCase('pt-BR')}.`))

export const eldritchKnightSpellProgression: [cantrips: number, spellsKnown: number, slots: number[]][] = [
  [2, 3, [2]], [2, 4, [3]], [2, 4, [3]], [2, 4, [3]], [2, 5, [4, 2]], [2, 6, [4, 2]],
  [2, 6, [4, 2]], [3, 7, [4, 3]], [3, 8, [4, 3]], [3, 8, [4, 3]], [3, 9, [4, 3, 2]],
  [3, 10, [4, 3, 2]], [3, 10, [4, 3, 2]], [3, 11, [4, 3, 3]], [3, 11, [4, 3, 3]],
  [3, 11, [4, 3, 3]], [3, 12, [4, 3, 3, 1]], [3, 13, [4, 3, 3, 1]],
]

export const arcaneTricksterSpellProgression: [cantrips: number, spellsKnown: number, slots: number[]][] = [
  [3, 3, [2]], [3, 4, [3]], [3, 4, [3]], [3, 4, [3]], [3, 5, [4, 2]], [3, 6, [4, 2]],
  [3, 6, [4, 2]], [4, 7, [4, 3]], [4, 8, [4, 3]], [4, 8, [4, 3]], [4, 9, [4, 3, 2]],
  [4, 10, [4, 3, 2]], [4, 10, [4, 3, 2]], [4, 11, [4, 3, 3]], [4, 11, [4, 3, 3]],
  [4, 11, [4, 3, 3]], [4, 12, [4, 3, 3, 1]], [4, 13, [4, 3, 3, 1]],
]

export const rogueSneakAttackProgression = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]

export const monkProgression: [martialArtsDie: string, kiPoints: number | null, unarmoredMovement: string | null][] = [
  ['1d4', null, null], ['1d4', 2, '+3 m'], ['1d4', 3, '+3 m'], ['1d4', 4, '+3 m'], ['1d4', 5, '+3 m'],
  ['1d6', 6, '+4,5 m'], ['1d6', 7, '+4,5 m'], ['1d6', 8, '+4,5 m'], ['1d6', 9, '+4,5 m'], ['1d6', 10, '+6 m'],
  ['1d8', 11, '+6 m'], ['1d8', 12, '+6 m'], ['1d8', 13, '+6 m'], ['1d8', 14, '+7,5 m'], ['1d8', 15, '+7,5 m'],
  ['1d8', 16, '+7,5 m'], ['1d10', 17, '+7,5 m'], ['1d10', 18, '+9 m'], ['1d10', 19, '+9 m'], ['1d10', 20, '+9 m'],
]

export const paladinSpellProgression: number[][] = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
]

export const rangerSpellProgression: [spellsKnown: number, slots: number[]][] = [
  [0, []], [2, [2]], [3, [3]], [3, [3]], [4, [4, 2]], [4, [4, 2]], [5, [4, 3]], [5, [4, 3]], [6, [4, 3, 2]], [6, [4, 3, 2]],
  [7, [4, 3, 3]], [7, [4, 3, 3]], [8, [4, 3, 3, 1]], [8, [4, 3, 3, 1]], [9, [4, 3, 3, 2]], [9, [4, 3, 3, 2]],
  [10, [4, 3, 3, 3, 1]], [10, [4, 3, 3, 3, 1]], [11, [4, 3, 3, 3, 2]], [11, [4, 3, 3, 3, 2]],
]

export const wizardSpellProgression: [cantrips: number, slots: number[]][] = [
  [3, [2]], [3, [3]], [3, [4, 2]], [4, [4, 3]], [4, [4, 3, 2]],
  [4, [4, 3, 3]], [4, [4, 3, 3, 1]], [4, [4, 3, 3, 2]], [4, [4, 3, 3, 3, 1]], [5, [4, 3, 3, 3, 2]],
  [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1]],
  [5, [4, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
]

const fighterStyles = [
  option('arquearia', 'Arquearia', 'Você ganha +2 de bônus nas jogadas de ataque realizadas com uma arma de ataque à distância.'),
  option('armas-grandes', 'Combate com Armas Grandes', 'Quando rolar 1 ou 2 em um dado de dano de uma arma corpo a corpo empunhada com as duas mãos, você pode rolar esse dado novamente e deve usar o novo resultado, mesmo que seja 1 ou 2. A arma precisa ter a propriedade duas mãos ou versátil.'),
  option('duas-armas', 'Combate com Duas Armas', 'Ao lutar com duas armas, você pode adicionar seu modificador de habilidade ao dano do segundo ataque.'),
  option('defesa', 'Defesa', 'Enquanto estiver usando armadura, você ganha +1 de bônus em sua CA.'),
  option('duelismo', 'Duelismo', 'Enquanto empunhar uma arma corpo a corpo em uma mão e nenhuma outra arma, você ganha +2 nas jogadas de dano com essa arma. Pode usar um escudo.'),
  option('protecao', 'Proteção', 'Quando uma criatura que você possa ver atacar um alvo que não seja você, a até 1,5 m de você, use sua reação para impor desvantagem à jogada de ataque. Você deve estar empunhando um escudo.'),
]

const paladinStyles = fighterStyles.filter((style) => style.id !== 'arquearia' && style.id !== 'duas-armas')
const rangerStyles = fighterStyles.filter((style) => style.id !== 'armas-grandes' && style.id !== 'protecao')

const elementalDisciplines = [
  option('chicote', 'Chicote de Água', '2+ chi: 3d10, derrube ou puxe 7,5 m; +1d10 por chi extra.'),
  option('varredura', 'Golpe de Varredura Cauterizante', '2 chi: mãos flamejantes.'),
  option('ventania', 'Investida dos Espíritos da Ventania', '2 chi: lufada de vento.'),
  option('rio', 'Moldar o Rio Corrente', '1 chi: molde água e gelo sem ferir.'),
  option('serpente', 'Presas da Serpente de Fogo', '1 chi: +3 m de alcance e dano de fogo; chi extra soma 1d10.'),
  option('ar', 'Punho do Ar Contínuo', '2+ chi: 3d10, empurre 6 m e derrube; +1d10 por chi extra.'),
  option('trovoes', 'Punho dos Quatro Trovões', '2 chi: onda trovejante.'),
  option('gongo', 'Gongo do Pico', '3 chi: despedaçar.', 6),
  option('vento-norte', 'Serragem do Vento do Norte', '3 chi: imobilizar pessoa.', 6),
  option('cavalgar', 'Cavalgar o Vento', '4 chi: voo em si.', 11),
  option('fenix', 'Chamas da Fênix', '4 chi: bola de fogo.', 11),
  option('neblina', 'Postura da Neblina', '4 chi: forma gasosa em si.', 11),
  option('montanha', 'Defesa Eterna da Montanha', '5 chi: pele de pedra em si.', 17),
  option('pedras', 'Onda de Pedras Rolantes', '6 chi: muralha de pedra.', 17),
  option('chamas', 'Rio de Chamas Famintas', '5 chi: muralha de fogo.', 17),
  option('inverno', 'Sopro do Inverno', '6 chi: cone de frio.', 17),
]

const bardSkills = ['Acrobacia', 'Adestrar Animais', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade', 'História', 'Intimidação', 'Intuição', 'Investigação', 'Medicina', 'Natureza', 'Percepção', 'Persuasão', 'Prestidigitação', 'Religião', 'Sobrevivência']
const bardSkillOptions = bardSkills.map((skill) => option(skill, skill, `Proficiência em ${skill}.`))
const rogueExpertiseOptions = [
  ...bardSkillOptions,
  option('thieves-tools', 'Ferramentas de ladrão', 'Especialização com ferramentas de ladrão.'),
]
const clericKnowledgeSkills = ['Arcanismo', 'História', 'Natureza', 'Religião'].map((skill) => option(skill, skill, `Proficiência e Aptidão em ${skill}.`))
const clericLanguageOptions = ['Abissal', 'Anão', 'Celestial', 'Comum', 'Dialeto Subterrâneo', 'Dracônico', 'Élfico', 'Gigante', 'Gnômico', 'Goblin', 'Halfling', 'Infernal', 'Orc', 'Primordial', 'Silvestre', 'Subcomum'].map((language) => option(language, language, `Aprende o idioma ${language}.`))

export const bardSpellProgression: [cantrips: number, spellsKnown: number, slots: number[]][] = [
  [2, 4, [2]], [2, 5, [3]], [2, 6, [4, 2]], [3, 7, [4, 3]], [3, 8, [4, 3, 2]],
  [3, 9, [4, 3, 3]], [3, 10, [4, 3, 3, 1]], [3, 11, [4, 3, 3, 2]], [3, 12, [4, 3, 3, 3, 1]], [4, 13, [4, 3, 3, 3, 2]],
  [4, 14, [4, 3, 3, 3, 2, 1]], [4, 15, [4, 3, 3, 3, 2, 1]], [4, 16, [4, 3, 3, 3, 2, 1, 1]], [4, 17, [4, 3, 3, 3, 2, 1, 1]], [4, 18, [4, 3, 3, 3, 2, 1, 1, 1]],
  [4, 19, [4, 3, 3, 3, 2, 1, 1, 1]], [4, 20, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [4, 21, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [4, 22, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [4, 22, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
]

export const clericSpellProgression: [cantrips: number, slots: number[]][] = [
  [3, [2]], [3, [3]], [3, [4, 2]], [4, [4, 3]], [4, [4, 3, 2]],
  [4, [4, 3, 3]], [4, [4, 3, 3, 1]], [4, [4, 3, 3, 2]], [4, [4, 3, 3, 3, 1]], [5, [4, 3, 3, 3, 2]],
  [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1]],
  [5, [4, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [5, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
]

export const druidSpellProgression: [cantrips: number, slots: number[]][] = [
  [2, [2]], [2, [3]], [2, [4, 2]], [3, [4, 3]], [3, [4, 3, 2]],
  [3, [4, 3, 3]], [3, [4, 3, 3, 1]], [3, [4, 3, 3, 2]], [3, [4, 3, 3, 3, 1]], [4, [4, 3, 3, 3, 2]],
  [4, [4, 3, 3, 3, 2, 1]], [4, [4, 3, 3, 3, 2, 1]], [4, [4, 3, 3, 3, 2, 1, 1]], [4, [4, 3, 3, 3, 2, 1, 1]], [4, [4, 3, 3, 3, 2, 1, 1, 1]],
  [4, [4, 3, 3, 3, 2, 1, 1, 1]], [4, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [4, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [4, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [4, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
]

export const sorcererSpellProgression: [cantrips: number, spellsKnown: number, slots: number[]][] = [
  [4, 2, [2]], [4, 3, [3]], [4, 4, [4, 2]], [5, 5, [4, 3]], [5, 6, [4, 3, 2]],
  [5, 7, [4, 3, 3]], [5, 8, [4, 3, 3, 1]], [5, 9, [4, 3, 3, 2]], [5, 10, [4, 3, 3, 3, 1]], [6, 11, [4, 3, 3, 3, 2]],
  [6, 12, [4, 3, 3, 3, 2, 1]], [6, 12, [4, 3, 3, 3, 2, 1]], [6, 13, [4, 3, 3, 3, 2, 1, 1]], [6, 13, [4, 3, 3, 3, 2, 1, 1]], [6, 14, [4, 3, 3, 3, 2, 1, 1, 1]],
  [6, 14, [4, 3, 3, 3, 2, 1, 1, 1]], [6, 15, [4, 3, 3, 3, 2, 1, 1, 1, 1]], [6, 15, [4, 3, 3, 3, 3, 1, 1, 1, 1]], [6, 16, [4, 3, 3, 3, 3, 2, 1, 1, 1]], [6, 16, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
]

const bard: ClassFeatureData = {
  features: [
    { level: 1, name: 'Conjuração', description: 'Conjure magias de bardo conhecidas usando Carisma. CD para resistir às suas magias: 8 + bônus de proficiência + modificador de Carisma; ataque mágico: bônus de proficiência + modificador de Carisma. Pode conjurar como ritual uma magia de bardo conhecida que tenha essa propriedade e usar um instrumento musical como foco. Recupera os espaços após descanso longo.' },
    { level: 1, name: 'Inspiração de Bardo (d6)', description: 'Como ação bônus, escolha uma criatura que não seja você, a até 18 m e que possa ouvi-lo. Ela recebe um d6 de Inspiração de Bardo, que pode somar a um teste de habilidade, jogada de ataque ou teste de resistência nos próximos 10 minutos. Ela decide após rolar o d20, mas antes de saber o resultado. Uma criatura só pode ter um dado de Inspiração de Bardo por vez. Usos iguais ao modificador de Carisma (mínimo 1), recuperados após descanso longo.' },
    { level: 2, name: 'Versatilidade', description: 'Some metade do bônus de proficiência, arredondada para baixo, a testes de habilidade nos quais não tenha proficiência.' },
    { level: 2, name: 'Canção do Descanso (d6)', description: 'Durante um descanso curto, você e criaturas amigáveis que puderem ouvir sua apresentação recuperam 1d6 PV adicionais ao gastar Dados de Vida. O dado aumenta para d8 no 9º nível, d10 no 13º e d12 no 17º.' },
    { level: 3, name: 'Aptidão', description: 'Escolha duas perícias em que seja proficiente; seu bônus de proficiência é dobrado nelas. Escolha outras duas no 10º nível.', choices: [{ id: 'bard-expertise', name: 'Perícias com Aptidão', choose: 2, options: bardSkillOptions }] },
    { level: 3, name: 'Colégio de Bardo', description: 'Escolha o colégio que define as características de sua tradição nos níveis seguintes.' },
    asi(4),
    { level: 5, name: 'Inspiração de Bardo (d8)', description: 'O dado de Inspiração de Bardo torna-se d8.' },
    { level: 5, name: 'Fonte de Inspiração', description: 'Recupere todos os usos de Inspiração de Bardo ao terminar um descanso curto ou longo.' },
    { level: 6, name: 'Canção de Proteção', description: 'Use uma ação para iniciar uma atuação que dura até o fim do seu próximo turno. Você e criaturas amigáveis a até 9 m que possam ouvi-lo têm vantagem em testes de resistência contra serem amedrontadas ou enfeitiçadas. A atuação termina se você ficar incapacitado ou silenciado, ou se encerrá-la voluntariamente (sem ação).'},
    asi(8),
    { level: 9, name: 'Canção do Descanso (d8)', description: 'O dado da Canção do Descanso torna-se d8.' },
    { level: 10, name: 'Inspiração de Bardo (d10)', description: 'O dado de Inspiração de Bardo torna-se d10.' },
    { level: 10, name: 'Aptidão', description: 'Escolha mais duas perícias em que seja proficiente para dobrar o bônus de proficiência.', choices: [{ id: 'bard-expertise', name: 'Perícias com Aptidão', choose: 2, options: bardSkillOptions }] },
    { level: 10, name: 'Segredos Mágicos', description: 'Aprenda duas magias de qualquer classe, de nível que possa conjurar (ou truques). Elas contam como magias de bardo e estão incluídas no limite de magias conhecidas; repita no 14º e 18º níveis.' },
    asi(12),
    { level: 13, name: 'Canção do Descanso (d10)', description: 'O dado da Canção do Descanso torna-se d10.' },
    { level: 14, name: 'Segredos Mágicos', description: 'Aprenda mais duas magias de qualquer classe.' },
    { level: 15, name: 'Inspiração de Bardo (d12)', description: 'O dado de Inspiração de Bardo torna-se d12.' },
    asi(16),
    { level: 17, name: 'Canção do Descanso (d12)', description: 'O dado da Canção do Descanso torna-se d12.' },
    { level: 18, name: 'Segredos Mágicos', description: 'Aprenda mais duas magias de qualquer classe.' },
    asi(19),
    { level: 20, name: 'Inspiração Superior', description: 'Ao rolar iniciativa sem usos de Inspiração de Bardo, recupere um uso.' },
  ],
  subclasses: [
    { id: 'colegio-do-conhecimento', name: 'Colégio do Conhecimento', selectionLevel: 3, features: [
      { level: 3, name: 'Proficiência Adicional', description: 'Ganhe proficiência em três perícias à sua escolha.', choices: [{ id: 'lore-additional-skills', name: 'Perícias adicionais', choose: 3, options: bardSkillOptions }] },
      { level: 3, name: 'Palavras de Interrupção', description: 'Quando uma criatura que você possa ver a até 18 m fizer uma jogada de ataque, teste de habilidade ou rolagem de dano, use sua reação e gaste um uso de Inspiração de Bardo para subtrair o dado da rolagem. Decida após a rolagem, mas antes do Mestre determinar sucesso ou falha, ou antes de a criatura causar dano. A criatura precisa poder ouvi-lo e não pode ser imune a ser enfeitiçada.' },
      { level: 6, name: 'Segredos Mágicos Adicionais', description: 'Aprenda duas magias de qualquer classe; elas não contam no limite de magias conhecidas.' },
      { level: 14, name: 'Perícia Inigualável', description: 'Ao fazer um teste de habilidade, gaste Inspiração e some o dado após ver a rolagem, antes do resultado.' },
    ] },
    { id: 'colegio-da-bravura', name: 'Colégio da Bravura', selectionLevel: 3, features: [
      { level: 3, name: 'Proficiência Adicional', description: 'Ganhe proficiência em armaduras médias, escudos e armas marciais.' },
      { level: 3, name: 'Inspiração em Combate', description: 'Uma criatura com seu dado de Inspiração de Bardo pode somá-lo ao dano de um ataque com arma ou, ao ser atingida, usar sua reação para somá-lo à CA contra aquele ataque, depois de ver a rolagem e antes de saber se acertou.' },
      { level: 6, name: 'Ataque Extra', description: 'Ataque duas vezes ao realizar a ação Atacar.' },
      { level: 14, name: 'Magia de Batalha', description: 'Após conjurar uma magia de bardo com sua ação, faça um ataque com arma como ação bônus.' },
    ] },
  ],
}

export const warlockSpellProgression: [cantrips: number, spellsKnown: number, pactSlots: number, slotLevel: number, invocations: number][] = [
  [2, 2, 1, 1, 0], [2, 3, 2, 1, 2], [2, 4, 2, 2, 2], [3, 5, 2, 2, 3], [3, 6, 2, 3, 3],
  [3, 7, 2, 3, 4], [3, 8, 2, 4, 4], [3, 9, 2, 4, 4], [3, 10, 2, 5, 5], [4, 10, 2, 5, 5],
  [4, 11, 3, 5, 5], [4, 11, 3, 5, 6], [4, 12, 3, 5, 6], [4, 12, 3, 5, 6], [4, 13, 3, 5, 7],
  [4, 13, 3, 5, 7], [4, 14, 4, 5, 7], [4, 14, 4, 5, 8], [4, 15, 4, 5, 8], [4, 15, 4, 5, 8],
]

const warlockInvocation = (id: string, name: string, description: string, level?: number, pact?: string): FeatureOption => ({
  ...option(id, name, description, level),
  pact,
})

const warlockInvocations = [
  warlockInvocation('armadura-de-sombras', 'Armadura de Sombras', 'Conjure armadura arcana em si mesmo à vontade, sem gastar espaço ou componentes materiais.'),
  warlockInvocation('correntes-de-carceri', 'Correntes de Cárceri', 'Pré-requisito: 15º nível e Pacto da Corrente. Conjure imobilizar monstro à vontade contra celestiais, corruptores ou elementais, sem espaço ou componentes; contra cada criatura, uma vez por descanso longo.', 15, 'pacto-da-corrente'),
  warlockInvocation('encharcar-a-mente', 'Encharcar a Mente', 'Pré-requisito: 5º nível. Conjure lentidão uma vez usando um espaço de Magia de Pacto; recupere o uso após descanso longo.', 5),
  warlockInvocation('escultor-de-carne', 'Escultor de Carne', 'Pré-requisito: 7º nível. Conjure metamorfose uma vez usando um espaço de Magia de Pacto; recupere o uso após descanso longo.', 7),
  warlockInvocation('explosao-agonizante', 'Explosão Agonizante', 'Pré-requisito: truque rajada mística. Ao atingir com rajada mística, some seu modificador de Carisma ao dano.'),
  warlockInvocation('explosao-repulsiva', 'Explosão Repulsiva', 'Pré-requisito: truque rajada mística. Ao atingir com rajada mística, pode empurrar a criatura até 3 m em linha reta.'),
  warlockInvocation('idioma-bestial', 'Idioma Bestial', 'Conjure falar com animais à vontade, sem gastar espaço.'),
  warlockInvocation('influencia-enganadora', 'Influência Enganadora', 'Ganhe proficiência nas perícias Enganação e Persuasão.'),
  warlockInvocation('lacaios-do-caos', 'Lacaios do Caos', 'Pré-requisito: 9º nível. Conjure conjurar elemental uma vez usando um espaço de Magia de Pacto; recupere o uso após descanso longo.', 9),
  warlockInvocation('lamina-sedenta', 'Lâmina Sedenta', 'Pré-requisito: 5º nível e Pacto da Lâmina. Ao realizar a ação Atacar com sua arma de pacto, ataque duas vezes.', 5, 'pacto-da-lamina'),
  warlockInvocation('lanca-mistica', 'Lança Mística', 'Pré-requisito: truque rajada mística. O alcance de rajada mística torna-se 90 m.'),
  warlockInvocation('larapio-dos-cinco-destinos', 'Larápio dos Cinco Destinos', 'Conjure perdição uma vez usando um espaço de Magia de Pacto; recupere o uso após descanso longo.'),
  warlockInvocation('livro-de-segredos-antigos', 'Livro de Segredos Antigos', 'Pré-requisito: Pacto do Tomo. Inscreva duas magias de 1º nível com a propriedade ritual, de quaisquer listas, no Livro das Sombras. Pode adicionar outras magias rituais encontradas, de nível até metade do seu nível de bruxo, arredondada para baixo.', undefined, 'pacto-do-tomo'),
  warlockInvocation('mascara-das-muitas-faces', 'Máscara das Muitas Faces', 'Conjure disfarçar-se à vontade, sem gastar espaço.'),
  warlockInvocation('mestre-das-infindaveis-formas', 'Mestre das Infindáveis Formas', 'Pré-requisito: 15º nível. Conjure alterar-se à vontade, sem gastar espaço ou componentes materiais.', 15),
  warlockInvocation('olhar-de-duas-mentes', 'Olhar de Duas Mentes', 'Use uma ação para tocar um humanoide voluntário e perceber pelos sentidos dele até o fim do seu próximo turno. Pode manter o efeito em turnos seguintes enquanto estiver no mesmo plano; durante isso, fica cego e surdo aos próprios sentidos.'),
  warlockInvocation('olhos-do-guardiao-das-runas', 'Olhos do Guardião das Runas', 'Leia todas as escritas.'),
  warlockInvocation('palavra-terriver', 'Palavra Terrível', 'Pré-requisito: 7º nível. Conjure confusão uma vez usando um espaço de Magia de Pacto; recupere o uso após descanso longo.', 7),
  warlockInvocation('passo-ascendente', 'Passo Ascendente', 'Pré-requisito: 9º nível. Conjure levitação em si mesmo à vontade, sem gastar espaço ou componentes materiais.', 9),
  warlockInvocation('salto-transcendental', 'Salto Transcendental', 'Pré-requisito: 9º nível. Conjure salto em si mesmo à vontade, sem gastar espaço ou componentes materiais.', 9),
  warlockInvocation('sinal-de-mau-agouro', 'Sinal de Mau Agouro', 'Pré-requisito: 5º nível. Conjure rogar maldição uma vez usando um espaço de Magia de Pacto; recupere o uso após descanso longo.', 5),
  warlockInvocation('sorvedor-de-vida', 'Sorvedor de Vida', 'Pré-requisito: 12º nível e Pacto da Lâmina. Ao atingir uma criatura com sua arma de pacto, cause dano necrótico adicional igual ao seu modificador de Carisma (mínimo 1).', 12, 'pacto-da-lamina'),
  warlockInvocation('sussurros-da-sepultura', 'Sussurros da Sepultura', 'Pré-requisito: 9º nível. Conjure falar com os mortos à vontade, sem gastar espaço.', 9),
  warlockInvocation('sussurros-sedutores', 'Sussurros Sedutores', 'Pré-requisito: 7º nível. Conjure compulsão uma vez usando um espaço de Magia de Pacto; recupere o uso após descanso longo.', 7),
  warlockInvocation('uno-com-as-sombras', 'Uno com as Sombras', 'Pré-requisito: 5º nível. Em penumbra ou escuridão, use uma ação para ficar invisível até se mover ou realizar uma ação ou reação.', 5),
  warlockInvocation('vigor-abissal', 'Vigor Abissal', 'Conjure vida falsa em si mesmo à vontade como magia de 1º nível, sem gastar espaço ou componentes materiais.'),
  warlockInvocation('visao-da-bruxa', 'Visão da Bruxa', 'Pré-requisito: 15º nível. Veja a forma verdadeira de metamorfos ou criaturas ocultas por ilusão ou transmutação a até 9 m e em linha de visão.', 15),
  warlockInvocation('visao-diabolica', 'Visão Diabólica', 'Veja normalmente na escuridão, tanto mágica quanto normal, a até 36 m.'),
  warlockInvocation('visao-mistica', 'Visão Mística', 'Conjure detectar magia à vontade, sem gastar espaço.'),
  warlockInvocation('visoes-de-reinos-distantes', 'Visões de Reinos Distantes', 'Pré-requisito: 15º nível. Conjure olho arcano à vontade, sem gastar espaço.', 15),
  warlockInvocation('visoes-nas-brumas', 'Visões nas Brumas', 'Conjure imagem silenciosa à vontade, sem gastar espaço ou componentes materiais.'),
  warlockInvocation('voz-do-mestre-das-correntes', 'Voz do Mestre das Correntes', 'Pré-requisito: Pacto da Corrente. Comunique-se telepaticamente com seu familiar e perceba pelos sentidos dele enquanto estiver no mesmo plano; ao usar os sentidos dele, pode falar pela criatura com sua própria voz.', undefined, 'pacto-da-corrente'),
]

export const warlockInvocationIsAvailable = (invocation: FeatureOption, selectedPact?: string) =>
  !invocation.pact || invocation.pact === selectedPact

const warlock: ClassFeatureData = {
  features: [
    { level: 1, name: 'Magia de Pacto', description: 'Aprenda truques e magias de bruxo e conjure usando Carisma: CD 8 + bônus de proficiência + modificador de Carisma; ataque mágico: bônus de proficiência + modificador de Carisma. Todos os espaços de Magia de Pacto têm o mesmo nível e são recuperados após descanso curto ou longo. Magias de nível inferior são conjuradas no nível do espaço gasto; ao subir de nível, pode substituir uma magia conhecida por outra de bruxo de nível que possa conjurar. Pode usar um foco arcano.' },
    { level: 1, name: 'Patrono Transcendental', description: 'Escolha Arquifada, Corruptor ou Grande Antigo. Seu patrono concede características nos níveis 1, 6, 10 e 14.' },
    { level: 2, name: 'Invocações Místicas', description: 'Aprenda duas invocações à sua escolha. Ao ganhar um nível de bruxo, pode substituir uma invocação conhecida por outra para a qual cumpra os pré-requisitos.', choices: [{ id: 'mystic-invocations', name: 'Invocações Místicas', choose: 2, options: warlockInvocations }] },
    { level: 3, name: 'Dádiva do Pacto', description: 'Escolha Pacto da Corrente, da Lâmina ou do Tomo.', choices: [{ id: 'dadiva-do-pacto', name: 'Dádiva do Pacto', choose: 1, options: [
      option('pacto-da-corrente', 'Pacto da Corrente', 'Aprenda convocar familiar e pode conjurá-la como ritual. Ao conjurá-la, pode escolher diabrete, pseudodragão, quasit ou sprite. Quando realiza a ação Atacar, pode renunciar a um de seus ataques para permitir que o familiar faça um ataque com a reação dele.'),
      option('pacto-da-lamina', 'Pacto da Lâmina', 'Com uma ação, crie em sua mão uma arma corpo a corpo de qualquer forma; você é proficiente com ela e ela conta como mágica para superar resistência e imunidade a ataques e dano não mágicos. Se ficar a mais de 1,5 m por 1 minuto, recriar a arma, dispensá-la ou morrer, ela desaparece. Também pode vincular uma arma mágica por ritual de 1 hora, inclusive durante descanso curto.'),
      option('pacto-do-tomo', 'Pacto do Tomo', 'Receba o Livro das Sombras com três truques à sua escolha de listas de quaisquer classes. Enquanto estiver com o livro, pode conjurá-los à vontade como magias de bruxo; não contam contra seus truques conhecidos. Se perder o livro, pode refazer a cerimônia em 1 hora durante descanso curto ou longo, destruindo o anterior; o livro vira cinzas quando você morre.'),
    ] }] },
    asi(4),
    { level: 4, name: 'Invocações Místicas', description: 'Aprenda uma invocação adicional.', choices: [{ id: 'mystic-invocations', name: 'Invocações Místicas', choose: 1, options: warlockInvocations }] },
    { level: 6, name: 'Invocações Místicas', description: 'Aprenda uma invocação adicional.', choices: [{ id: 'mystic-invocations', name: 'Invocações Místicas', choose: 1, options: warlockInvocations }] },
    asi(8),
    { level: 9, name: 'Invocações Místicas', description: 'Aprenda uma invocação adicional.', choices: [{ id: 'mystic-invocations', name: 'Invocações Místicas', choose: 1, options: warlockInvocations }] },
    { level: 12, name: 'Invocações Místicas', description: 'Aprenda uma invocação adicional.', choices: [{ id: 'mystic-invocations', name: 'Invocações Místicas', choose: 1, options: warlockInvocations }] },
    { level: 15, name: 'Invocações Místicas', description: 'Aprenda uma invocação adicional.', choices: [{ id: 'mystic-invocations', name: 'Invocações Místicas', choose: 1, options: warlockInvocations }] },
    { level: 18, name: 'Invocações Místicas', description: 'Aprenda uma invocação adicional.', choices: [{ id: 'mystic-invocations', name: 'Invocações Místicas', choose: 1, options: warlockInvocations }] },
    { level: 11, name: 'Arcana Mística (6º nível)', description: 'Escolha uma magia de bruxo de 6º nível; conjure-a uma vez sem espaço, recuperando o uso após descanso longo.' },
    asi(12),
    { level: 13, name: 'Arcana Mística (7º nível)', description: 'Escolha uma magia de bruxo de 7º nível para conjurar uma vez por descanso longo.' },
    { level: 15, name: 'Arcana Mística (8º nível)', description: 'Escolha uma magia de bruxo de 8º nível para conjurar uma vez por descanso longo.' },
    asi(16),
    { level: 17, name: 'Arcana Mística (9º nível)', description: 'Escolha uma magia de bruxo de 9º nível para conjurar uma vez por descanso longo.' },
    asi(19),
    { level: 20, name: 'Mestre Místico', description: 'Após 1 minuto suplicando ao patrono, recupere todos os espaços de Magia de Pacto; uma vez por descanso longo.' },
  ],
  subclasses: [
    { id: 'arquifada', name: 'Arquifada', selectionLevel: 1, features: [
      { level: 1, name: 'Lista de Magia Expandida', description: 'Adicione às opções: fogo das fadas e sono; acalmar emoções e força fantasmagórica; piscar e ampliar plantas; dominar besta e invisibilidade maior; dominar pessoa e similaridade.' },
      { level: 1, name: 'Presença Feérica', description: 'Com uma ação, cada criatura em um cubo de 3 m originado em você faz um teste de resistência de Sabedoria contra sua CD de magia. Em caso de falha, fica enfeitiçada ou amedrontada (à sua escolha) até o início do seu próximo turno. Recupere o uso após descanso curto ou longo.' },
      { level: 6, name: 'Névoa de Fuga', description: 'Ao sofrer dano, use sua reação para ficar invisível e teleportar até 18 m para um espaço desocupado que possa ver. A invisibilidade termina no início do próximo turno ou se atacar ou conjurar magia; recupera após descanso curto ou longo.' },
      { level: 10, name: 'Defesa Sedutora', description: 'Você não pode ser enfeitiçado. Quando outra criatura tenta enfeitiçá-lo, use sua reação para fazê-la realizar um teste de resistência de Sabedoria contra sua CD de magia; em caso de falha, ela fica enfeitiçada por 1 minuto ou até sofrer dano.' },
      { level: 14, name: 'Delírio Sombrio', description: 'Com uma ação, escolha uma criatura visível a até 18 m. Ela faz um teste de resistência de Sabedoria contra sua CD de magia; em caso de falha, fica enfeitiçada ou amedrontada (à sua escolha) por 1 minuto, enquanto você mantiver concentração. Ela acredita estar perdida em um reino enevoado e só pode ouvir a si mesma, você e a ilusão. Recupere o uso após descanso curto ou longo.' },
    ] },
    { id: 'o-corruptor', name: 'O Corruptor', selectionLevel: 1, features: [
      { level: 1, name: 'Lista de Magia Expandida', description: 'Adicione às opções: mãos flamejantes e comando; cegueira/surdez e raio ardente; bola de fogo e névoa fétida; escudo de fogo e muralha de fogo; coluna de chamas e consagrar.' },
      { level: 1, name: 'Bênção do Obscuro', description: 'Ao reduzir criatura hostil a 0 PV, ganhe PV temporários iguais ao nível de bruxo + Carisma (mínimo 1).' },
      { level: 6, name: 'Sorte do Próprio Obscuro', description: 'Quando fizer um teste de habilidade ou resistência, depois de ver a rolagem e antes de qualquer efeito, some 1d10 ao resultado. Recupera após descanso curto ou longo.' },
      { level: 10, name: 'Resistência Demoníaca', description: 'Após terminar um descanso curto ou longo, escolha um tipo de dano; você ganha resistência a esse tipo até escolher outro com esta característica. Dano de armas mágicas ou de armas de prata ignora essa resistência.' },
      { level: 14, name: 'Lançar no Inferno', description: 'Ao atingir uma criatura com um ataque, uma vez por descanso longo, faça-a desaparecer momentaneamente pelos planos inferiores. No fim do seu próximo turno, ela retorna ao espaço de onde partiu ou ao espaço desocupado mais próximo. Se não for um corruptor, sofre 10d10 de dano psíquico.' },
    ] },
    { id: 'o-grande-antigo', name: 'O Grande Antigo', selectionLevel: 1, features: [
      { level: 1, name: 'Lista de Magia Expandida', description: 'Adicione às opções: sussurros dissonantes e riso histérico de Tasha; detectar pensamentos e força fantasmagórica; clarividência e enviar mensagem; dominar besta e tentáculos negros de Evard; dominar pessoa e telecinésia.' },
      { level: 1, name: 'Despertar a Mente', description: 'Você pode se comunicar telepaticamente com qualquer criatura que possa ver a até 18 m, desde que ela compreenda ao menos um idioma. Não é necessário compartilhar um idioma.' },
      { level: 6, name: 'Proteção Entrópica', description: 'Quando uma criatura fizer uma jogada de ataque contra você, use sua reação para impor desvantagem. Se o ataque errar, você tem vantagem na próxima jogada de ataque contra essa criatura até o fim do seu próximo turno. Recupere o uso após descanso curto ou longo.' },
      { level: 10, name: 'Escudo de Pensamentos', description: 'Seus pensamentos não podem ser lidos sem sua permissão. Você tem resistência a dano psíquico e, sempre que uma criatura causar dano psíquico a você, ela sofre a mesma quantidade de dano.' },
      { level: 14, name: 'Criar Lacaio', description: 'Toque um humanoide incapacitado para enfeitiçá-lo até que remover maldição seja conjurada sobre ele, a condição seja removida ou você use esta característica novamente. Enquanto estiverem no mesmo plano, você pode se comunicar telepaticamente com ele.' },
    ] },
  ],
}

const clericDomains = (id: string, name: string, spells: string, features: ClassFeature[]): ClassSubclass => ({
  id, name, selectionLevel: 1, features: [{ level: 1, name: 'Magias de Domínio', description: `Estas magias ficam sempre preparadas e não contam no limite de magias preparadas: ${spells}` }, ...features],
})

const cleric: ClassFeatureData = {
  features: [
    { level: 1, name: 'Conjuração', description: 'Após um descanso longo, prepare uma quantidade de magias de clérigo igual ao seu nível de clérigo + seu modificador de Sabedoria (mínimo de uma). As magias de domínio estão sempre preparadas e não contam nesse limite. Você pode conjurar como ritual uma magia de clérigo preparada que tenha essa propriedade e usar um símbolo sagrado como foco.' },
    { level: 1, name: 'Domínio Divino', description: 'Escolha um domínio que concede magias e características nos níveis 1, 2, 6, 8 e 17.' },
    { level: 2, name: 'Canalizar Divindade (1/descanso)', description: 'Você canaliza energia divina para alimentar efeitos mágicos. Começa com Expulsar Mortos-Vivos e uma opção determinada pelo domínio. Recupera os usos após descanso curto ou longo; recebe um segundo uso no 6º nível e um terceiro no 18º.' },
    asi(4),
    { level: 5, name: 'Destruir Mortos-Vivos (ND 1/2)', description: 'Quando um morto-vivo falha no teste contra sua característica Expulsar Mortos-Vivos, ele é destruído instantaneamente se o ND for 1/2 ou menor. O limite aumenta para ND 1 no 8º nível, ND 2 no 11º, ND 3 no 14º e ND 4 no 17º.' },
    { level: 6, name: 'Canalizar Divindade (2/descanso)', description: 'Pode Canalizar Divindade duas vezes entre descansos.' },
    asi(8),
    { level: 8, name: 'Destruir Mortos-Vivos (ND 1)', description: 'O limite de ND aumenta para 1.' },
    { level: 10, name: 'Intervenção Divina', description: 'Com uma ação, descreva a ajuda que busca de sua divindade e role um d100. Se o resultado for igual ou menor que seu nível de clérigo, a divindade intervém; após sucesso, não pode usar novamente por 7 dias. Em falha, pode tentar de novo após um descanso longo. No 20º nível, a intervenção funciona automaticamente.' },
    { level: 11, name: 'Destruir Mortos-Vivos (ND 2)', description: 'O limite de ND aumenta para 2.' },
    asi(12),
    { level: 14, name: 'Destruir Mortos-Vivos (ND 3)', description: 'O limite de ND aumenta para 3.' },
    asi(16),
    { level: 17, name: 'Destruir Mortos-Vivos (ND 4)', description: 'O limite de ND aumenta para 4.' },
    { level: 18, name: 'Canalizar Divindade (3/descanso)', description: 'Pode Canalizar Divindade três vezes entre descansos.' },
    asi(19),
    { level: 20, name: 'Aprimoramento de Intervenção Divina', description: 'Seu pedido de Intervenção Divina é atendido automaticamente.' },
  ],
  subclasses: [
    clericDomains('dominio-do-conhecimento', 'Domínio do Conhecimento', 'Comando, identificação; augúrio, sugestão; dificultar detecção, falar com os mortos; olho arcano, confusão; conhecimento lendário, vidência.', [
      { level: 1, name: 'Bênçãos do Conhecimento', description: 'Aprenda dois idiomas à sua escolha e escolha duas perícias entre Arcanismo, História, Natureza e Religião. Você recebe proficiência nelas e dobra seu bônus de proficiência em testes que as usem.', choices: [
        { id: 'knowledge-skills', name: 'Perícias de Conhecimento', choose: 2, options: clericKnowledgeSkills },
        { id: 'knowledge-languages', name: 'Idiomas', choose: 2, options: clericLanguageOptions },
      ] },
      { level: 2, name: 'Conhecimento das Eras', description: 'Use Canalizar Divindade para escolher uma perícia ou ferramenta; você recebe proficiência nela por 10 minutos.' },
      { level: 6, name: 'Ler Pensamentos', description: 'Canalize Divindade para ler pensamentos superficiais por 1 minuto e poder encerrar o efeito para conjurar sugestão sem espaço.' },
      { level: 8, name: 'Conjuração Poderosa', description: 'Some Sabedoria ao dano de qualquer truque de clérigo.' },
      { level: 17, name: 'Visões do Passado', description: 'Medite para receber visões psíquicas dos donos anteriores de um objeto ou de eventos recentes e significativos de um local.' },
    ]),
    clericDomains('dominio-da-enganacao', 'Domínio da Enganação', 'Enfeitiçar pessoa, disfarçar-se; reflexos, passos sem pegadas; piscar, dissipar magia; porta dimensional, metamorfose; dominar pessoa, modificar memória.', [
      { level: 1, name: 'Bênção do Trapaceiro', description: 'Com uma ação, toque uma criatura voluntária diferente de você. Ela tem vantagem em testes de Destreza (Furtividade) por 1 hora ou até você usar esta característica novamente.' },
      { level: 2, name: 'Invocar Duplicidade', description: 'Use Canalizar Divindade para criar por 1 minuto uma duplicata ilusória sua. Como ação bônus, pode movê-la até 9 m. Você pode conjurar magias como se estivesse no espaço dela; além disso, tem vantagem nas jogadas de ataque contra uma criatura quando você e a duplicata estão a até 1,5 m dela.' },
      { level: 6, name: 'Manto de Sombras', description: 'Canalize Divindade para ficar invisível até o fim do próximo turno, atacar ou conjurar.' },
      { level: 8, name: 'Golpe Divino', description: 'Uma vez por turno, cause +1d8 de dano venenoso com ataque de arma; +2d8 no 14º nível.' },
      { level: 17, name: 'Duplicidade Aprimorada', description: 'Invocar Duplicidade cria até quatro duplicatas.' },
    ]),
    clericDomains('dominio-da-guerra', 'Domínio da Guerra', 'Auxílio divino, escudo da fé; arma mágica, arma espiritual; manto do cruzado, espíritos guardiões; movimentação livre, pele de pedra; coluna de chamas, imobilizar monstro.', [
      { level: 1, name: 'Proficiência Adicional', description: 'Ganhe proficiência com armas marciais e armaduras pesadas.' },
      { level: 1, name: 'Sacerdote da Guerra', description: 'Após Atacar, ataque uma vez como ação bônus; usos iguais à Sabedoria (mínimo 1) por descanso longo.' },
      { level: 2, name: 'Ataque Dirigido', description: 'Canalize Divindade após uma jogada de ataque para receber +10 antes do resultado.' },
      { level: 6, name: 'Bênção do Deus da Guerra', description: 'Reaja e Canalize Divindade para dar +10 ao ataque de criatura a até 9 m.' },
      { level: 8, name: 'Golpe Divino', description: 'Uma vez por turno, cause +1d8 radiante com ataque de arma; +2d8 no 14º.' },
      { level: 17, name: 'Avatar da Batalha', description: 'Resistência a dano de concussão, cortante e perfurante de armas não mágicas.' },
    ]),
    clericDomains('dominio-da-luz', 'Domínio da Luz', 'Mãos flamejantes, fogo das fadas; esfera flamejante, raio ardente; luz do dia, bola de fogo; guardião da fé, muralha de fogo; coluna de chamas, vidência.', [
      { level: 1, name: 'Truque Adicional', description: 'Aprenda o truque luz.' },
      { level: 1, name: 'Labareda Protetora', description: 'Quando uma criatura que você possa ver a até 9 m atacar você, use sua reação para impor desvantagem à jogada de ataque. Usos iguais ao modificador de Sabedoria (mínimo 1), recuperados após descanso longo.' },
      { level: 2, name: 'Radiação do Amanhecer', description: 'Canalize Divindade: dissipe escuridão mágica e cause 2d10 + nível de clérigo de dano radiante a hostis em 9 m (Constituição reduz à metade).' },
      { level: 6, name: 'Labareda Aprimorada', description: 'Labareda Protetora também pode proteger outra criatura a até 9 m.' },
      { level: 8, name: 'Conjuração Poderosa', description: 'Some Sabedoria ao dano de truques de clérigo.' },
      { level: 17, name: 'Coroa de Luz', description: 'Com uma ação, emita luz plena em um raio de 18 m e penumbra por mais 9 m, durante 1 minuto. Inimigos na luz plena têm desvantagem nos testes de resistência contra suas magias que causem dano de fogo ou radiante.' },
    ]),
    clericDomains('dominio-da-natureza', 'Domínio da Natureza', 'Amizade animal, falar com animais; pele de árvore, crescer espinhos; ampliar plantas, muralha de vento; dominar besta, vinha esmagadora; praga de insetos, caminhar em árvores.', [
      { level: 1, name: 'Acólito da Natureza', description: 'Aprenda um truque de druida à sua escolha. Você também recebe proficiência em Adestrar Animais, Natureza ou Sobrevivência.', choices: [{ id: 'nature-skill', name: 'Perícia de Acólito da Natureza', choose: 1, options: ['Adestrar Animais', 'Natureza', 'Sobrevivência'].map((skill) => option(skill, skill, `Proficiência em ${skill}.`)) }] },
      { level: 1, name: 'Proficiência Adicional', description: 'Ganhe proficiência em armaduras pesadas.' },
      { level: 2, name: 'Enfeitiçar Animais e Plantas', description: 'Use Canalizar Divindade para enfeitiçar bestas e plantas a até 9 m que falhem em resistência de Sabedoria. Permanecem enfeitiçadas por 1 minuto, até sofrerem dano ou até você ficar incapacitado ou morrer.' },
      { level: 6, name: 'Amortecer Elementos', description: 'Reaja para dar resistência a ácido, frio, fogo, elétrico ou trovão a você ou aliado a até 9 m atingido.' },
      { level: 8, name: 'Golpe Divino', description: 'Uma vez por turno, cause +1d8 de frio, fogo ou elétrico com ataque de arma; +2d8 no 14º.' },
      { level: 17, name: 'Senhor da Natureza', description: 'Como ação bônus, comande criaturas enfeitiçadas por sua opção de Canalizar Divindade.' },
    ]),
    clericDomains('dominio-da-tempestade', 'Domínio da Tempestade', 'Névoa obscurecente, onda trovejante; lufada de vento, despedaçar; convocar relâmpagos, nevasca; controlar a água, tempestade de gelo; onda destrutiva, praga de insetos.', [
      { level: 1, name: 'Proficiência Adicional', description: 'Ganhe proficiência com armas marciais e armaduras pesadas.' },
      { level: 1, name: 'Ira da Tormenta', description: 'Quando uma criatura a até 1,5 m atingir você com um ataque, use sua reação para causar 2d8 de dano elétrico ou trovejante a ela (teste de resistência de Destreza bem-sucedido reduz o dano à metade). Usos iguais ao modificador de Sabedoria (mínimo 1), recuperados após descanso longo.' },
      { level: 2, name: 'Ira Destruidora', description: 'Canalize Divindade para maximizar dano elétrico ou de trovão em vez de rolá-lo.' },
      { level: 6, name: 'Golpe de Relâmpago', description: 'Ao causar dano elétrico a criatura Grande ou menor, empurre-a até 3 m.' },
      { level: 8, name: 'Golpe Divino', description: 'Uma vez por turno, cause +1d8 trovão com ataque de arma; +2d8 no 14º.' },
      { level: 17, name: 'Filho da Tormenta', description: 'Ao ar livre, ganhe deslocamento de voo igual ao de caminhada.' },
    ]),
    clericDomains('dominio-da-vida', 'Domínio da Vida', 'Bênção, curar ferimentos; restauração menor, arma espiritual; sinal de esperança, revivificar; proteção contra a morte, guardião da fé; curar ferimentos em massa, reviver os mortos.', [
      { level: 1, name: 'Proficiência Adicional', description: 'Ganhe proficiência em armaduras pesadas.' },
      { level: 1, name: 'Discípulo da Vida', description: 'Magias de 1º nível ou maior que recuperem PV curam +2 + nível da magia.' },
      { level: 2, name: 'Preservar a Vida', description: 'Com uma ação e Canalizar Divindade, distribua pontos de vida em quantidade total de até 5 × seu nível de clérigo entre criaturas a até 9 m. Esta característica não pode elevar uma criatura acima da metade de seus pontos de vida máximos e não afeta mortos-vivos nem constructos.' },
      { level: 6, name: 'Curandeiro Abençoado', description: 'Ao curar outra criatura com magia de 1º nível ou maior, recupere 2 + nível da magia em PV.' },
      { level: 8, name: 'Golpe Divino', description: 'Uma vez por turno, cause +1d8 radiante com ataque de arma; +2d8 no 14º.' },
      { level: 17, name: 'Cura Suprema', description: 'Use o resultado máximo dos dados de magias de cura em vez de rolá-los.' },
    ]),
  ],
}

const druid: ClassFeatureData = {
  features: [
    { level: 1, name: 'Druídico', description: 'Você conhece o idioma secreto dos druidas e pode deixar mensagens ocultas nele. Outros percebem uma mensagem com um teste de Sabedoria (Percepção) CD 15, mas não conseguem decifrá-la sem magia.' },
    { level: 1, name: 'Armaduras e Escudos', description: 'Druidas não vestem armaduras nem usam escudos feitos de metal.' },
    { level: 1, name: 'Conjuração', description: 'Sabedoria é sua habilidade de conjuração (CD para resistir: 8 + bônus de proficiência + modificador de Sabedoria; ataque mágico: bônus de proficiência + modificador de Sabedoria). Após um descanso longo, prepare magias de druida em quantidade igual ao seu nível de druida + seu modificador de Sabedoria (mínimo de uma), de níveis para os quais tenha espaços. Você pode trocar a lista preparada ao fim de cada descanso longo; preparar cada magia exige pelo menos 1 minuto por nível da magia. Pode conjurar como ritual uma magia de druida preparada que tenha essa propriedade e usar um foco druídico. Recupera os espaços após um descanso longo.' },
    { level: 2, name: 'Círculo Druídico', description: 'Escolha um círculo que concede características nos níveis 2, 6, 10 e 14.' },
    { level: 2, name: 'Forma Selvagem', description: 'Duas vezes por descanso curto ou longo, use uma ação para assumir a forma de uma besta que já tenha visto. Até o 3º nível, o ND máximo é 1/4 e a besta não pode ter deslocamento de voo ou natação. A forma dura metade do seu nível de druida em horas (mínimo de 1 hora); você pode encerrá-la com uma ação bônus e volta à forma normal se ficar inconsciente, chegar a 0 PV ou morrer. Você assume os PV e as estatísticas físicas da besta, mas mantém tendência, personalidade, valores de Inteligência, Sabedoria e Carisma, perícias e testes de resistência (usando o melhor bônus quando o seu ou o da besta for maior). Não pode conjurar magias, mas pode manter concentração e realizar ações que a forma permita. Seu equipamento pode cair, ser incorporado ou continuar vestido, a critério do Mestre.' },
    { level: 4, name: 'Aprimoramento de Forma Selvagem', description: 'Seu limite de Forma Selvagem aumenta para ND 1/2; você ainda não pode assumir formas com deslocamento de voo.' },
    asi(4),
    { level: 8, name: 'Aprimoramento de Forma Selvagem', description: 'Seu limite de Forma Selvagem aumenta para ND 1 e deixa de haver restrição ao deslocamento de voo.' },
    asi(8), asi(12), asi(16),
    { level: 18, name: 'Corpo Atemporal', description: 'Para cada 10 anos passados, seu corpo envelhece apenas 1.' },
    { level: 18, name: 'Magias da Besta', description: 'Enquanto estiver em Forma Selvagem, você pode realizar os componentes verbais e somáticos das magias de druida, mas não os componentes materiais.' },
    asi(19),
    { level: 20, name: 'Arquidruida', description: 'Você pode usar Forma Selvagem um número ilimitado de vezes. Além disso, pode ignorar os componentes verbais e somáticos das magias de druida e os componentes materiais que não tenham custo nem sejam consumidos, tanto na forma normal quanto em Forma Selvagem.' },
  ],
  subclasses: [
    { id: 'circulo-da-terra', name: 'Círculo da Terra', selectionLevel: 2, features: [
      { level: 2, name: 'Truque Adicional', description: 'Aprenda um truque de druida adicional à sua escolha.', choices: [{ id: 'land-bonus-cantrip', name: 'Truque adicional', choose: 1, options: [
        option('arte-druidica', 'Arte Druídica', 'Pequeno efeito natural inofensivo.'),
        option('orientacao', 'Orientação', 'A criatura tocada soma 1d4 a um teste de habilidade.'),
        option('consertar', 'Consertar', 'Repara uma quebra ou rasgo pequeno em um objeto.'),
        option('borrifada-venenosa', 'Borrifada Venenosa', 'Rajada de veneno contra uma criatura próxima.'),
        option('produzir-chamas', 'Produzir Chamas', 'Cria uma chama que ilumina e pode ser arremessada.'),
        option('resistencia', 'Resistência', 'A criatura tocada soma 1d4 a um teste de resistência.'),
        option('bordao-mistico', 'Bordão Místico', 'Seu bordão ou clava usa Sabedoria para ataque e dano.'),
        option('chicote-de-espinhos', 'Chicote de Espinhos', 'Ataque de espinhos que pode puxar o alvo.'),
      ] }] },
      { level: 2, name: 'Recuperação Natural', description: 'Uma vez por descanso longo, durante um descanso curto, recupere espaços de magia gastos cuja soma de níveis não ultrapasse metade do seu nível de druida (arredondado para baixo). Nenhum espaço recuperado pode ser de 6º nível ou superior.' },
      { level: 2, name: 'Terreno do Círculo', description: 'Escolha o terreno que determina suas magias de círculo.', choices: [{ id: 'terra', name: 'Tipo de Terreno', choose: 1, options: [
        option('artico', 'Ártico', 'Imobilizar pessoa, crescer espinhos; nevasca, lentidão; movimentação livre, tempestade de gelo; comunhão com a natureza, cone de frio.'),
        option('costa', 'Costa', 'Passo nebuloso, reflexos; andar na água, respirar na água; movimentação livre, controlar água; vidência, conjurar elemental.'),
        option('deserto', 'Deserto', 'Nublar, silêncio; criar alimentos, proteção contra energia; praga, terreno alucinógeno; muralha de pedra, praga de insetos.'),
        option('floresta', 'Floresta', 'Patas de aranha, pele de árvore; convocar relâmpagos, ampliar plantas; adivinhação, movimentação livre; comunhão com a natureza, caminhar em árvores.'),
        option('montanha', 'Montanha', 'Crescer espinhos, patas de aranha; mesclar-se às rochas, relâmpago; moldar rochas, pele de pedra; criar passagem, muralha de pedra.'),
        option('pantano', 'Pântano', 'Escuridão, flecha ácida; andar na água, névoa fétida; localizar criatura, movimentação livre; vidência, praga de insetos.'),
        option('planicie', 'Planície', 'Invisibilidade, passos sem pegadas; luz do dia, velocidade; adivinhação, movimentação livre; praga de insetos, sonho.'),
        option('subterraneo', 'Subterrâneo', 'Patas de aranha, teia; forma gasosa, névoa fétida; invisibilidade maior, moldar rochas; praga de insetos, névoa mortal.'),
      ] }] },
      { level: 3, name: 'Magias de Círculo', description: 'As magias do terreno escolhido nos níveis 3º, 5º, 7º e 9º ficam sempre preparadas, não contam no limite de magias preparadas e, se ainda não forem magias de druida, passam a ser consideradas magias de druida para você.' },
      { level: 6, name: 'Caminho da Floresta', description: 'Ignore o custo adicional de movimento de terreno difícil não mágico. Plantas não mágicas não atrasam seu deslocamento nem causam dano ao atravessá-las. Você tem vantagem nos testes de resistência contra plantas mágicas criadas ou manipuladas para impedir movimento.' },
      { level: 10, name: 'Proteção Natural', description: 'Não pode ser enfeitiçado ou amedrontado por elementais ou fadas; é imune a veneno e doença.' },
      { level: 14, name: 'Santuário Natural', description: 'Quando uma besta ou planta atacar você, ela deve passar em um teste de resistência de Sabedoria contra a CD das suas magias de druida. Em caso de falha, deve escolher outro alvo ou o ataque erra; se passar, fica imune a este efeito por 24 horas.' },
    ] },
    { id: 'circulo-da-lua', name: 'Círculo da Lua', selectionLevel: 2, features: [
      { level: 2, name: 'Forma Selvagem de Combate', description: 'Você pode usar Forma Selvagem com uma ação bônus. Enquanto estiver transformado, pode usar uma ação bônus e gastar um espaço de magia para recuperar 1d8 pontos de vida por nível do espaço.' },
      { level: 2, name: 'Formas de Círculo', description: 'Você pode se transformar em bestas de ND até 1, ignorando o limite de ND da tabela de Forma Selvagem, mas mantendo as restrições de deslocamento. No 6º nível, o ND máximo passa a ser um terço do seu nível de druida, arredondado para baixo.' },
      { level: 6, name: 'Ataque Primordial', description: 'Ataques em forma de besta contam como mágicos contra resistências e imunidades.' },
      { level: 10, name: 'Forma Selvagem de Elemental', description: 'Gaste dois usos de Forma Selvagem ao mesmo tempo para assumir a forma de um elemental da água, ar, fogo ou terra.' },
      { level: 14, name: 'Mil Formas', description: 'Conjure alterar-se à vontade.' },
    ] },
  ],
}

const sorcererMetamagicOptions = [
  option('acelerada', 'Acelerada', '2 pontos: conjure com uma ação bônus uma magia cujo tempo de conjuração seja uma ação. Neste turno, não pode conjurar outra magia, exceto um truque com tempo de conjuração de uma ação.'),
  option('aumentada', 'Aumentada', '3 pontos: um alvo da magia tem desvantagem no primeiro teste de resistência contra ela.'),
  option('cuidadosa', 'Cuidadosa', '1 ponto: escolha até seu modificador de Carisma (mínimo 1) de criaturas que tenham que fazer um teste de resistência contra a magia. As criaturas escolhidas têm sucesso automaticamente.'),
  option('distante', 'Distante', '1 ponto: dobre o alcance de uma magia com alcance de pelo menos 1,5 m ou transforme alcance de toque em 9 m.'),
  option('duplicada', 'Duplicada', 'Gaste pontos de feitiçaria iguais ao nível da magia (mínimo 1) para afetar uma segunda criatura com uma magia que tenha como alvo apenas uma criatura e não tenha alcance pessoal. A criatura deve estar dentro do alcance e, se a magia exigir, a até 1,5 m da primeira.'),
  option('estendida', 'Estendida', '1 ponto: dobre a duração de uma magia de pelo menos 1 minuto, até o máximo de 24 horas.'),
  option('potencializada', 'Potencializada', '1 ponto: role novamente até seu modificador de Carisma (mínimo 1) dos dados de dano da magia e use os novos resultados. Pode ser combinada com outra opção de Metamágica.'),
  option('sutil', 'Sutil', '1 ponto: conjure sem componentes verbais ou somáticos.'),
]

const sorcererMetamagic = (level: number, choose: number, name: string, description: string): ClassFeature => ({
  level,
  name,
  description,
  choices: [{ id: 'sorcerer-metamagic', name, choose, options: sorcererMetamagicOptions }],
})

const sorcerer: ClassFeatureData = {
  features: [
    { level: 1, name: 'Conjuração', description: 'Carisma é sua habilidade de conjuração (CD para resistir: 8 + bônus de proficiência + modificador de Carisma; ataque mágico: bônus de proficiência + modificador de Carisma). Você conhece a quantidade de truques e magias de feiticeiro mostrada na progressão. Ao subir de nível, pode substituir uma magia conhecida por outra da lista de feiticeiro de um nível para o qual tenha espaços. Pode usar um foco arcano e recupera todos os espaços após um descanso longo.' },
    { level: 1, name: 'Origem de Feitiçaria', description: 'Escolha uma origem que concede características nos níveis 1, 6, 14 e 18.' },
    { level: 2, name: 'Fonte de Magia', description: 'Você recebe pontos de feitiçaria iguais ao seu nível de feiticeiro (máximo igual ao nível) e recupera todos após um descanso longo. Com uma ação bônus, pode converter um espaço de magia em pontos iguais ao nível do espaço ou converter pontos em espaços de 1º a 5º nível (custo: 2, 3, 5, 6 ou 7 pontos, respectivamente). Não pode ultrapassar seu máximo de espaços por nível; os espaços criados desaparecem ao terminar um descanso longo.' },
    sorcererMetamagic(3, 2, 'Metamágica', 'Escolha duas opções de Metamágica. Escolha mais uma no 10º e no 17º nível. Você pode aplicar apenas uma opção a cada magia, salvo se uma opção disser o contrário.'),
    asi(4), asi(8),
    sorcererMetamagic(10, 1, 'Metamágica', 'Aprenda uma opção adicional de Metamágica.'),
    asi(12), asi(16),
    sorcererMetamagic(17, 1, 'Metamágica', 'Aprenda uma opção adicional de Metamágica.'),
    asi(19),
    { level: 20, name: 'Restauração Mística', description: 'Recupere 4 pontos de feitiçaria ao terminar um descanso curto.' },
  ],
  subclasses: [
    { id: 'linhagem-draconica', name: 'Linhagem Dracônica', selectionLevel: 1, features: [
      { level: 1, name: 'Ancestral Dracônico', description: 'Escolha um tipo de dragão como ancestral. Você aprende a falar, ler e escrever em Dracônico e dobra seu bônus de proficiência em testes de Carisma feitos ao interagir com dragões, quando a proficiência se aplicar.', choices: [{ id: 'ancestral', name: 'Ancestral', choose: 1, options: [
        option('azul', 'Azul', 'Dano elétrico.'), option('branco', 'Branco', 'Dano de frio.'), option('bronze', 'Bronze', 'Dano elétrico.'), option('cobre', 'Cobre', 'Dano ácido.'), option('latao', 'Latão', 'Dano de fogo.'), option('negro', 'Negro', 'Dano ácido.'), option('ouro', 'Ouro', 'Dano de fogo.'), option('prata', 'Prata', 'Dano de frio.'), option('verde', 'Verde', 'Dano de veneno.'), option('vermelho', 'Vermelho', 'Dano de fogo.'),
      ] }] },
      { level: 1, name: 'Resiliência Dracônica', description: 'Seu máximo de pontos de vida aumenta em 1 no 1º nível e em mais 1 a cada nível de feiticeiro. Quando não estiver usando armadura, sua CA é 13 + seu modificador de Destreza.' },
      { level: 6, name: 'Afinidade Elemental', description: 'Ao conjurar uma magia que cause o tipo de dano de seu ancestral, some seu modificador de Carisma a uma rolagem de dano dessa magia. Você também pode gastar 1 ponto de feitiçaria para ganhar resistência a esse tipo de dano por 1 hora.' },
      { level: 14, name: 'Asas de Dragão', description: 'Com uma ação bônus, manifeste ou recolha asas que concedem deslocamento de voo igual ao seu deslocamento atual. Não pode manifestá-las usando armadura, a menos que ela seja feita para acomodá-las; roupas que não forem feitas para isso podem ser destruídas.' },
      { level: 18, name: 'Presença Dracônica', description: 'Com uma ação, gaste 5 pontos de feitiçaria para criar uma aura de 18 m por até 1 minuto, enquanto mantiver concentração. Criaturas hostis que começarem o turno na aura fazem um teste de resistência de Sabedoria; em caso de falha, ficam enfeitiçadas ou amedrontadas (à sua escolha) por 1 minuto. Quem passar fica imune à sua aura por 24 horas.' },
    ] },
    { id: 'magia-selvagem', name: 'Magia Selvagem', selectionLevel: 1, features: [
      { level: 1, name: 'Surto de Magia Selvagem', description: 'Depois de conjurar uma magia de feiticeiro de 1º nível ou superior, o Mestre pode pedir que você role um d20. Com resultado 1, role na tabela de Surto de Magia Selvagem para criar um efeito mágico.' },
      { level: 1, name: 'Marés de Caos', description: 'Uma vez antes de terminar um descanso longo, você pode ganhar vantagem em uma jogada de ataque, teste de habilidade ou teste de resistência. Depois de usar esta característica, antes de recuperar seu uso, o Mestre pode pedir que você role na tabela de Surto de Magia Selvagem imediatamente após conjurar uma magia de feiticeiro de 1º nível ou superior. Se isso acontecer, você recupera Marés de Caos.' },
      { level: 6, name: 'Dobrar a Sorte', description: 'Quando uma criatura que você possa ver fizer uma jogada de ataque, teste de habilidade ou teste de resistência, use sua reação e gaste 2 pontos de feitiçaria para rolar 1d4 e aplicar o resultado como bônus ou penalidade, após a rolagem e antes dos efeitos serem determinados.' },
      { level: 14, name: 'Caos Controlado', description: 'Sempre que rolar na tabela de Surto de Magia Selvagem, role duas vezes e escolha qual dos dois resultados aplicar.' },
      { level: 18, name: 'Bombardeio de Magia', description: 'Uma vez em cada um dos seus turnos, quando rolar dano para uma magia e obtiver o valor máximo possível em qualquer dado, escolha um desses dados, role-o novamente e some o novo resultado ao dano.' },
    ] },
  ],
}

const fighter: ClassFeatureData = {
  features: [
    { level: 1, name: 'Estilo de Luta', description: 'Adote um estilo de combate como especialidade. Você não pode escolher o mesmo estilo mais de uma vez, mesmo se puder escolher novamente.', choices: [{
      id: 'estilo-de-luta', name: 'Estilo de Luta', choose: 1, options: fighterStyles,
    }] },
    { level: 1, name: 'Retomar o Fôlego', description: 'Como ação bônus, recupere 1d10 + nível de guerreiro PV; recarrega em descanso curto ou longo.' },
    { level: 2, name: 'Surto de Ação (um uso)', description: 'No seu turno, você pode realizar uma ação adicional além da ação normal e de uma possível ação bônus. Recupera o uso após um descanso curto ou longo; a partir do 17º nível, pode usar essa característica duas vezes entre descansos, mas apenas uma vez no mesmo turno.' },
    { level: 3, name: 'Arquétipo Marcial', description: 'Escolha Campeão, Cavaleiro Arcano ou Mestre de Batalha. Seu arquétipo concede características nos níveis 3, 7, 10, 15 e 18.' },
    asi(4),
    { level: 5, name: 'Ataque Extra', description: 'Ataque duas vezes com a ação Atacar.' },
    asi(6), asi(8),
    { level: 9, name: 'Indomável (um uso)', description: 'Quando falhar em um teste de resistência, você pode repetir a rolagem e deve usar o novo resultado. Recupera o uso após um descanso longo; recebe um uso adicional no 13º nível e outro no 17º.' },
    { level: 11, name: 'Ataque Extra (2)', description: 'Ataque três vezes com a ação Atacar.' },
    asi(12),
    { level: 13, name: 'Indomável (dois usos)', description: 'Use Indomável duas vezes por descanso longo.' },
    asi(14), asi(16),
    { level: 17, name: 'Surto de Ação (dois usos)', description: 'Use Surto de Ação duas vezes por descanso, mas apenas uma vez por turno.' },
    { level: 17, name: 'Indomável (três usos)', description: 'Use Indomável três vezes por descanso longo.' },
    asi(19),
    { level: 20, name: 'Ataque Extra (3)', description: 'Ataque quatro vezes com a ação Atacar.' },
  ],
  subclasses: [
    { id: 'campeao', name: 'Campeão', selectionLevel: 3, features: [
      { level: 3, name: 'Crítico Aprimorado', description: 'Seus ataques com arma são críticos com 19 ou 20.' },
      { level: 7, name: 'Atletismo Extraordinário', description: 'Some metade do bônus de proficiência, arredondada para cima, a testes de Força, Destreza ou Constituição nos quais não tenha proficiência. Ao fazer um salto longo com corrida, a distância que pode cobrir aumenta em 0,3 m × seu modificador de Força.' },
      { level: 10, name: 'Estilo de Luta Adicional', description: 'Escolha um Estilo de Luta adicional, diferente daquele que já escolheu.', choices: [{ id: 'estilo-de-luta', name: 'Estilo de Luta adicional', choose: 1, options: fighterStyles }] },
      { level: 15, name: 'Crítico Superior', description: 'Seus ataques com arma são críticos com 18–20.' },
      { level: 18, name: 'Sobrevivente', description: 'No início do turno, se estiver entre 1 PV e metade dos PV, recupere 5 + Constituição PV.' },
    ] },
    { id: 'cavaleiro-arcano', name: 'Cavaleiro Arcano', selectionLevel: 3, features: [
      { level: 3, name: 'Conjuração', description: 'Use Inteligência para conjurar magias de mago. Aprenda dois truques e três magias de 1º nível da lista de mago; aprenda mais um truque no nível 10. Duas das magias iniciais devem ser de Abjuração ou Evocação. As magias novas aprendidas ao subir de nível normalmente devem ser dessas escolas, exceto as aprendidas nos níveis 8, 14 e 20, que podem ser de qualquer escola. Ao subir de nível de guerreiro, pode substituir uma magia conhecida por outra de nível para o qual tenha espaços, respeitando essas escolas. A tabela mostra truques, magias conhecidas e espaços de magia.' },
      { level: 3, name: 'Vínculo com Arma', description: 'Realize um ritual de 1 hora — que pode ser feito durante um descanso curto — para vincular uma arma que esteja ao seu alcance. Pode ter até duas armas vinculadas. Não pode ser desarmado delas, a menos que esteja incapacitado. Se uma arma vinculada estiver no mesmo plano, pode invocá-la para sua mão como ação bônus.' },
      { level: 7, name: 'Magia de Guerra', description: 'Após conjurar um truque com a ação, ataque com arma como ação bônus.' },
      { level: 10, name: 'Golpe Místico', description: 'Ao atingir com arma, o alvo tem desvantagem na próxima resistência contra sua magia até o fim do próximo turno.' },
      { level: 15, name: 'Investida Arcana', description: 'Ao usar Surto de Ação, teleporte-se até 9 m para um espaço desocupado que possa ver, antes ou depois da ação adicional.' },
      { level: 18, name: 'Magia de Guerra Aprimorada', description: 'Após conjurar qualquer magia com a ação, ataque com arma como ação bônus.' },
    ] },
    { id: 'mestre-de-batalha', name: 'Mestre de Batalha', selectionLevel: 3, features: [
      { level: 3, name: 'Superioridade em Combate', description: 'Aprenda três manobras e receba quatro dados de superioridade d8, recuperados após descanso curto ou longo. Aprenda mais duas manobras nos níveis 7, 10 e 15; sempre que aprender, pode substituir uma manobra conhecida por outra. Receba mais um dado nos níveis 7 e 15; os dados tornam-se d10 no nível 10 e d12 no 18. A CD é 8 + bônus de proficiência + modificador de Força ou Destreza, à sua escolha. Só pode usar uma manobra por ataque.', choices: [{ id: 'manobras', name: 'Manobras', choose: 3, options: battleManeuvers }] },
      { level: 3, name: 'Estudioso da Guerra', description: 'Ganhe proficiência com um tipo de ferramenta de artesão à sua escolha.', choices: [{ id: 'battle-master-tool', name: 'Ferramenta de artesão', choose: 1, options: artisanToolOptions }] },
      { level: 7, name: 'Conheça seu Inimigo', description: 'Fora de combate, após observar ou interagir com uma criatura por pelo menos 1 minuto, você descobre se duas características escolhidas são iguais, superiores ou inferiores às suas: Força, Destreza, Constituição, Classe de Armadura, pontos de vida atuais, nível total de classe ou níveis de guerreiro.' },
      { level: 7, name: 'Manobras Adicionais', description: 'Aprenda mais duas manobras de sua escolha.', choices: [{ id: 'manobras', name: 'Manobras adicionais', choose: 2, options: battleManeuvers }] },
      { level: 10, name: 'Superioridade em Combate Aprimorada', description: 'Dados de superioridade tornam-se d10; no 18º nível, d12.' },
      { level: 10, name: 'Manobras Adicionais', description: 'Aprenda mais duas manobras de sua escolha.', choices: [{ id: 'manobras', name: 'Manobras adicionais', choose: 2, options: battleManeuvers }] },
      { level: 15, name: 'Implacável', description: 'Ao rolar iniciativa sem dados de superioridade, recupere um.' },
      { level: 15, name: 'Manobras Adicionais', description: 'Aprenda mais duas manobras de sua escolha.', choices: [{ id: 'manobras', name: 'Manobras adicionais', choose: 2, options: battleManeuvers }] },
      { level: 18, name: 'Superioridade em Combate Aprimorada', description: 'Seus dados de superioridade tornam-se d12.' },
    ] },
  ],
}

const rogue: ClassFeatureData = {
  features: [
    { level: 1, name: 'Especialização', description: 'Escolha duas perícias em que seja proficiente, ou uma perícia proficiente e ferramentas de ladrão. Dobre o bônus de proficiência em testes que usem as escolhas. No 6º nível, escolha mais duas perícias proficientes e/ou ferramentas de ladrão para receber esse benefício.', choices: [{ id: 'rogue-expertise', name: 'Especialização', choose: 2, options: rogueExpertiseOptions }] },
    { level: 1, name: 'Ataque Furtivo', description: 'Uma vez por turno, ao acertar com arma de acuidade ou à distância, cause dano extra. Você precisa ter vantagem no ataque ou, se não tiver desvantagem, um inimigo do alvo que não esteja incapacitado precisa estar a até 1,5 m dele. O dano começa em 1d6 e aumenta conforme a tabela de Ladino.' },
    { level: 1, name: 'Gíria de Ladrão', description: 'Você conhece o dialeto secreto dos ladrões, que permite ocultar mensagens em conversas comuns; transmitir uma mensagem dessa forma leva quatro vezes mais tempo. Também compreende sinais e símbolos usados para transmitir informações curtas, como perigo, território de guilda, saque ou esconderijos.' },
    { level: 2, name: 'Ação Ardilosa', description: 'Use ação bônus para Disparada, Desengajar ou Esconder.' },
    { level: 3, name: 'Arquétipo de Ladino', description: 'Escolha um arquétipo que concede características nos níveis 3, 9, 13 e 17.' },
    asi(4),
    { level: 5, name: 'Esquiva Sobrenatural', description: 'Quando um atacante que você possa ver acertar você com um ataque, use sua reação para reduzir à metade o dano sofrido.' },
    { level: 6, name: 'Especialização', description: 'Escolha mais duas perícias proficientes e/ou ferramentas de ladrão para receber Especialização.', choices: [{ id: 'rogue-expertise', name: 'Especialização adicional', choose: 2, options: rogueExpertiseOptions }] },
    { level: 7, name: 'Evasão', description: 'Em resistências de Destreza que dariam metade, sofra zero no sucesso e metade na falha.' },
    asi(8), asi(10),
    { level: 11, name: 'Talento Confiável', description: 'Em testes que incluam sua proficiência, trate resultados de d20 de 9 ou menos como 10.' },
    asi(12),
    { level: 14, name: 'Sentido Cego', description: 'Se puder ouvir, saiba a localização de criaturas escondidas ou invisíveis a até 3 m.' },
    { level: 15, name: 'Mente Escorregadia', description: 'Ganhe proficiência em resistências de Sabedoria.' },
    asi(16),
    { level: 18, name: 'Elusivo', description: 'Enquanto não estiver incapacitado, nenhum ataque contra você tem vantagem.' },
    asi(19),
    { level: 20, name: 'Golpe de Sorte', description: 'Se errar um ataque contra um alvo ao seu alcance, transforme-o em acerto; ou, se falhar em um teste de habilidade, trate o resultado do d20 como 20. Depois de usar esta característica, é preciso terminar um descanso curto ou longo para usá-la novamente.' },
  ],
  subclasses: [
    { id: 'assassino', name: 'Assassino', selectionLevel: 3, features: [
      { level: 3, name: 'Proficiência Adicional', description: 'Proficiência com kit de disfarce e kit de venenos.' },
      { level: 3, name: 'Assassinar', description: 'Você tem vantagem nas jogadas de ataque contra qualquer criatura que ainda não tenha agido no combate. Qualquer ataque que atinja uma criatura surpresa é um acerto crítico.' },
      { level: 9, name: 'Especialização em Infiltração', description: 'Passe sete dias e gaste 25 po para criar uma identidade falsa convincente, com histórico, profissão e filiações. A identidade não pode pertencer a uma pessoa existente. Quem encontrar você acreditará que é essa pessoa até ter motivo claro para desconfiar.' },
      { level: 13, name: 'Impostor', description: 'Após observar e ouvir uma pessoa por pelo menos 3 horas, imite sua fala, escrita e comportamento. Se uma criatura desconfiar da imitação, você tem vantagem nos testes de Carisma (Enganação) para evitar ser detectado.' },
      { level: 17, name: 'Golpe Letal', description: 'Quando acertar uma criatura surpresa, ela deve passar em um teste de resistência de Constituição (CD 8 + seu modificador de Destreza + bônus de proficiência) ou o dano do ataque será dobrado.' },
    ] },
    { id: 'ladrao', name: 'Ladrão', selectionLevel: 3, features: [
      { level: 3, name: 'Mãos Rápidas', description: 'Use a ação bônus concedida por Ação Ardilosa para fazer um teste de Destreza (Prestidigitação), usar ferramentas de ladrão para abrir uma fechadura ou desarmar uma armadilha, ou realizar a ação Usar um Objeto.' },
      { level: 3, name: 'Andarilho de Telhados', description: 'Escalar não custa movimento extra. Ao fazer um salto longo com corrida, a distância que pode cobrir aumenta em 0,3 m × seu modificador de Destreza.' },
      { level: 9, name: 'Furtividade Suprema', description: 'Você tem vantagem em testes de Destreza (Furtividade) se não se mover mais da metade do seu deslocamento no mesmo turno.' },
      { level: 13, name: 'Usar Instrumento Mágico', description: 'Ignore requisitos de classe, raça e nível para usar itens mágicos.' },
      { level: 17, name: 'Reflexos de Ladrão', description: 'Tenha dois turnos na primeira rodada, na iniciativa normal e em iniciativa −10; não funciona se surpreendido.' },
    ] },
    { id: 'trapaceiro-arcano', name: 'Trapaceiro Arcano', selectionLevel: 3, features: [
      { level: 3, name: 'Conjuração', description: 'Use Inteligência para conjurar magias da lista de mago. Aprenda o truque mãos mágicas e outros dois truques de mago; aprenda mais um truque no nível 10. Conheça três magias de 1º nível, duas das quais devem ser de Encantamento ou Ilusão. As magias novas aprendidas ao subir de nível normalmente devem ser dessas escolas, exceto as aprendidas nos níveis 8, 14 e 20, que podem ser de qualquer escola. Ao subir de nível de ladino, pode substituir uma magia conhecida por outra de nível para o qual tenha espaços, respeitando essas escolas. A tabela mostra truques, magias conhecidas e espaços; recupera todos os espaços após um descanso longo.' },
      { level: 3, name: 'Mãos Mágicas Malabaristas', description: 'Ao conjurar mãos mágicas, pode tornar a mão invisível e usá-la para guardar ou recuperar um objeto de um recipiente vestido ou carregado por outra criatura, abrir fechaduras ou desarmar armadilhas à distância com ferramentas de ladrão. Pode tentar essas ações sem ser notado: faça um teste de Destreza (Prestidigitação) resistido por Sabedoria (Percepção) da criatura. Pode usar a ação bônus de Ação Ardilosa para controlar a mão.' },
      { level: 9, name: 'Emboscada Mágica', description: 'Se estiver escondido de uma criatura ao conjurar uma magia que a tenha como alvo, ela tem desvantagem em testes de resistência contra essa magia neste turno.' },
      { level: 13, name: 'Trapaceiro Versátil', description: 'Como ação bônus, escolha uma criatura a até 1,5 m da sua mão espectral. Você tem vantagem nas jogadas de ataque contra ela até o fim do turno.' },
      { level: 17, name: 'Ladrão de Magia', description: 'Uma vez por descanso longo, use sua reação quando uma criatura conjurar uma magia que tenha você como alvo ou inclua você na área. Ela faz um teste de resistência usando seu modificador de conjuração contra a CD das suas magias. Se falhar, a magia não tem efeito sobre você e, se for de nível que possa conjurar (mínimo 1º), você a conhece e pode conjurá-la usando seus espaços pelas próximas 8 horas; nesse período, a criatura não pode conjurá-la.' },
    ] },
  ],
}

const wizardSchool = (id: string, name: string, school: string, features: ClassFeature[]): ClassSubclass => ({
  id, name, selectionLevel: 2, features: [{ level: 2, name: `${school} Instruída`, description: `O tempo e o ouro necessários para copiar uma magia de ${school} para seu grimório são reduzidos à metade.` }, ...features],
})

const wizard: ClassFeatureData = {
  features: [
    { level: 1, name: 'Conjuração', description: 'Seu grimório começa com seis magias de mago de 1º nível e você conhece três truques. Ao ganhar um nível de mago após o 1º, adicione duas magias de mago à sua escolha ao grimório, de níveis para os quais tenha espaços. Ao terminar um descanso longo, prepare do grimório uma quantidade de magias igual ao seu nível de mago + modificador de Inteligência (mínimo 1); preparar uma lista nova exige pelo menos 1 minuto por nível de cada magia. Inteligência é sua habilidade de conjuração (CD 8 + bônus de proficiência + modificador de Inteligência; ataque mágico: bônus de proficiência + modificador de Inteligência). Pode conjurar como ritual qualquer magia de mago com essa propriedade que esteja no grimório, sem prepará-la; a conjuração ritual leva 10 minutos adicionais. Ao encontrar uma magia de mago de nível que possa preparar, pode copiá-la para o grimório: cada nível exige 2 horas e 50 po. Copiar uma magia do seu próprio grimório leva 1 hora e 10 po por nível. A tabela mostra os truques e espaços de magia por nível.' },
    { level: 1, name: 'Recuperação Arcana', description: 'Uma vez por dia, ao terminar um descanso curto, recupere espaços gastos cuja soma de níveis seja até metade do seu nível de mago, arredondada para cima. Nenhum espaço recuperado pode ser de 6º nível ou superior.' },
    { level: 2, name: 'Tradição Arcana', description: 'Escolha uma tradição que concede características nos níveis 2, 6, 10 e 14.' },
    asi(4), asi(8), asi(12), asi(16),
    { level: 18, name: 'Dominar Magia', description: 'Escolha uma magia de mago de 1º nível e outra de 2º nível do grimório. Elas ficam sempre preparadas e não contam no limite de magias preparadas. Você pode conjurá-las no nível mínimo sem gastar espaços de magia.' },
    asi(19),
    { level: 20, name: 'Assinatura Mágica', description: 'Escolha duas magias de mago de 3º nível do grimório. Elas ficam sempre preparadas e não contam no limite de magias preparadas; cada uma pode ser conjurada uma vez no 3º nível sem gastar espaço, recuperando o uso após descanso curto ou longo.' },
  ],
  subclasses: [
    wizardSchool('escola-de-abjuracao', 'Escola de Abjuração', 'Abjuração', [
      { level: 2, name: 'Proteção Arcana', description: 'Ao conjurar uma magia de abjuração de 1º nível ou superior, crie uma proteção que dura até seu próximo descanso longo, com PV máximos iguais a 2 × seu nível de mago + modificador de Inteligência. Quando sofrer dano, a proteção o absorve primeiro; dano excedente passa para você. Ao conjurar outra magia de abjuração de 1º nível ou superior, recupere PV da proteção iguais a 2 × o nível da magia, sem ultrapassar o máximo. Com 0 PV, ela não absorve dano, mas sua magia permanece e pode ser recarregada. Só pode criar uma proteção uma vez entre descansos longos.' },
      { level: 6, name: 'Proteção Projetada', description: 'Quando uma criatura que possa ver a até 9 m sofrer dano, use sua reação para fazer sua Proteção Arcana absorvê-lo. Se o dano reduzir a proteção a 0 PV, a criatura protegida sofre o dano restante.' },
      { level: 10, name: 'Abjuração Aprimorada', description: 'Ao fazer um teste de habilidade como parte de conjurar uma magia de abjuração (como contramágica ou dissipar magia), some seu bônus de proficiência ao teste.' },
      { level: 14, name: 'Resistência à Magia', description: 'Você tem vantagem em testes de resistência contra magias e resistência contra o dano causado por magias.' },
    ]),
    wizardSchool('escola-de-adivinhacao', 'Escola de Adivinhação', 'Adivinhação', [
      { level: 2, name: 'Prodígio', description: 'Após um descanso longo, role dois d20 e anote os resultados. Antes de uma jogada de ataque, teste de habilidade ou teste de resistência seu ou de uma criatura que possa ver, substitua o d20 pelo resultado anotado. Só pode fazer uma substituição por rodada, e cada resultado só pode ser usado uma vez.' },
      { level: 6, name: 'Especialista em Adivinhação', description: 'Ao conjurar uma magia de adivinhação de 2º nível ou superior usando um espaço, recupere um espaço gasto de nível inferior ao espaço usado, no máximo de 5º nível.' },
      { level: 10, name: 'O Terceiro Olho', description: 'Uma vez por descanso longo, use uma ação para escolher um benefício até ficar incapacitado ou terminar um descanso: visão no escuro a 18 m; ver o Plano Etéreo a até 18 m; ler qualquer idioma; ou ver criaturas e objetos invisíveis a até 3 m que estejam na sua linha de visão.' },
      { level: 14, name: 'Prodígio Maior', description: 'Passe a guardar 3d20 para Prodígio.' },
    ]),
    wizardSchool('escola-de-conjuracao', 'Escola de Conjuração', 'Conjuração', [
      { level: 2, name: 'Conjuração Menor', description: 'Com uma ação, crie na mão ou em um espaço desocupado que possa ver a até 3 m um objeto inanimado e não mágico que já tenha visto. Ele não pode exceder 90 cm em qualquer dimensão nem pesar mais de 5 kg, emite penumbra a 1,5 m e desaparece após 1 hora, se usar esta característica novamente ou se sofrer dano.' },
      { level: 6, name: 'Transposição Benigna', description: 'Com uma ação, teleporte-se até 9 m para um espaço desocupado que possa ver ou escolha uma criatura Pequena ou Média voluntária que possa ver a até 9 m e troque de lugar com ela. Recupera após um descanso longo ou quando conjura uma magia de conjuração de 1º nível ou superior.' },
      { level: 10, name: 'Conjuração Focada', description: 'Sofrer dano não quebra sua concentração em uma magia de conjuração.' },
      { level: 14, name: 'Invocações Resistentes', description: 'Criaturas invocadas ou criadas por suas magias ganham 30 PV temporários.' },
    ]),
    wizardSchool('escola-de-encantamento', 'Escola de Encantamento', 'Encantamento', [
      { level: 2, name: 'Olhar Hipnotizante', description: 'Com uma ação, escolha uma criatura que possa ver ou ouvir a até 1,5 m. Se falhar em um teste de resistência de Sabedoria, fica enfeitiçada e incapacitada, com deslocamento 0, até o fim do seu próximo turno. Nos turnos seguintes, pode usar sua ação para manter o efeito até o fim do próximo turno. O efeito termina se a criatura se afastar mais de 1,5 m, deixar de vê-lo ou ouvi-lo, ou você ficar incapacitado.' },
      { level: 6, name: 'Encanto Instintivo', description: 'Quando uma criatura que possa ver a até 9 m fizer uma jogada de ataque contra você e houver outra criatura dentro do alcance do ataque, use sua reação para forçá-la a fazer um teste de resistência de Sabedoria. Se falhar, ela deve escolher como alvo a criatura mais próxima de si, que não seja você nem ela mesma, entre as que estejam dentro do alcance; se houver várias igualmente próximas, o atacante escolhe. Criaturas imunes à condição enfeitiçado são imunes a esta característica. Se o atacante passar no teste, você não pode usar esta característica contra ele novamente até terminar um descanso longo.' },
      { level: 10, name: 'Dividir Encantamento', description: 'Quando conjurar uma magia de encantamento de 1º nível ou superior que tenha como alvo apenas uma criatura, pode escolher uma segunda criatura dentro do alcance como alvo.' },
      { level: 14, name: 'Alterar Memórias', description: 'Ao conjurar uma magia de encantamento para enfeitiçar uma ou mais criaturas, escolha uma delas: ela não percebe que foi enfeitiçada. Uma vez antes do fim do seu próximo turno após a magia terminar, use uma ação para forçá-la a fazer um teste de resistência de Inteligência contra a CD das suas magias. Se falhar, ela esquece um período de até 1 + seu modificador de Carisma horas, limitado à duração da magia.' },
    ]),
    wizardSchool('escola-de-evocacao', 'Escola de Evocação', 'Evocação', [
      { level: 2, name: 'Esculpir Magias', description: 'Em Evocações, proteja 1 + nível da magia criaturas visíveis: sucesso automático e nenhum dano que seria reduzido à metade.' },
      { level: 6, name: 'Truque Potente', description: 'Quando uma criatura obtiver sucesso em uma resistência contra um de seus truques que cause dano, ela ainda sofre metade do dano, se houver, mas não sofre efeitos adicionais do truque.' },
      { level: 10, name: 'Evocação Potencializada', description: 'Some Inteligência a uma rolagem de dano de magia de Evocação.' },
      { level: 14, name: 'Sobrecarga', description: 'Ao conjurar uma magia de mago de 5º nível ou inferior que cause dano, você pode causar o dano máximo. O primeiro uso após um descanso longo não causa efeito adverso. Cada uso adicional antes de terminar um descanso longo causa a você 2d12 de dano necrótico por nível da magia, mais 1d12 por nível da magia para cada uso anterior adicional. Esse dano não pode ser reduzido ou prevenido.' },
    ]),
    wizardSchool('escola-de-ilusao', 'Escola de Ilusão', 'Ilusão', [
      { level: 2, name: 'Ilusão Menor Aprimorada', description: 'Aprenda ilusão menor gratuitamente. Se já conhecer esse truque, aprenda outro truque de mago à sua escolha. Ao conjurar ilusão menor, pode criar um som e uma imagem com a mesma conjuração.' },
      { level: 6, name: 'Ilusões Moldáveis', description: 'Como uma ação, altere a natureza de uma magia de ilusão que tenha conjurado e cuja duração seja de 1 minuto ou mais, desde que possa ver a ilusão.' },
      { level: 10, name: 'Eu Ilusório', description: 'Uma vez por descanso curto ou longo, quando uma criatura fizer uma jogada de ataque contra você, use sua reação para interpor uma duplicata ilusória entre vocês; o ataque erra automaticamente.' },
      { level: 14, name: 'Realidade Ilusória', description: 'Ao conjurar uma magia de ilusão de 1º nível ou superior, escolha um objeto inanimado e não mágico que faça parte da ilusão. Como ação bônus, torne-o real por 1 minuto enquanto a magia durar. O objeto não pode causar dano diretamente.' },
    ]),
    wizardSchool('escola-de-necromancia', 'Escola de Necromancia', 'Necromancia', [
      { level: 2, name: 'Colheita Sinistra', description: 'Uma vez por turno, quando matar uma ou mais criaturas com uma magia de 1º nível ou superior, recupere PV iguais a 2 × o nível da magia, ou 3 × o nível se ela for de necromancia. Não funciona contra constructos ou mortos-vivos.' },
      { level: 6, name: 'Escravos Mortos-Vivos', description: 'Adicione animar mortos ao grimório. Ao conjurá-la, pode escolher um cadáver ou pilha de ossos adicional. Mortos-vivos criados por uma magia de necromancia têm PV máximos aumentados em seu nível de mago e somam seu bônus de proficiência às jogadas de dano com armas.' },
      { level: 10, name: 'Acostumado à Morte-Vida', description: 'Você tem resistência a dano necrótico e seu máximo de pontos de vida não pode ser reduzido.' },
      { level: 14, name: 'Comandar Mortos-Vivos', description: 'Com uma ação, escolha um morto-vivo que possa ver a até 18 m. Ele faz um teste de resistência de Carisma; se falhar, fica amistoso e obedece aos seus comandos até usar esta característica novamente. Mortos-vivos com Inteligência 8 ou mais têm vantagem; os com Inteligência 12 ou mais podem repetir o teste ao fim de cada hora.' },
    ]),
    wizardSchool('escola-de-transmutacao', 'Escola de Transmutação', 'Transmutação', [
      { level: 2, name: 'Alquimia Menor', description: 'Transforme um objeto feito inteiramente de madeira, pedra (não preciosa), ferro, cobre ou prata em outro desses materiais. A cada 10 minutos, pode transformar até 0,03 m³. O material retorna ao original após 1 hora ou quando perder a concentração.' },
      { level: 6, name: 'Pedra de Transmutador', description: 'Após 8 horas de trabalho, crie uma pedra que concede ao portador um benefício à sua escolha: visão no escuro a 18 m; +3 m de deslocamento enquanto não usar armadura pesada; proficiência em testes de resistência de Constituição; ou resistência a dano de ácido, frio, fogo, elétrico ou trovejante. Enquanto portar a pedra, pode mudar o benefício ao conjurar uma magia de transmutação de 1º nível ou superior. Se criar outra pedra, a anterior deixa de funcionar.' },
      { level: 10, name: 'Metamorfo', description: 'Ganhe metamorfose e conjure-a em si sem espaço, para besta ND 1 ou menor, uma vez por descanso curto ou longo.' },
      { level: 14, name: 'Mestre Transmutador', description: 'Destrua sua Pedra de Transmutador para realizar um dos efeitos a seguir; ela não pode ser recriada até terminar um descanso longo. Transformação Maior: transforme um objeto não mágico de até 1,5 m cúbico em outro objeto não mágico de tamanho, massa e valor iguais ou inferiores. Panaceia: remova maldições, doenças e venenos de uma criatura que tocar e restaure todos os seus PV. Restaurar Vida: conjure reviver mortos sem espaço de magia e sem precisar tê-la no grimório. Restaurar Juventude: reduza em 3d10 anos a idade aparente de uma criatura voluntária que tocar (mínimo 13 anos), sem estender sua expectativa de vida.' },
    ]),
  ],
}

const monk: ClassFeatureData = {
  features: [
    { level: 1, name: 'Defesa sem Armadura', description: 'Sem armadura nem escudo, sua CA é 10 + Destreza + Sabedoria.' },
    { level: 1, name: 'Artes Marciais', description: 'Sem armadura nem escudo e usando golpes desarmados ou armas de monge, você pode usar Destreza no lugar de Força para ataques e dano, usar o dado de Artes Marciais no lugar do dano normal e fazer um golpe desarmado como ação bônus após a ação Atacar.' },
    { level: 2, name: 'Chi', description: 'A partir do 2º nível, você tem pontos de chi iguais ao seu nível de monge, recuperados ao terminar um descanso curto ou longo após meditar por pelo menos 30 minutos. A CD para suas características de chi é 8 + bônus de proficiência + modificador de Sabedoria. Rajada de Golpes permite fazer dois golpes desarmados como ação bônus após Atacar; Defesa Paciente permite Esquivar como ação bônus; Passo do Vento permite Desengajar ou Disparada como ação bônus e dobra a distância de salto no turno.' },
    { level: 2, name: 'Movimento sem Armadura', description: 'Seu deslocamento aumenta em 3 m enquanto não usar armadura nem escudo; o aumento cresce nos níveis seguintes. No 9º nível, pode mover-se por superfícies verticais e líquidos durante seu turno sem cair.' },
    { level: 3, name: 'Defletir Projéteis', description: 'Use sua reação para reduzir em 1d10 + seu modificador de Destreza + seu nível de monge o dano de um ataque com arma à distância. Se reduzir o dano a 0 e tiver uma mão livre, você pode capturar o projétil; então, gaste 1 chi para arremessá-lo como parte da mesma reação, com proficiência, alcance normal de 6 m e longo de 18 m.' },
    { level: 3, name: 'Tradição Monástica', description: 'Escolha uma tradição que concede características nos níveis 3, 6, 11 e 17.' },
    asi(4),
    { level: 4, name: 'Queda Lenta', description: 'Reaja ao cair para reduzir o dano em 5 × nível de monge.' },
    { level: 5, name: 'Ataque Extra', description: 'Ataque duas vezes com a ação Atacar.' },
    { level: 5, name: 'Ataque Atordoante', description: 'Quando atingir outra criatura com um ataque corpo a corpo com arma, você pode gastar 1 ponto de chi para tentar atordoá-la. O alvo faz um teste de resistência de Constituição; se falhar, fica atordoado até o fim do seu próximo turno.' },
    { level: 6, name: 'Golpes de Chi', description: 'Golpes desarmados contam como mágicos contra resistências e imunidades.' },
    { level: 7, name: 'Evasão', description: 'Em resistências de Destreza para metade, sofra zero no sucesso e metade na falha.' },
    { level: 7, name: 'Mente Tranquila', description: 'Use sua ação para encerrar em si enfeitiçado ou amedrontado.' },
    asi(8),
    { level: 9, name: 'Aprimoramento de Movimento sem Armadura', description: 'Mova-se por superfícies verticais e líquidos durante o turno sem cair.' },
    { level: 10, name: 'Pureza Corporal', description: 'Imunidade a doença e veneno.' },
    asi(12),
    { level: 13, name: 'Idiomas do Sol e da Lua', description: 'Compreenda todos os idiomas falados e seja compreendido por qualquer criatura que conheça idioma.' },
    { level: 14, name: 'Alma de Diamante', description: 'Proficiência em todas as resistências; gaste 1 chi para rerrolar uma falha.' },
    { level: 15, name: 'Corpo Atemporal', description: 'Você não sofre as fragilidades da velhice nem pode envelhecer magicamente, embora ainda possa morrer de velhice. Não precisa de comida ou água.' },
    asi(16),
    { level: 18, name: 'Corpo Vazio', description: 'Gaste 4 chi para invisibilidade e resistência a todo dano salvo energia por 1 minuto; ou 8 chi para projeção astral em si.' },
    asi(19),
    { level: 20, name: 'Auto Aperfeiçoamento', description: 'Ao rolar iniciativa sem chi, recupere 4 pontos.' },
  ],
  subclasses: [
    { id: 'caminho-da-mao-aberta', name: 'Caminho da Mão Aberta', selectionLevel: 3, features: [
      { level: 3, name: 'Técnica da Mão Aberta', description: 'Ao acertar Rajada de Golpes, escolha: derrubar (Destreza), empurrar 4,5 m (Força) ou impedir reações até o fim do próximo turno.' },
      { level: 6, name: 'Integridade Corporal', description: 'Uma vez por descanso longo, use ação para recuperar 3 × nível de monge PV.' },
      { level: 11, name: 'Tranquilidade', description: 'Após descanso longo, receba santuário até o próximo descanso ou até quebrar a magia.' },
      { level: 17, name: 'Palma Vibrante', description: 'Gaste 3 chi após golpe desarmado; depois, use ação para forçar Constituição: 0 PV na falha, 10d10 necrótico no sucesso.' },
    ] },
    { id: 'caminho-da-sombra', name: 'Caminho da Sombra', selectionLevel: 3, features: [
      { level: 3, name: 'Artes Sombrias', description: 'Ganhe ilusão menor; por 2 chi, conjure escuridão, visão no escuro, passos sem pegadas ou silêncio.' },
      { level: 6, name: 'Passo das Sombras', description: 'Em penumbra/escuridão, ação bônus para teleportar 18 m entre sombras e ter vantagem no primeiro ataque corpo a corpo do turno.' },
      { level: 11, name: 'Manto de Sombras', description: 'Em penumbra/escuridão, use ação para ficar invisível até atacar, conjurar ou entrar em luz plena.' },
      { level: 17, name: 'Oportunista', description: 'Reaja para atacar corpo a corpo criatura adjacente atingida por outra criatura.' },
    ] },
    { id: 'caminho-dos-quatro-elementos', name: 'Caminho dos Quatro Elementos', selectionLevel: 3, features: [
      { level: 3, name: 'Discípulo dos Elementos', description: 'Aprenda Sintonia Elemental e uma disciplina; aprenda outra no 6º, 11º e 17º e possa trocar uma conhecida.', choices: [{ id: 'disciplinas', name: 'Disciplina Elemental', choose: 1, options: elementalDisciplines }] },
      { level: 6, name: 'Disciplina Elemental Adicional', description: 'Aprenda mais uma disciplina e possa substituir uma conhecida.', choices: [{ id: 'disciplinas', name: 'Disciplina Elemental', choose: 1, options: elementalDisciplines }] },
      { level: 11, name: 'Disciplina Elemental Adicional', description: 'Aprenda mais uma disciplina e possa substituir uma conhecida.', choices: [{ id: 'disciplinas', name: 'Disciplina Elemental', choose: 1, options: elementalDisciplines }] },
      { level: 17, name: 'Disciplina Elemental Adicional', description: 'Aprenda mais uma disciplina e possa substituir uma conhecida.', choices: [{ id: 'disciplinas', name: 'Disciplina Elemental', choose: 1, options: elementalDisciplines }] },
    ] },
  ],
}

const paladin: ClassFeatureData = {
  features: [
    { level: 1, name: 'Sentido Divino', description: 'Com uma ação, até o fim do seu próximo turno, você sabe a localização e o tipo de qualquer celestial, corruptor ou morto-vivo a até 18 m que não esteja atrás de cobertura total. Também detecta locais ou objetos consagrados ou conspurcados. Usos iguais a 1 + seu modificador de Carisma, recuperados após descanso longo.' },
    { level: 1, name: 'Cura pelas Mãos', description: 'Você tem uma reserva de cura que se renova após descanso longo, capaz de restaurar um total de PV igual a 5 × seu nível de paladino. Com uma ação, toque uma criatura para restaurar PV dessa reserva; também pode gastar 5 pontos para curar uma doença ou neutralizar um veneno. Não afeta mortos-vivos ou constructos.' },
    { level: 2, name: 'Estilo de Luta', description: 'Escolha um estilo de combate. Você não pode escolher o mesmo estilo mais de uma vez.', choices: [{ id: 'estilo-de-luta', name: 'Estilo de Luta', choose: 1, options: paladinStyles }] },
    { level: 2, name: 'Conjuração', description: 'Use Carisma para conjurar magias de paladino. A CD é 8 + seu bônus de proficiência + modificador de Carisma; o ataque mágico é seu bônus de proficiência + modificador de Carisma. Prepare um número de magias igual ao modificador de Carisma + metade do nível de paladino (arredondado para baixo), mínimo 1; pode trocar as magias preparadas após descanso longo. Recupera espaços após descanso longo e pode usar um símbolo sagrado como foco.' },
    { level: 2, name: 'Destruição Divina', description: 'Ao acertar uma criatura com um ataque corpo a corpo com arma, pode gastar um espaço de magia para causar 2d8 de dano radiante adicional, mais 1d8 por nível do espaço acima do 1º, até o máximo de 5d8. Cause 1d8 adicional contra corruptores ou mortos-vivos. Pode gastar espaços de qualquer classe.' },
    { level: 3, name: 'Saúde Divina', description: 'Imunidade a doenças.' },
    { level: 3, name: 'Juramento Sagrado', description: 'Escolha Devoção, Anciões ou Vingança. O juramento concede magias sempre preparadas, duas opções de Canalizar Divindade e características nos níveis 3, 7, 15 e 20. A CD de Canalizar Divindade é a mesma das suas magias de paladino; recupera os usos após descanso curto ou longo.' },
    asi(4),
    { level: 5, name: 'Ataque Extra', description: 'Ataque duas vezes com a ação Atacar.' },
    { level: 6, name: 'Aura de Proteção', description: 'Você e criaturas amigáveis a até 3 m somam seu modificador de Carisma (mínimo +1) aos testes de resistência enquanto você estiver consciente. O alcance aumenta para 9 m no 18º nível.' },
    asi(8),
    { level: 10, name: 'Aura da Coragem', description: 'Você e aliados a até 3 m não podem ficar amedrontados enquanto você estiver consciente. O alcance aumenta para 9 m no 18º nível.' },
    { level: 11, name: 'Destruição Divina Aprimorada', description: 'Todo acerto com arma em um ataque corpo a corpo causa 1d8 de dano radiante adicional, que se acumula com Destruição Divina.' },
    asi(12),
    { level: 14, name: 'Toque Purificador', description: 'Use uma ação para encerrar uma magia em si ou em uma criatura voluntária que tocar. Usos iguais ao seu modificador de Carisma (mínimo 1), recuperados após descanso longo.' },
    asi(16),
    { level: 18, name: 'Aprimoramentos de Aura', description: 'O alcance de suas auras aumenta para 9 m.' },
    asi(19),
  ],
  subclasses: [
    { id: 'juramento-de-devocao', name: 'Juramento de Devoção', selectionLevel: 3, features: [
      { level: 3, name: 'Magias de Juramento', description: 'Proteção contra o bem e mal, santuário; restauração menor, zona da verdade; sinal de esperança, dissipar magia; movimentação livre, guardião da fé; comunhão, coluna de chamas.' },
      { level: 3, name: 'Arma Sagrada', description: 'Como ação, use Canalizar Divindade para, por 1 minuto, somar seu modificador de Carisma (mínimo +1) às jogadas de ataque com uma arma que esteja empunhando. Ela emite luz plena em 6 m e penumbra por mais 6 m e se torna mágica se ainda não for. O efeito termina se você largar ou não estiver portando a arma, ficar inconsciente ou encerrá-lo voluntariamente.' },
      { level: 3, name: 'Expulsar o Profano', description: 'Como ação, use Canalizar Divindade. Cada corruptor ou morto-vivo a até 9 m que possa ver ou ouvir você faz um teste de resistência de Sabedoria; se falhar, fica expulso por 1 minuto ou até sofrer dano.' },
      { level: 7, name: 'Aura de Devoção', description: 'Você e aliados a até 3 m não podem ficar enfeitiçados enquanto você estiver consciente; o alcance aumenta para 9 m no 18º nível.' },
      { level: 15, name: 'Pureza de Espírito', description: 'Você está sempre sob proteção contra o bem e mal.' },
      { level: 20, name: 'Halo Sagrado', description: 'Uma vez por descanso longo, use uma ação para emitir por 1 minuto luz plena em 9 m e penumbra por mais 9 m. Inimigos que começarem o turno na luz plena sofrem 10 de dano radiante; você tem vantagem em testes de resistência contra magias de corruptores e mortos-vivos.' },
    ] },
    { id: 'juramento-dos-ancioes', name: 'Juramento dos Anciões', selectionLevel: 3, features: [
      { level: 3, name: 'Magias de Juramento', description: 'Golpe constritor, falar com animais; raio lunar, passo nebuloso; ampliar plantas, proteção contra energia; tempestade de gelo, pele de pedra; comunhão com a natureza, caminhar em árvores.' },
      { level: 3, name: 'Fúria da Natureza', description: 'Como ação, use Canalizar Divindade para fazer vinhas espectrais prenderem uma criatura que você possa ver a até 3 m. Ela faz um teste de resistência de Força ou Destreza (à escolha dela); se falhar, fica impedida. Repete o teste ao fim de cada turno, encerrando o efeito em caso de sucesso.' },
      { level: 3, name: 'Expulsar os Infiéis', description: 'Como ação, use Canalizar Divindade. Cada fada ou corruptor a até 9 m que possa ver ou ouvir você faz um teste de resistência de Sabedoria; se falhar, fica expulso por 1 minuto ou até sofrer dano.' },
      { level: 7, name: 'Aura de Vigilância', description: 'Você e aliados a até 3 m têm resistência ao dano causado por magias enquanto você estiver consciente; o alcance aumenta para 9 m no 18º nível.' },
      { level: 15, name: 'Sentinela Imortal', description: 'Quando seus pontos de vida forem reduzidos a 0 sem morrer imediatamente, você pode cair para 1 PV. Só pode usar esta característica novamente após um descanso longo. Você também não sofre efeitos de envelhecimento e não pode envelhecer magicamente.' },
      { level: 20, name: 'Campeão dos Anciões', description: 'Uma vez por descanso longo, use uma ação para assumir essa forma por 1 minuto: no início de cada turno, recupera 10 PV; magias de paladino com tempo de conjuração de 1 ação podem ser conjuradas como ação bônus; inimigos a até 3 m têm desvantagem em testes de resistência contra suas magias de paladino e opções de Canalizar Divindade.' },
    ] },
    { id: 'juramento-de-vinganca', name: 'Juramento de Vingança', selectionLevel: 3, features: [
      { level: 3, name: 'Magias de Juramento', description: 'Perdição, marca do caçador; imobilizar pessoa, passo nebuloso; velocidade, proteção contra energia; banimento, porta dimensional; imobilizar monstro, vidência.' },
      { level: 3, name: 'Abjurar Inimigo', description: 'Como ação, use Canalizar Divindade contra uma criatura que possa ver a até 18 m. Ela faz um teste de resistência de Sabedoria (corruptores e mortos-vivos têm desvantagem), a menos que seja imune a amedrontado. Na falha, fica amedrontada, com deslocamento 0 e sem receber benefícios de bônus de deslocamento por 1 minuto ou até sofrer dano; no sucesso, seu deslocamento é reduzido à metade pelo mesmo período.' },
      { level: 3, name: 'Voto de Inimizade', description: 'Como ação, use Canalizar Divindade contra uma criatura que possa ver a até 3 m. Você tem vantagem nas jogadas de ataque contra ela por 1 minuto, até ela cair a 0 PV ou ficar inconsciente.' },
      { level: 7, name: 'Vingador Implacável', description: 'Quando acerta uma criatura com um ataque de oportunidade, pode mover-se até metade do seu deslocamento imediatamente após o ataque, como parte da mesma reação. Esse movimento não provoca ataques de oportunidade.' },
      { level: 15, name: 'Alma de Vingança', description: 'Quando a criatura sob seu Voto de Inimizade fizer um ataque, você pode usar sua reação para fazer um ataque corpo a corpo com arma contra ela, se estiver ao seu alcance.' },
      { level: 20, name: 'Anjo Vingador', description: 'Uma vez por descanso longo, use uma ação para assumir forma angelical por 1 hora: ganha deslocamento de voo de 18 m e emite uma aura ameaçadora em 9 m. Quando uma criatura inimiga entrar na aura pela primeira vez em um turno ou começar o turno nela, deve passar em um teste de resistência de Sabedoria ou ficará amedrontada por 1 minuto ou até sofrer dano. Você tem vantagem nas jogadas de ataque contra criaturas amedrontadas por este efeito.' },
    ] },
  ],
}

const ranger: ClassFeatureData = {
  features: [
    { level: 1, name: 'Inimigo Favorito', description: 'Escolha um tipo de inimigo favorito entre aberrações, bestas, celestiais, constructos, corruptores, dragões, elementais, fadas, gigantes, limos, monstruosidades, mortos-vivos e plantas, ou duas raças humanoides. Você tem vantagem nas jogadas de ataque contra seus inimigos favoritos, em testes de Sabedoria (Sobrevivência) para rastreá-los e em testes de Inteligência para recordar informações sobre eles. Aprende um idioma falado por eles, se houver. Escolhe mais um inimigo favorito e idioma nos níveis 6 e 14.' },
    { level: 1, name: 'Explorador Natural', description: 'Escolha um terreno favorito: ártico, costa, deserto, floresta, montanha, pântano, planície ou subterrâneo. Dobra seu bônus de proficiência em testes de Inteligência ou Sabedoria relacionados a esse terreno quando já for proficiente. Ao viajar por uma hora ou mais nele, o grupo não é atrasado por terreno difícil, não se perde por meios não mágicos e permanece alerta; viajando sozinho, você pode mover-se furtivamente no ritmo normal. Encontra o dobro de comida ao forragear e, ao rastrear, descobre o número exato, os tamanhos e há quanto tempo as criaturas passaram. Escolhe terrenos adicionais nos níveis 6 e 10.' },
    { level: 2, name: 'Estilo de Luta', description: 'Escolha Arquearia, Combate com Duas Armas, Defesa ou Duelismo.', choices: [{ id: 'estilo-de-luta', name: 'Estilo de Luta', choose: 1, options: rangerStyles }] },
    { level: 2, name: 'Conjuração', description: 'Aprende magias de patrulheiro e as conjura usando Sabedoria. A CD é 8 + seu bônus de proficiência + modificador de Sabedoria; o ataque mágico é seu bônus de proficiência + modificador de Sabedoria. Aprende magias, não as prepara, e pode trocar uma magia conhecida por outra de nível para o qual tenha espaços ao ganhar um nível de patrulheiro. Recupera todos os espaços após descanso longo.' },
    { level: 3, name: 'Arquétipo de Patrulheiro', description: 'Escolha um arquétipo que concede características nos níveis 3, 7, 11 e 15.' },
    { level: 3, name: 'Prontidão Primitiva', description: 'Com uma ação e gastando um espaço de magia de patrulheiro, você detecta por 1 minuto por nível do espaço a presença de aberrações, celestiais, corruptores, dragões, elementais, fadas e mortos-vivos a até 1,5 km (ou 10 km no seu terreno favorito). A característica não revela a localização nem o número das criaturas.' },
    asi(4),
    { level: 5, name: 'Ataque Extra', description: 'Ataque duas vezes com a ação Atacar.' },
    { level: 6, name: 'Aprimoramentos de Inimigo Favorito e Explorador Natural', description: 'Escolha mais um inimigo favorito, idioma e terreno favorito.' },
    asi(8),
    { level: 8, name: 'Caminho da Floresta', description: 'Terreno difícil não mágico não custa deslocamento extra. Você pode atravessar plantas não mágicas sem redução de deslocamento nem dano; tem vantagem em testes de resistência contra plantas mágicas que tentem impedir seu movimento.' },
    { level: 10, name: 'Aprimoramento de Explorador Natural', description: 'Escolha mais um terreno favorito.' },
    { level: 10, name: 'Mimetismo', description: 'Após passar 1 minuto criando camuflagem natural, pode tentar se esconder encostado em uma superfície sólida natural, como uma árvore ou parede de pedra, grande o suficiente para cobri-lo. Enquanto permanecer imóvel e sem realizar ações, recebe +10 em testes de Destreza (Furtividade). Mover-se, realizar uma ação ou uma reação exige que você refaça a camuflagem.' },
    asi(12),
    { level: 14, name: 'Aprimoramento de Inimigo Favorito', description: 'Escolha mais um inimigo favorito e idioma.' },
    { level: 14, name: 'Desaparecer', description: 'Você pode usar a ação Esconder como uma ação bônus. Além disso, não pode ser rastreado por meios não mágicos, a menos que decida deixar um rastro.' },
    asi(16),
    { level: 18, name: 'Sentidos Selvagens', description: 'Você não sofre desvantagem em ataques contra criaturas que não possa ver. Também percebe a localização de criaturas invisíveis a até 9 m, desde que não estejam escondidas e você não esteja cego ou surdo.' },
    asi(19),
    { level: 20, name: 'Matador de Inimigos', description: 'Uma vez em cada um dos seus turnos, ao fazer uma jogada de ataque ou de dano contra um inimigo favorito, pode somar seu modificador de Sabedoria ao resultado. Escolha depois de rolar, mas antes de os efeitos da rolagem serem aplicados.' },
  ],
  subclasses: [
    { id: 'cacador', name: 'Caçador', selectionLevel: 3, features: [
      { level: 3, name: 'Presa do Caçador', description: 'Escolha uma técnica ofensiva.', choices: [{ id: 'presa', name: 'Presa do Caçador', choose: 1, options: [
        option('assassino-de-colossos', 'Assassino de Colossos', 'Uma vez por turno, ao atingir com uma arma uma criatura que esteja abaixo do máximo de pontos de vida, cause 1d8 de dano adicional.'), option('matador-de-gigantes', 'Matador de Gigantes', 'Quando uma criatura Grande ou maior a até 1,5 m acertar ou errar um ataque contra você, use sua reação para atacá-la com uma arma corpo a corpo, se puder vê-la.'), option('destruidor-de-hordas', 'Destruidor de Hordas', 'Uma vez por turno, ao fazer um ataque com arma, faça outro ataque com a mesma arma contra uma criatura diferente a até 1,5 m do alvo original e dentro do seu alcance.'),
      ] }] },
      { level: 7, name: 'Táticas Defensivas', description: 'Escolha uma defesa.', choices: [{ id: 'tatica', name: 'Tática Defensiva', choose: 1, options: [
        option('escapar-da-horda', 'Escapar da Horda', 'Ataques de oportunidade contra você têm desvantagem.'), option('defesa-multiplos', 'Defesa Contra Múltiplos Ataques', 'Depois que uma criatura atingi-lo com um ataque, recebe +4 de bônus na CA contra todos os ataques subsequentes daquela criatura até o fim do turno.'), option('vontade-de-aco', 'Vontade de Aço', 'Vantagem em testes de resistência contra ficar amedrontado.'),
      ] }] },
      { level: 11, name: 'Ataque Múltiplo', description: 'Escolha uma técnica de múltiplos alvos.', choices: [{ id: 'multiplo', name: 'Ataque Múltiplo', choose: 1, options: [
        option('saraivada', 'Saraivada', 'Use sua ação para fazer um ataque à distância contra qualquer número de criaturas a até 3 m de um ponto visível dentro do alcance da arma; faça uma jogada de ataque separada para cada alvo.'), option('ataque-giratorio', 'Ataque Giratório', 'Use sua ação para fazer um ataque corpo a corpo contra qualquer número de criaturas a até 1,5 m; faça uma jogada de ataque separada para cada alvo.'),
      ] }] },
      { level: 15, name: 'Defesa de Caçador Superior', description: 'Escolha uma defesa superior.', choices: [{ id: 'defesa-superior', name: 'Defesa Superior', choose: 1, options: [
        option('evasao', 'Evasão', 'Quando um efeito permitir um teste de resistência de Destreza para sofrer metade do dano, não sofre dano se passar e metade se falhar.'), option('contra-mare', 'Manter-se Contra a Maré', 'Quando uma criatura hostil errar um ataque corpo a corpo contra você, use sua reação para fazer com que ela repita o ataque contra outra criatura à sua escolha (que não seja ela mesma).'), option('esquiva', 'Esquiva Sobrenatural', 'Quando um atacante que você possa ver o atingir com um ataque, use sua reação para reduzir à metade o dano sofrido.'),
      ] }] },
    ] },
    { id: 'mestre-das-bestas', name: 'Mestre das Bestas', selectionLevel: 3, features: [
      { level: 3, name: 'Companheiro de Patrulha', description: 'Vincule-se a uma besta Média ou menor de ND 1/4 ou inferior. Some seu bônus de proficiência à CA, jogadas de ataque e dano, testes de resistência e perícias em que ela seja proficiente; os PV máximos são o maior entre os normais da besta e 4 × seu nível de patrulheiro. Ela compartilha sua iniciativa, age sem comando apenas para se mover e usar reações, e não realiza ações sem comando (exceto quando você estiver incapacitado ou ausente, caso em que age para se defender). Você pode comandá-la verbalmente para se mover sem gastar ação; com uma ação, ordene Atacar, Disparada, Desengajar, Esquivar ou Ajuda. Ao obter Ataque Extra, pode fazer um ataque com arma ao comandá-la para Atacar. Ela pode gastar Dados de Vida em descanso curto; se morrer, você pode formar vínculo com outra besta não hostil após 8 horas. Ao viajar sozinho por seu terreno favorito, vocês podem mover-se furtivamente no ritmo normal.' },
      { level: 7, name: 'Treinamento Excepcional', description: 'Em qualquer turno em que o companheiro não tenha atacado, você pode usar uma ação bônus para comandá-lo a Disparada, Desengajar, Esquivar ou Ajuda.' },
      { level: 11, name: 'Fúria Bestial', description: 'Quando comandado a usar Atacar, o companheiro pode fazer dois ataques ou usar Ataque Múltiplo, se possuir essa ação.' },
      { level: 15, name: 'Compartilhar Magias', description: 'Ao conjurar uma magia que tenha você como alvo, também pode afetar seu companheiro se ele estiver a até 9 m.' },
    ] },
  ],
}

export const classFeatures: Record<string, ClassFeatureData> = {
  bardo: bard,
  bruxo: warlock,
  clerigo: cleric,
  druida: druid,
  feiticeiro: sorcerer,
  guerreiro: fighter,
  ladino: rogue,
  mago: wizard,
  monge: monk,
  paladino: paladin,
  patrulheiro: ranger,
}

export function getSpellSlotsAtClassLevel(className: string, subclassId: string, classLevel: number): number[] {
  if (classLevel < 1 || classLevel > 20) return []
  const index = classLevel - 1
  if (className === 'bardo') return bardSpellProgression[index]?.[2] ?? []
  if (className === 'bruxo') {
    const row = warlockSpellProgression[index]
    const slotLevel = row?.[3] ?? 0
    return Array.from({ length: slotLevel }, (_, slotIndex) => slotIndex === slotLevel - 1 ? row?.[2] ?? 0 : 0)
  }
  if (className === 'clerigo') return clericSpellProgression[index]?.[1] ?? []
  if (className === 'druida') return druidSpellProgression[index]?.[1] ?? []
  if (className === 'feiticeiro') return sorcererSpellProgression[index]?.[2] ?? []
  if (className === 'mago') return wizardSpellProgression[index]?.[1] ?? []
  if (className === 'paladino') return paladinSpellProgression[index] ?? []
  if (className === 'patrulheiro') return rangerSpellProgression[index]?.[1] ?? []
  if (className === 'guerreiro' && subclassId === 'cavaleiro-arcano' && classLevel >= 3) {
    return eldritchKnightSpellProgression[classLevel - 3]?.[2] ?? []
  }
  if (className === 'ladino' && subclassId === 'trapaceiro-arcano' && classLevel >= 3) {
    return arcaneTricksterSpellProgression[classLevel - 3]?.[2] ?? []
  }
  return []
}

export function getKnownSpellCountAtClassLevel(className: string, subclassId: string, classLevel: number): number | null {
  if (classLevel < 1 || classLevel > 20) return classLevel < 1 ? 0 : null
  const index = classLevel - 1
  if (className === 'bardo') return bardSpellProgression[index]?.[1] ?? 0
  if (className === 'bruxo') return warlockSpellProgression[index]?.[1] ?? 0
  if (className === 'feiticeiro') return sorcererSpellProgression[index]?.[1] ?? 0
  if (className === 'mago') return 6 + (classLevel - 1) * 2
  if (className === 'patrulheiro') return rangerSpellProgression[index]?.[0] ?? 0
  if (className === 'guerreiro' && subclassId === 'cavaleiro-arcano' && classLevel >= 3) {
    return eldritchKnightSpellProgression[classLevel - 3]?.[1] ?? 0
  }
  if (className === 'ladino' && subclassId === 'trapaceiro-arcano' && classLevel >= 3) {
    return arcaneTricksterSpellProgression[classLevel - 3]?.[1] ?? 0
  }
  return null
}

export function getMaximumSpellCountAtOrAboveLevel(
  className: string,
  subclassId: string,
  classLevel: number,
  spellLevel: number,
): number | null {
  const knownSpellCount = getKnownSpellCountAtClassLevel(className, subclassId, classLevel)
  if (knownSpellCount === null) return null
  if (spellLevel <= 1) return knownSpellCount

  let firstAccessLevel = 0
  for (let level = 1; level <= classLevel; level += 1) {
    if ((getSpellSlotsAtClassLevel(className, subclassId, level)[spellLevel - 1] ?? 0) > 0) {
      firstAccessLevel = level
      break
    }
  }
  if (!firstAccessLevel) return 0

  const knownBeforeAccess = getKnownSpellCountAtClassLevel(className, subclassId, firstAccessLevel - 1) ?? 0
  const replacements = className === 'mago' ? 0 : classLevel - firstAccessLevel + 1
  const minimumLowerLevelSpells = Math.max(0, knownBeforeAccess - replacements)
  return Math.max(0, knownSpellCount - minimumLowerLevelSpells)
}

export function getSpellLearningThreshold(className: string, subclassId: string, spellLevel: number): number | null {
  if (spellLevel < 1) return 0
  for (let classLevel = 1; classLevel <= 20; classLevel += 1) {
    if ((getSpellSlotsAtClassLevel(className, subclassId, classLevel)[spellLevel - 1] ?? 0) > 0) {
      return getKnownSpellCountAtClassLevel(className, subclassId, classLevel - 1)
    }
  }
  return null
}

export default classFeatures
