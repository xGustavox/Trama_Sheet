export type Feat = {
  id: string
  name: string
  prerequisite: string
  description: string
  repeatable?: boolean
  abilityBonus?: { ability: string } | { chooseFrom: string[] }
}

export function getFeatAbilityBonus(feat: Feat, abilities: Record<string, string>, selectedAbility?: string) {
  const bonus = feat.abilityBonus
  const ability = bonus && ('ability' in bonus ? bonus.ability : selectedAbility && bonus.chooseFrom.includes(selectedAbility) ? selectedAbility : undefined)
  if (!ability || !abilities[ability]) return null
  const score = Number(abilities[ability])
  if (!Number.isInteger(score) || score < 1 || score > 20) return null
  return { ability, amount: Math.max(0, Math.min(1, 20 - score)) }
}

export function getFeatPrerequisiteFailure(
  feat: Feat,
  abilities: Record<string, string>,
  canCastSpells: boolean,
  armorProficiencies: string[],
) {
  const score = (ability: string) => Number(abilities[ability] || 0)
  const hasArmor = (type: string) => armorProficiencies.some((proficiency) =>
    proficiency.toLocaleLowerCase('pt-BR').includes(type) || proficiency.toLocaleLowerCase('pt-BR').includes('todas as armaduras'),
  )
  switch (feat.id) {
    case 'adepto-elemental':
    case 'atirador-de-magia':
    case 'conjurador-de-guerra':
      return canCastSpells ? '' : 'Capacidade de conjurar pelo menos uma magia.'
    case 'conjurador-de-ritual':
      return score('intelligence') >= 13 || score('wisdom') >= 13 ? '' : 'Inteligência ou Sabedoria 13 ou maior.'
    case 'duelista-defensivo':
    case 'sorrateiro':
      return score('dexterity') >= 13 ? '' : 'Destreza 13 ou maior.'
    case 'imobilizador':
      return score('strength') >= 13 ? '' : 'Força 13 ou maior.'
    case 'lider-inspirador':
      return score('charisma') >= 13 ? '' : 'Carisma 13 ou maior.'
    case 'maestria-em-armadura-media':
      return hasArmor('armaduras médias') ? '' : 'Proficiência em armadura média.'
    case 'maestria-em-armadura-pesada':
      return hasArmor('armaduras pesadas') ? '' : 'Proficiência em armadura pesada.'
    case 'protecao-moderada':
      return hasArmor('armaduras leves') ? '' : 'Proficiência em armadura leve.'
    case 'protecao-pesada':
      return hasArmor('armaduras médias') ? '' : 'Proficiência em armadura média.'
    default:
      return ''
  }
}

export const feats: Feat[] = [
  { id: 'adepto-elemental', name: 'Adepto Elemental', prerequisite: 'Capacidade de conjurar pelo menos uma magia', description: 'Escolha ácido, elétrico, fogo, frio ou trovão. Suas magias ignoram resistência ao tipo escolhido; ao rolar dano desse tipo para uma magia, trate qualquer 1 num dado de dano como 2.', repeatable: true },
  { id: 'adepto-marcial', name: 'Adepto Marcial', prerequisite: 'Nenhum', description: 'Aprenda duas manobras do Mestre de Batalha e receba um dado de superioridade (ou um dado adicional, se já possuir).', repeatable: false },
  { id: 'alerta', name: 'Alerta', prerequisite: 'Nenhum', description: '+5 em iniciativa; não pode ser surpreendido enquanto consciente; criaturas escondidas não ganham vantagem em ataques contra você.' },
  { id: 'ambidestro', name: 'Ambidestro', prerequisite: 'Nenhum', description: '+1 na CA lutando com uma arma corpo a corpo em cada mão; permite lutar com duas armas não leves e sacar ou guardar duas armas juntas.' },
  { id: 'atacante-bestial', name: 'Atacante Bestial', prerequisite: 'Nenhum', description: 'Uma vez por turno, ao rolar dano de ataque corpo a corpo com arma, role novamente o dado de dano da arma e use qualquer resultado.' },
  { id: 'atirador-agucado', name: 'Atirador Aguçado', prerequisite: 'Nenhum', description: 'Ignora desvantagem por alcance longo e meia-cobertura/cobertura de três quartos; pode sofrer –5 no ataque à distância para causar +10 de dano se acertar.' },
  { id: 'atirador-de-magia', name: 'Atirador de Magia', prerequisite: 'Capacidade de conjurar pelo menos uma magia', description: 'Dobra o alcance de magias com jogada de ataque, ignora meia-cobertura e cobertura de três quartos em ataques mágicos à distância e aprende um truque com jogada de ataque.' },
  { id: 'atleta', name: 'Atleta', prerequisite: 'Nenhum', description: 'Força ou Destreza +1 (máximo 20). Levantar-se custa 1,5 m; escalar não custa movimento adicional; saltos com corrida exigem 1,5 m de preparação.', abilityBonus: { chooseFrom: ['strength', 'dexterity'] } },
  { id: 'ator', name: 'Ator', prerequisite: 'Nenhum', description: 'Carisma +1 (máximo 20); vantagem em Atuação e Enganação para se passar por outra pessoa e capacidade de imitar fala e sons.', abilityBonus: { ability: 'charisma' } },
  { id: 'combatente-montado', name: 'Combatente Montado', prerequisite: 'Nenhum', description: 'Vantagem em ataques corpo a corpo contra criaturas menores enquanto montado; pode redirecionar ataques contra a montaria e melhora sua defesa contra efeitos de Destreza.' },
  { id: 'conjurador-de-guerra', name: 'Conjurador de Guerra', prerequisite: 'Capacidade de conjurar pelo menos uma magia', description: 'Vantagem para manter concentração ao sofrer dano; componentes somáticos com armas ou escudo nas mãos; pode conjurar magia de ação como ataque de oportunidade.' },
  { id: 'conjurador-de-ritual', name: 'Conjurador de Ritual', prerequisite: 'Inteligência ou Sabedoria 13 ou maior', description: 'Escolha uma classe conjuradora e duas magias de 1º nível com descritor ritual para um livro de rituais; pode copiar outros rituais dessa lista.' },
  { id: 'curandeiro', name: 'Curandeiro', prerequisite: 'Nenhum', description: 'Kit de primeiros-socorros estabiliza e restaura 1 PV; com uma ação e um uso, cura 1d6 + 4 + Dados de Vida da criatura (uma vez por descanso curto ou longo por criatura).' },
  { id: 'duelista-defensivo', name: 'Duelista Defensivo', prerequisite: 'Destreza 13 ou maior', description: 'Com arma de acuidade, use sua reação ao ser atingido por ataque corpo a corpo para adicionar o bônus de proficiência à CA contra esse ataque.' },
  { id: 'especialista-em-besta', name: 'Especialista em Besta', prerequisite: 'Nenhum', description: 'Ignora recarga de bestas proficientes; ataques à distância não têm desvantagem por inimigo próximo; pode atacar com besta de mão como ação bônus.' },
  { id: 'especialista-em-briga', name: 'Especialista em Briga', prerequisite: 'Nenhum', description: 'Força ou Constituição +1 (máximo 20); ataques desarmados causam 1d4 e, ao acertar com ataque desarmado ou arma improvisada, pode agarrar como ação bônus.', abilityBonus: { chooseFrom: ['strength', 'constitution'] } },
  { id: 'explorador-de-cavernas', name: 'Explorador de Cavernas', prerequisite: 'Nenhum', description: 'Vantagem para detectar portas secretas e contra armadilhas; resistência ao dano de armadilhas; pode procurar armadilhas em ritmo normal.' },
  { id: 'imobilizador', name: 'Imobilizador', prerequisite: 'Força 13 ou maior', description: 'Vantagem em ataques contra criaturas agarradas; pode tentar imobilizar uma criatura agarrada.' },
  { id: 'iniciado-em-magia', name: 'Iniciado em Magia', prerequisite: 'Nenhum', description: 'Escolha uma classe conjuradora; aprenda dois truques e uma magia de 1º nível da lista dela, que pode conjurar uma vez por descanso longo.' },
  { id: 'investida-poderosa', name: 'Investida Poderosa', prerequisite: 'Nenhum', description: 'Após Disparada, pode atacar ou empurrar como ação bônus; após correr 3 m em linha reta, recebe +5 de dano ou empurra até 3 m.' },
  { id: 'lider-inspirador', name: 'Líder Inspirador', prerequisite: 'Carisma 13 ou maior', description: 'Após 10 minutos, até seis criaturas amigáveis recebem PV temporários iguais ao seu nível + modificador de Carisma; recuperam após descanso curto ou longo.' },
  { id: 'maestria-em-arma-de-haste', name: 'Maestria em Arma de Haste', prerequisite: 'Nenhum', description: 'Ataque com a outra extremidade de glaive, alabarda ou bordão como ação bônus; certas armas de haste permitem ataques de oportunidade ao entrar no alcance.' },
  { id: 'maestria-em-armadura-media', name: 'Maestria em Armadura Média', prerequisite: 'Proficiência em armadura média', description: 'Armadura média não impõe desvantagem em Furtividade; com Destreza 16+, adiciona +3 à CA em vez de +2.' },
  { id: 'maestria-em-armadura-pesada', name: 'Maestria em Armadura Pesada', prerequisite: 'Proficiência em armadura pesada', description: 'Força +1 (máximo 20); reduz em 3 o dano não mágico de concussão, cortante e perfurante enquanto usa armadura pesada.', abilityBonus: { ability: 'strength' } },
  { id: 'matador-de-conjuradores', name: 'Matador de Conjuradores', prerequisite: 'Nenhum', description: 'Pode atacar como reação quando criatura adjacente conjura; alvos feridos têm desvantagem para manter concentração; vantagem contra magias de criaturas adjacentes.' },
  { id: 'mente-afiada', name: 'Mente Afiada', prerequisite: 'Nenhum', description: 'Inteligência +1 (máximo 20); sabe o norte, tempo até nascer/pôr do sol e recorda com precisão o último mês.', abilityBonus: { ability: 'intelligence' } },
  { id: 'mestre-de-armas', name: 'Mestre de Armas', prerequisite: 'Nenhum', description: 'Força ou Destreza +1 (máximo 20); ganha proficiência com quatro armas simples ou marciais escolhidas.', abilityBonus: { chooseFrom: ['strength', 'dexterity'] } },
  { id: 'mestre-de-armas-grandes', name: 'Mestre de Armas Grandes', prerequisite: 'Nenhum', description: 'Após acerto crítico ou reduzir criatura a 0 PV, pode atacar como ação bônus; pode sofrer –5 no ataque com arma pesada para causar +10 de dano.' },
  { id: 'mestre-de-escudo', name: 'Mestre de Escudo', prerequisite: 'Nenhum', description: 'Com escudo, pode empurrar como ação bônus após Ataque, melhorar testes de Destreza e usar reação para reduzir dano de efeitos de Destreza.' },
  { id: 'mobilidade', name: 'Mobilidade', prerequisite: 'Nenhum', description: 'Deslocamento +3 m; terreno difícil não custa movimento adicional ao Disparar; após atacar criatura corpo a corpo, ela não provoca ataques de oportunidade seus neste turno.' },
  { id: 'observador', name: 'Observador', prerequisite: 'Nenhum', description: 'Inteligência ou Sabedoria +1 (máximo 20); pode ler lábios e recebe +5 em Percepção passiva e Investigação passiva.', abilityBonus: { chooseFrom: ['intelligence', 'wisdom'] } },
  { id: 'perito', name: 'Perito', prerequisite: 'Nenhum', description: 'Ganha proficiência em qualquer combinação de três perícias ou ferramentas.' },
  { id: 'poliglota', name: 'Poliglota', prerequisite: 'Nenhum', description: 'Inteligência +1 (máximo 20); aprende três idiomas e pode criar criptogramas.', abilityBonus: { ability: 'intelligence' } },
  { id: 'protecao-leve', name: 'Proteção Leve', prerequisite: 'Nenhum', description: 'Força +1 (máximo 20) e proficiência com armaduras leves.', abilityBonus: { ability: 'strength' } },
  { id: 'protecao-moderada', name: 'Proteção Moderada', prerequisite: 'Proficiência em armadura leve', description: 'Força +1 (máximo 20) e proficiência com armaduras médias e escudos.', abilityBonus: { ability: 'strength' } },
  { id: 'protecao-pesada', name: 'Proteção Pesada', prerequisite: 'Proficiência em armadura média', description: 'Força +1 (máximo 20) e proficiência com armaduras pesadas.', abilityBonus: { ability: 'strength' } },
  { id: 'resiliente', name: 'Resiliente', prerequisite: 'Nenhum', description: 'Escolha um valor de habilidade: ele aumenta +1 (máximo 20) e você ganha proficiência em testes de resistência dessa habilidade.', abilityBonus: { chooseFrom: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] } },
  { id: 'resistente', name: 'Resistente', prerequisite: 'Nenhum', description: 'Constituição +1 (máximo 20); ao rolar Dado de Vida para recuperar PV, o mínimo é duas vezes seu modificador de Constituição (mínimo 2).', abilityBonus: { ability: 'constitution' } },
  { id: 'robusto', name: 'Robusto', prerequisite: 'Nenhum', description: 'Seu máximo de PV aumenta em duas vezes seu nível e aumenta em mais 2 a cada nível posterior.' },
  { id: 'sentinela', name: 'Sentinela', prerequisite: 'Nenhum', description: 'Ataques de oportunidade reduzem deslocamento a 0; criaturas provocam mesmo ao Desengajar; pode usar reação para atacar quem ataca um aliado adjacente.' },
  { id: 'sorrateiro', name: 'Sorrateiro', prerequisite: 'Destreza 13 ou maior', description: 'Pode se esconder quando levemente obscurecido; errar ataque à distância escondido não revela sua posição; penumbra não impõe desvantagem em Percepção visual.' },
  { id: 'sortudo', name: 'Sortudo', prerequisite: 'Nenhum', description: 'Recebe 3 pontos de sorte para rolar d20 adicional em ataques, testes ou resistências, ou interferir em ataques contra você; recupera em descanso longo.' },
]
