import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import Cropper, { type ReactCropperElement } from 'react-cropper'
import { createPortal } from 'react-dom'
import { AppSidebar, type SidebarSection } from './AppSidebar'
import { arcaneTricksterSpellProgression, bardSpellProgression, clericSpellProgression, classFeatures, classHitDice, druidSpellProgression, eldritchKnightSpellProgression, getKnownSpellCountAtClassLevel, getMaximumSpellCountAtOrAboveLevel, getSpellSlotsAtClassLevel, monkProgression, paladinSpellProgression, rebaseClassFeatureChoicesForSubclass, rangerSpellProgression, rogueSneakAttackProgression, sorcererSpellProgression, warlockInvocationIsAvailable, warlockSpellProgression, wizardSpellProgression, type ClassFeature, type ClassFeatureData, type ClassSubclass } from '../lib/classFeatures'
import { supabase } from '../lib/supabase'
import { feats, getFeatAbilityBonus, getFeatPrerequisiteFailure } from '../lib/feats'
import { canSelectSpellAtSlot, groupSpellChoicesByLevel } from '../lib/spellSelection'
import type { AbilityScoreMethod, CharacterDetails, CharacterDraft, PrimalPath, PrimalTotem, PrimalTotemChoices } from '../lib/characterData'
import { experienceThresholds, levelForExperience } from '../lib/experience'
import { Button } from './Button'
import { EquipmentEditor } from './EquipmentEditor'
import { Modal } from './Modal'
import { useToast } from './ToastContext'
import { equipmentGrantFingerprint, readInventory } from '../lib/equipment'
import { useEquipmentCatalog } from '../lib/useEquipmentCatalog'
import { classArmorProficiencies } from '../lib/classArmorProficiencies'
import { startingEquipmentPlan, type EquipmentContext } from '../lib/startingEquipment'
import { cantripsByClass, getAlwaysPreparedSpells, getGrantedClassCantrips, getRitualSpellOptions, getSpellListForSelection, spellcastingAbilityByClass } from '../lib/spellCatalog'
import { getSpellDetails } from '../lib/spellDetails'
import { ancientSecretsRitualChoiceKey, isValidAncientSecretsRitualSelection, isValidPactTomeCantripSelection, warlockPactChoiceKey, warlockTomeCantripChoiceKey } from '../lib/pactTome'
import 'cropperjs/dist/cropper.css'
import './CharacterCreationWizard.css'
import { PactTomeCantripDrawer } from './PactTomeCantripDrawer'
import { SpellSelectionDrawer } from './SpellSelectionDrawer'

type ReferenceItem = {
  id: string
  name: string
}

const steps = [
  'Básico',
  'Raça',
  'Classe',
  'Características',
  'Equipamentos',
  'Magias',
]

let pendingFeatureScrollCleanup: (() => void) | null = null
let activeFeatureHighlight: { target: HTMLElement; timeout: number } | null = null

function scrollToClassFeature(target: HTMLElement) {
  pendingFeatureScrollCleanup?.()
  if (activeFeatureHighlight) {
    window.clearTimeout(activeFeatureHighlight.timeout)
    activeFeatureHighlight.target.classList.remove('wizard__class-feature--highlight')
    activeFeatureHighlight = null
  }

  let settleTimeout = 0
  let fallbackTimeout = 0
  let finished = false
  const cleanup = () => {
    window.clearTimeout(settleTimeout)
    window.clearTimeout(fallbackTimeout)
    document.removeEventListener('scrollend', finish)
    document.removeEventListener('scroll', onScroll, true)
    pendingFeatureScrollCleanup = null
  }
  const finish = () => {
    if (finished) return
    finished = true
    cleanup()
    target.classList.remove('wizard__class-feature--highlight')
    void target.offsetWidth
    target.classList.add('wizard__class-feature--highlight')
    const timeout = window.setTimeout(() => {
      target.classList.remove('wizard__class-feature--highlight')
      activeFeatureHighlight = null
    }, 1100)
    activeFeatureHighlight = { target, timeout }
  }
  const onScroll = () => {
    window.clearTimeout(settleTimeout)
    settleTimeout = window.setTimeout(finish, 140)
  }
  const wasCentered = (() => {
    const rect = target.getBoundingClientRect()
    return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2) < 4
  })()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  document.addEventListener('scrollend', finish)
  document.addEventListener('scroll', onScroll, true)
  pendingFeatureScrollCleanup = cleanup
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  target.focus({ preventScroll: true })

  if (wasCentered || reduceMotion) finish()
  else fallbackTimeout = window.setTimeout(finish, 2000)
}

const barbarianFeatures = [
  { level: 1, name: 'Fúria', description: 'Com uma ação bônus, entre em fúria por até 1 minuto, desde que não esteja usando armadura pesada. Enquanto durar, você tem vantagem em testes e testes de resistência de Força, recebe o bônus de dano de Fúria em ataques corpo a corpo usando Força (+2, que aumenta para +3 no 9º nível e +4 no 16º) e tem resistência a dano de concussão, cortante e perfurante. Não pode conjurar magias nem manter concentração. A fúria termina se ficar inconsciente, se terminar um turno sem atacar uma criatura hostil nem sofrer dano desde seu turno anterior, ou se encerrá-la com uma ação bônus. Recupera os usos após um descanso longo.' },
  { level: 1, name: 'Defesa sem Armadura', description: 'Sem armadura, sua CA é 10 + modificador de Destreza + modificador de Constituição. Você ainda pode usar escudo.' },
  { level: 2, name: 'Ataque Descuidado', description: 'No primeiro ataque do turno, você pode atacar descuidadamente: ganha vantagem nos ataques corpo a corpo usando Força até o fim do turno, mas ataques contra você têm vantagem até seu próximo turno.' },
  { level: 2, name: 'Sentido de Perigo', description: 'Você tem vantagem em salvaguardas de Destreza contra efeitos que possa ver. Não funciona se estiver cego, surdo ou incapacitado.' },
  { level: 3, name: 'Caminho Primitivo', description: 'Escolha o caminho que molda sua fúria. Ele concede características adicionais nos níveis 3, 6, 10 e 14.' },
  { level: 4, name: 'Incremento no Valor de Habilidade', description: 'Aumente um valor de habilidade em 2 ou dois valores em 1. Um valor não pode passar de 20 por esta característica.' },
  { level: 5, name: 'Ataque Extra', description: 'Ao realizar a ação de Ataque, você pode atacar duas vezes em vez de uma.' },
  { level: 5, name: 'Movimento Rápido', description: 'Seu deslocamento aumenta em 3 metros enquanto não estiver usando armadura pesada.' },
  { level: 6, name: 'Característica de Caminho Primitivo', description: 'Você recebe uma característica do caminho primitivo escolhido.' },
  { level: 7, name: 'Instinto Selvagem', description: 'Você tem vantagem nas jogadas de iniciativa. Se estiver surpreso e não incapacitado, pode agir no primeiro turno se entrar em fúria antes de qualquer outra ação.' },
  { level: 8, name: 'Incremento no Valor de Habilidade', description: 'Aumente um valor de habilidade em 2 ou dois valores em 1. Um valor não pode passar de 20 por esta característica.' },
  { level: 9, name: 'Crítico Brutal (+1 dado)', description: 'Ao determinar o dano extra de um acerto crítico com arma corpo a corpo, role um dado adicional de dano da arma.' },
  { level: 10, name: 'Característica de Caminho Primitivo', description: 'Você recebe uma característica do caminho primitivo escolhido.' },
  { level: 11, name: 'Fúria Implacável', description: 'Se cair a 0 PV durante a fúria sem morrer, faça uma salvaguarda de Constituição CD 10 para ficar com 1 PV. A CD aumenta em 5 a cada uso após o primeiro e volta a 10 após descanso curto ou longo.' },
  { level: 12, name: 'Incremento no Valor de Habilidade', description: 'Aumente um valor de habilidade em 2 ou dois valores em 1. Um valor não pode passar de 20 por esta característica.' },
  { level: 13, name: 'Crítico Brutal (+2 dados)', description: 'Ao determinar o dano extra de um acerto crítico com arma corpo a corpo, role dois dados adicionais de dano da arma.' },
  { level: 14, name: 'Característica de Caminho Primitivo', description: 'Você recebe uma característica do caminho primitivo escolhido.' },
  { level: 15, name: 'Fúria Persistente', description: 'Sua fúria só termina prematuramente se você ficar inconsciente ou decidir encerrá-la.' },
  { level: 16, name: 'Incremento no Valor de Habilidade', description: 'Aumente um valor de habilidade em 2 ou dois valores em 1. Um valor não pode passar de 20 por esta característica.' },
  { level: 17, name: 'Crítico Brutal (+3 dados)', description: 'Ao determinar o dano extra de um acerto crítico com arma corpo a corpo, role três dados adicionais de dano da arma.' },
  { level: 18, name: 'Força Indomável', description: 'Se o resultado total de um teste de Força for menor que seu valor de Força, você pode usar seu valor de Força no lugar do resultado total.' },
  { level: 19, name: 'Incremento no Valor de Habilidade', description: 'Aumente um valor de habilidade em 2 ou dois valores em 1. Um valor não pode passar de 20 por esta característica.' },
  { level: 20, name: 'Campeão Primitivo', description: 'Força e Constituição aumentam em 4, e o máximo desses valores passa a ser 24.' },
]

const barbarianPathFeatures: Record<Exclude<PrimalPath, ''>, {
  level: number
  name: string
  description: string
  choice?: { key: keyof PrimalTotemChoices; prompt: string; options: { id: PrimalTotem; name: string; description: string }[] }
}[]> = {
  berserker: [
    { level: 3, name: 'Frenesi', description: 'Ao entrar em fúria, você pode entrar em frenesi. Durante a fúria, pode fazer um ataque corpo a corpo com arma como ação bônus em cada turno após este. Quando a fúria termina, sofre um nível de exaustão.' },
    { level: 6, name: 'Fúria Inconsciente', description: 'Enquanto estiver em fúria, você não pode ser enfeitiçado ou amedrontado. Se já estiver sob um desses efeitos ao entrar em fúria, ele fica suspenso durante ela.' },
    { level: 10, name: 'Presença Intimidante', description: 'Use sua ação para amedrontar uma criatura que possa ver a até 9 m. Se ela puder ver ou ouvir você, faz uma salvaguarda de Sabedoria (CD 8 + bônus de proficiência + modificador de Carisma). Em falha, fica amedrontada até o fim do seu próximo turno. Nos turnos seguintes, você pode usar sua ação para estender o efeito até o início do próximo turno; ele termina se a criatura sair da sua linha de visão ou ficar a mais de 18 m. Em sucesso, ela fica imune a esta característica por 24 horas.' },
    { level: 14, name: 'Retaliação', description: 'Quando sofrer dano de uma criatura a até 1,5 metro de você, pode usar sua reação para realizar um ataque corpo a corpo com arma contra ela.' },
  ],
  'totem-warrior': [
    { level: 3, name: 'Conselheiro Espiritual', description: 'Você pode conjurar sentido bestial e falar com animais, mas apenas como rituais.' },
    {
      level: 3,
      name: 'Totem Espiritual',
      description: 'Escolha um animal para seu totem espiritual e crie ou adquira um objeto físico que o represente. O animal pode ser um dos listados ou outro apropriado à sua terra natal.',
      choice: {
        key: 'spiritualTotem',
        prompt: 'Escolha seu totem espiritual',
        options: [
          { id: 'eagle', name: 'Águia', description: 'Durante a fúria, sem armadura pesada, criaturas têm desvantagem em ataques de oportunidade contra você; você pode Disparar como ação bônus.' },
          { id: 'wolf', name: 'Lobo', description: 'Durante a fúria, seus aliados têm vantagem em ataques corpo a corpo contra criaturas hostis a até 1,5 m de você.' },
          { id: 'bear', name: 'Urso', description: 'Durante a fúria, você ganha resistência a todos os tipos de dano, exceto concussão, cortante e perfurante.' },
        ],
      },
    },
    {
      level: 6,
      name: 'Aspecto da Besta',
      description: 'Escolha o mesmo animal do 3º nível ou um diferente.',
      choice: {
        key: 'beastAspect',
        prompt: 'Escolha o aspecto da besta',
        options: [
          { id: 'eagle', name: 'Águia', description: 'Enxerga a até 1,6 km sem dificuldade e percebe detalhes a menos de 30 m; penumbra não impõe desvantagem a Percepção baseada na visão.' },
          { id: 'wolf', name: 'Lobo', description: 'Pode rastrear criaturas viajando em passo rápido e mover-se furtivamente em passo normal.' },
          { id: 'bear', name: 'Urso', description: 'Dobra a capacidade de carga, o peso máximo que pode carregar e o peso que pode erguer. Você também tem vantagem em testes de Força para empurrar, puxar, erguer ou quebrar objetos.' },
        ],
      },
    },
    { level: 10, name: 'Andarilho Espiritual', description: 'Você pode conjurar comunhão com a natureza como ritual. Uma versão espiritual de um animal escolhido como Totem Espiritual ou Aspecto da Besta aparece para transmitir a informação buscada.' },
    {
      level: 14,
      name: 'Sintonia Totêmica',
      description: 'Escolha o mesmo animal selecionado anteriormente ou um diferente.',
      choice: {
        key: 'totemicAttunement',
        prompt: 'Escolha sua sintonia totêmica',
        options: [
          { id: 'eagle', name: 'Águia', description: 'Durante a fúria, ganha deslocamento de voo igual ao deslocamento de caminhada; cai se terminar o turno no ar sem algo em que se agarrar.' },
          { id: 'wolf', name: 'Lobo', description: 'Durante a fúria, pode usar uma ação bônus para derrubar uma criatura Grande ou menor ao atingi-la com um ataque corpo a corpo com arma.' },
          { id: 'bear', name: 'Urso', description: 'Durante a fúria, criaturas hostis a até 1,5 m têm desvantagem em ataques contra alvos que não sejam você ou outro personagem com esta característica. Não se aplica se não puderem ver ou ouvir você, ou se não puderem ser amedrontadas.' },
        ],
      },
    },
  ],
}

const languageOptions = [
  'Abissal', 'Anão', 'Celestial', 'Comum', 'Dialeto Subterrâneo', 'Dracônico', 'Élfico', 'Fala Profunda', 'Gigante',
  'Gnômico', 'Goblin', 'Halfling', 'Infernal', 'Orc', 'Primordial', 'Silvestre', 'Subcomum',
]

const racialLanguages: Record<string, { fixed: string[]; choices?: number }> = {
  anao: { fixed: ['Comum', 'Anão'] },
  elfo: { fixed: ['Comum', 'Élfico'] },
  halfling: { fixed: ['Comum', 'Halfling'] },
  humano: { fixed: ['Comum'], choices: 1 },
  draconato: { fixed: ['Comum', 'Dracônico'] },
  gnomo: { fixed: ['Comum', 'Gnômico'] },
  'meio-elfo': { fixed: ['Comum', 'Élfico'], choices: 1 },
  'meio-orc': { fixed: ['Comum', 'Orc'] },
  tiefling: { fixed: ['Comum', 'Infernal'] },
}

const artisanTools = [
  'Suprimentos de alquimista', 'Suprimentos de cervejeiro', 'Ferramentas de calígrafo', 'Ferramentas de carpinteiro',
  'Ferramentas de cartógrafo', 'Ferramentas de sapateiro', 'Utensílios de cozinheiro', 'Ferramentas de vidreiro',
  'Ferramentas de joalheiro', 'Ferramentas de couro', 'Ferramentas de pedreiro', 'Materiais de pintor',
  'Suprimentos de oleiro', 'Ferramentas de ferreiro', 'Ferramentas de funileiro', 'Ferramentas de tecelão',
  'Ferramentas de entalhador',
]

const musicalInstruments = [
  'Gaita de foles', 'Tambor', 'Saltério', 'Flauta', 'Alaúde', 'Lira', 'Chifre', 'Flauta de pã', 'Charamela', 'Viola',
]

const gamingSets = ['Jogo de dados', 'Jogo de cartas', 'Xadrez de dragão', 'Conjunto de Três Dragões']

type BackgroundRules = {
  skills: string[]
  skillChoices?: string[]
  skillChoiceCount?: number
  languageChoices?: number
  requiredLanguageOptions?: string[]
  tools?: string[]
  toolChoice?: string[]
  equipmentChoice?: { prompt: string; options: { id: string; label: string; item: string }[]; sidePanelPickerLabel?: string }
  equipment: string[]
  merchantAlternative?: boolean
}

const backgroundRules: Record<string, BackgroundRules> = {
  assombrado: {
    skills: [], skillChoices: ['Arcanismo', 'Investigação', 'Religião', 'Sobrevivência'], skillChoiceCount: 2,
    languageChoices: 2, requiredLanguageOptions: ['Abissal', 'Celestial', 'Fala Profunda', 'Dracônico', 'Infernal', 'Primordial', 'Silvestre', 'Subcomum'],
    equipment: ['Pacote de Caçador de Monstro', 'Roupas comuns', 'Bolsa com 1 peça de prata'],
    equipmentChoice: {
      prompt: 'Escolha uma bugiganga da tabela de Bugigangas Assombradas.',
      sidePanelPickerLabel: 'Bugiganga assombrada',
      options: [
        { id: 'haunted-trinket-01', label: '01 · Uma imagem que você desenhou quando criança do seu amigo imaginário', item: 'Bugiganga assombrada (01)' },
        { id: 'haunted-trinket-02', label: '02 · Uma fechadura que se abre quando sangue pinga no buraco da chave', item: 'Bugiganga assombrada (02)' },
        { id: 'haunted-trinket-03', label: '03 · Roupas roubadas de um espantalho', item: 'Bugiganga assombrada (03)' },
        { id: 'haunted-trinket-04', label: '04 · Um pião esculpido com quatro rostos: feliz, triste, furioso e morto', item: 'Bugiganga assombrada (04)' },
        { id: 'haunted-trinket-05', label: '05 · O colar de um irmão que morreu no dia em que você nasceu', item: 'Bugiganga assombrada (05)' },
        { id: 'haunted-trinket-06', label: '06 · Uma peruca de alguém executado por decapitação', item: 'Bugiganga assombrada (06)' },
        { id: 'haunted-trinket-07', label: '07 · Uma carta nunca aberta, escrita para você por seu pai moribundo', item: 'Bugiganga assombrada (07)' },
        { id: 'haunted-trinket-08', label: '08 · Um relógio de bolso que anda para trás por uma hora à meia-noite', item: 'Bugiganga assombrada (08)' },
        { id: 'haunted-trinket-09', label: '09 · Um casaco de inverno roubado de um soldado moribundo', item: 'Bugiganga assombrada (09)' },
        { id: 'haunted-trinket-10', label: '10 · Um frasco de tinta invisível que só pode ser lida ao pôr do sol', item: 'Bugiganga assombrada (10)' },
        { id: 'haunted-trinket-11', label: '11 · Um cantil que se enche quando enterrado com um morto por uma noite', item: 'Bugiganga assombrada (11)' },
        { id: 'haunted-trinket-12', label: '12 · Um conjunto de talheres usado por um rei em sua última refeição', item: 'Bugiganga assombrada (12)' },
        { id: 'haunted-trinket-13', label: '13 · Uma luneta que sempre mostra o mundo sob uma tempestade terrível', item: 'Bugiganga assombrada (13)' },
        { id: 'haunted-trinket-14', label: '14 · Um camafeu com o rosto do retrato arranhado', item: 'Bugiganga assombrada (14)' },
        { id: 'haunted-trinket-15', label: '15 · Uma lanterna com uma vela preta que nunca acaba e queima com chama verde', item: 'Bugiganga assombrada (15)' },
        { id: 'haunted-trinket-16', label: '16 · Uma xícara de chá infantil manchada de sangue', item: 'Bugiganga assombrada (16)' },
        { id: 'haunted-trinket-17', label: '17 · Um pequeno livro preto que registra apenas os seus sonhos quando você dorme', item: 'Bugiganga assombrada (17)' },
        { id: 'haunted-trinket-18', label: '18 · Um colar formado por símbolos sagrados entrelaçados de uma dúzia de divindades', item: 'Bugiganga assombrada (18)' },
        { id: 'haunted-trinket-19', label: '19 · Um laço que parece mais pesado do que deveria', item: 'Bugiganga assombrada (19)' },
        { id: 'haunted-trinket-20', label: '20 · Uma gaiola para a qual pequenos pássaros voam, mas da qual nunca comem nem saem', item: 'Bugiganga assombrada (20)' },
        { id: 'haunted-trinket-21', label: '21 · Uma caixa de lepidopterista cheia de mariposas mortas com padrões de caveira nas asas', item: 'Bugiganga assombrada (21)' },
        { id: 'haunted-trinket-22', label: '22 · Uma jarra de línguas de carniçais em conserva', item: 'Bugiganga assombrada (22)' },
        { id: 'haunted-trinket-23', label: '23 · A mão de madeira de um pirata notório', item: 'Bugiganga assombrada (23)' },
        { id: 'haunted-trinket-24', label: '24 · Uma urna com as cinzas de um parente morto', item: 'Bugiganga assombrada (24)' },
        { id: 'haunted-trinket-25', label: '25 · Um espelho de mão com um relevo de bronze de uma medusa no verso', item: 'Bugiganga assombrada (25)' },
        { id: 'haunted-trinket-26', label: '26 · Luvas de couro pálido feitas com unhas de marfim', item: 'Bugiganga assombrada (26)' },
        { id: 'haunted-trinket-27', label: '27 · Dados feitos dos nós dos dedos de um charlatão notório', item: 'Bugiganga assombrada (27)' },
        { id: 'haunted-trinket-28', label: '28 · Um anel de chaves para fechaduras esquecidas', item: 'Bugiganga assombrada (28)' },
        { id: 'haunted-trinket-29', label: '29 · Pregos do caixão de um assassino', item: 'Bugiganga assombrada (29)' },
        { id: 'haunted-trinket-30', label: '30 · Uma chave da cripta da família', item: 'Bugiganga assombrada (30)' },
        { id: 'haunted-trinket-31', label: '31 · Um buquê de flores funerárias que sempre parece e cheira fresco', item: 'Bugiganga assombrada (31)' },
        { id: 'haunted-trinket-32', label: '32 · Uma vara usada para disciplinar você quando criança', item: 'Bugiganga assombrada (32)' },
        { id: 'haunted-trinket-33', label: '33 · Uma caixa de música que toca sozinha quando alguém que a segura dança', item: 'Caixa de música' },
        { id: 'haunted-trinket-34', label: '34 · Uma bengala com ponteira de ferro que produz faíscas ao bater em pedra', item: 'Bugiganga assombrada (34)' },
        { id: 'haunted-trinket-35', label: '35 · Uma bandeira de um navio perdido no mar', item: 'Bugiganga assombrada (35)' },
        { id: 'haunted-trinket-36', label: '36 · A cabeça de uma boneca de porcelana que parece sempre olhar para você', item: 'Bugiganga assombrada (36)' },
        { id: 'haunted-trinket-37', label: '37 · Uma cabeça de lobo de prata que também é um apito', item: 'Bugiganga assombrada (37)' },
        { id: 'haunted-trinket-38', label: '38 · Um pequeno espelho que mostra uma versão muito mais velha de quem olha', item: 'Bugiganga assombrada (38)' },
        { id: 'haunted-trinket-39', label: '39 · Um pequeno e gasto livro de cantigas infantis', item: 'Bugiganga assombrada (39)' },
        { id: 'haunted-trinket-40', label: '40 · Uma garra mumificada de corvo', item: 'Bugiganga assombrada (40)' },
        { id: 'haunted-trinket-41', label: '41 · Um pingente quebrado de dragão de prata, sempre frio ao toque', item: 'Bugiganga assombrada (41)' },
        { id: 'haunted-trinket-42', label: '42 · Uma pequena caixa trancada que cantarola à noite, mas cuja melodia você sempre esquece pela manhã', item: 'Bugiganga assombrada (42)' },
        { id: 'haunted-trinket-43', label: '43 · Um tinteiro que deixa quem olha para ele um pouco nauseado', item: 'Bugiganga assombrada (43)' },
        { id: 'haunted-trinket-44', label: '44 · Uma boneca antiga de madeira escura e densa, sem uma mão e um pé', item: 'Bugiganga assombrada (44)' },
        { id: 'haunted-trinket-45', label: '45 · Um capuz negro de carrasco', item: 'Bugiganga assombrada (45)' },
        { id: 'haunted-trinket-46', label: '46 · Uma bolsa feita de carne, com cordão de tendão', item: 'Bugiganga assombrada (46)' },
        { id: 'haunted-trinket-47', label: '47 · Um pequeno carretel de linha preta que nunca acaba', item: 'Bugiganga assombrada (47)' },
        { id: 'haunted-trinket-48', label: '48 · Uma pequena estatueta mecânica de bailarina, sem uma engrenagem e que não funciona', item: 'Bugiganga assombrada (48)' },
        { id: 'haunted-trinket-49', label: '49 · Um cachimbo de madeira negra que cria baforadas de fumaça em forma de caveira', item: 'Bugiganga assombrada (49)' },
        { id: 'haunted-trinket-50', label: '50 · Um frasco de perfume cujo aroma só certas criaturas podem detectar', item: 'Bugiganga assombrada (50)' },
        { id: 'haunted-trinket-51', label: '51 · Uma pedra que emite um único suspiro interminável', item: 'Bugiganga assombrada (51)' },
        { id: 'haunted-trinket-52', label: '52 · Uma boneca de pano com dois pontos vermelhos no pescoço', item: 'Bugiganga assombrada (52)' },
        { id: 'haunted-trinket-53', label: '53 · Um brinquedo de mola com a manivela faltando', item: 'Brinquedo mecânico' },
        { id: 'haunted-trinket-54', label: '54 · Um pote de conserva com uma gosma animada inofensiva, mas agitada', item: 'Bugiganga assombrada (54)' },
        { id: 'haunted-trinket-55', label: '55 · Um dado de madeira preta com o número 1 em todas as faces', item: 'Bugiganga assombrada (55)' },
        { id: 'haunted-trinket-56', label: '56 · Um retrato infantil com “nascido” no verso, junto com a data do próximo ano', item: 'Bugiganga assombrada (56)' },
        { id: 'haunted-trinket-57', label: '57 · Um dente de tubarão do tamanho de uma adaga', item: 'Bugiganga assombrada (57)' },
        { id: 'haunted-trinket-58', label: '58 · Um dedo que criou raízes em um pequeno vaso', item: 'Bugiganga assombrada (58)' },
        { id: 'haunted-trinket-59', label: '59 · Uma caixa de ferramentas com os restos de um aracnídeo mecânico perigoso, mas quebrado', item: 'Bugiganga assombrada (59)' },
        { id: 'haunted-trinket-60', label: '60 · Uma concha de caracol iridescente do tamanho de uma jarra que às vezes estremece ou tomba sem explicação', item: 'Bugiganga assombrada (60)' },
        { id: 'haunted-trinket-61', label: '61 · O diário de bordo de um navio quebra-gelo chamado Haifisch', item: 'Bugiganga assombrada (61)' },
        { id: 'haunted-trinket-62', label: '62 · Um pequeno retrato seu quando criança, ao lado do seu gêmeo vestido de modo idêntico', item: 'Bugiganga assombrada (62)' },
        { id: 'haunted-trinket-63', label: '63 · Um relógio de bolso prateado com treze horas no mostrador', item: 'Bugiganga assombrada (63)' },
        { id: 'haunted-trinket-64', label: '64 · Um entalhe em madeira de um lobo devorando a própria perna traseira', item: 'Bugiganga assombrada (64)' },
        { id: 'haunted-trinket-65', label: '65 · Uma prancheta gravada com caveiras de corvos', item: 'Bugiganga assombrada (65)' },
        { id: 'haunted-trinket-66', label: '66 · Uma estatueta úmida de coral de uma lampreia com braços, pernas e postura bípede', item: 'Bugiganga assombrada (66)' },
        { id: 'haunted-trinket-67', label: '67 · Uma armadilha de dedo de bronze esculpida com tigres rugindo', item: 'Bugiganga assombrada (67)' },
        { id: 'haunted-trinket-68', label: '68 · Um colar de pérolas que fica vermelho sob a lua cheia', item: 'Bugiganga assombrada (68)' },
        { id: 'haunted-trinket-69', label: '69 · Um fóssil de peixe com traços humanoides', item: 'Bugiganga assombrada (69)' },
        { id: 'haunted-trinket-70', label: '70 · Uma máscara de médico da peste', item: 'Bugiganga assombrada (70)' },
        { id: 'haunted-trinket-71', label: '71 · Um talismã de papel com tinta borrada', item: 'Bugiganga assombrada (71)' },
        { id: 'haunted-trinket-72', label: '72 · Um relicário com a imagem borrada de uma figura sem olhos', item: 'Bugiganga assombrada (72)' },
        { id: 'haunted-trinket-73', label: '73 · Um vaso canópico com tampa esculpida como uma cabra', item: 'Bugiganga assombrada (73)' },
        { id: 'haunted-trinket-74', label: '74 · Uma lanterna de abóbora feita de uma pequena cabaça pálida', item: 'Bugiganga assombrada (74)' },
        { id: 'haunted-trinket-75', label: '75 · Um único sapato de ferro com salto alto', item: 'Bugiganga assombrada (75)' },
        { id: 'haunted-trinket-76', label: '76 · Uma vela feita de uma mão decepada', item: 'Bugiganga assombrada (76)' },
        { id: 'haunted-trinket-77', label: '77 · Um dispositivo mecânico que pulsa como um coração', item: 'Bugiganga assombrada (77)' },
        { id: 'haunted-trinket-78', label: '78 · Uma máscara de baile sem rosto', item: 'Bugiganga assombrada (78)' },
        { id: 'haunted-trinket-79', label: '79 · Um olho de vidro com um verme vivo dentro', item: 'Bugiganga assombrada (79)' },
        { id: 'haunted-trinket-80', label: '80 · Um lençol com dois buracos para os olhos', item: 'Bugiganga assombrada (80)' },
        { id: 'haunted-trinket-81', label: '81 · A escritura de um lugar chamado Solar Tergeron', item: 'Bugiganga assombrada (81)' },
        { id: 'haunted-trinket-82', label: '82 · Um envelope carmesim ornamentado e selado com cera, resistente a qualquer tentativa de abertura', item: 'Bugiganga assombrada (82)' },
        { id: 'haunted-trinket-83', label: '83 · Um véu de luto adornado com renda preta', item: 'Bugiganga assombrada (83)' },
        { id: 'haunted-trinket-84', label: '84 · Uma camisa de força coberta de runas de carvão', item: 'Bugiganga assombrada (84)' },
        { id: 'haunted-trinket-85', label: '85 · Uma máscara esfarrapada de estopa com um sorriso torto pintado', item: 'Bugiganga assombrada (85)' },
        { id: 'haunted-trinket-86', label: '86 · Uma fita verde feita para ser usada como gargantilha', item: 'Bugiganga assombrada (86)' },
        { id: 'haunted-trinket-87', label: '87 · Uma dentadura com dentes afiados e incompatíveis entre si', item: 'Bugiganga assombrada (87)' },
        { id: 'haunted-trinket-88', label: '88 · Uma bolsa de ovos morna do tamanho de um punho', item: 'Bugiganga assombrada (88)' },
        { id: 'haunted-trinket-89', label: '89 · Um anel de cobre com a palavra “meu” gravada por dentro', item: 'Bugiganga assombrada (89)' },
        { id: 'haunted-trinket-90', label: '90 · Uma ampola de vidro com um líquido verde-neon', item: 'Bugiganga assombrada (90)' },
        { id: 'haunted-trinket-91', label: '91 · Um tapa-olho bordado com um símbolo sagrado', item: 'Bugiganga assombrada (91)' },
        { id: 'haunted-trinket-92', label: '92 · Um dedão do pé decepado cuja unha continua crescendo', item: 'Bugiganga assombrada (92)' },
        { id: 'haunted-trinket-93', label: '93 · Um diário com muitas passagens censuradas', item: 'Bugiganga assombrada (93)' },
        { id: 'haunted-trinket-94', label: '94 · Uma luva com um desenho semelhante a uma boca costurado na palma', item: 'Bugiganga assombrada (94)' },
        { id: 'haunted-trinket-95', label: '95 · Um relicário ornamentado, porém vazio, feito de prata e vidro estilhaçado', item: 'Bugiganga assombrada (95)' },
        { id: 'haunted-trinket-96', label: '96 · Uma figura de cerâmica de um gato com olhos demais', item: 'Bugiganga assombrada (96)' },
        { id: 'haunted-trinket-97', label: '97 · Um ingresso de papel amassado com as palavras “não admita ninguém”', item: 'Bugiganga assombrada (97)' },
        { id: 'haunted-trinket-98', label: '98 · Uma moeda de electrum com seu rosto em um dos lados', item: 'Bugiganga assombrada (98)' },
        { id: 'haunted-trinket-99', label: '99 · Uma cabeça encolhida de gremishka que se contorce quando alguém conjura magia por perto', item: 'Bugiganga assombrada (99)' },
        { id: 'haunted-trinket-100', label: '100 · Um amuleto em forma de sol com uma pedra vermelha no centro', item: 'Bugiganga assombrada (100)' },
      ],
    },
  },
  acolito: {
    skills: ['Intuição', 'Religião'], languageChoices: 2,
    equipment: ['Símbolo sagrado', 'Livro de preces ou conta de orações', '5 varetas de incenso', 'Vestimentas', 'Roupas comuns', 'Bolsa com 15 po'],
  },
  'artesão de guilda': {
    skills: ['Intuição', 'Persuasão'], languageChoices: 1, toolChoice: artisanTools,
    equipment: ['Ferramentas de artesão do tipo escolhido', 'Carta de apresentação da guilda', 'Roupas de viajante', 'Bolsa com 15 po'],
  },
  'mercador de guilda': {
    skills: ['Intuição', 'Persuasão'], languageChoices: 1, merchantAlternative: true,
    equipment: ['Roupas de viajante', 'Carta de apresentação da guilda', 'Bolsa com 15 po'],
    equipmentChoice: {
      prompt: 'Escolha um tipo de ferramenta de artesão ou a mula e carroça para o equipamento inicial.',
      options: [
        ...artisanTools.map((tool, index) => ({ id: `artisan-${index}`, label: tool, item: tool })),
        { id: 'mule-cart', label: 'Mula e carroça', item: 'Mula e carroça no lugar das ferramentas de artesão' },
      ],
    },
  },
  artista: {
    skills: ['Acrobacia', 'Atuação'], tools: ['Kit de disfarce'], toolChoice: musicalInstruments,
    equipment: ['Instrumento musical do tipo escolhido', 'Presente de um admirador', 'Traje de artista', 'Bolsa com 15 po'],
  },
  gladiador: {
    skills: ['Acrobacia', 'Atuação'], tools: ['Kit de disfarce'], toolChoice: musicalInstruments,
    equipment: ['Presente de um admirador', 'Traje de artista', 'Bolsa com 15 po'],
    equipmentChoice: {
      prompt: 'O Gladiador pode trocar o instrumento do equipamento inicial por uma arma barata e incomum.',
      options: [
        { id: 'instrument', label: 'Instrumento musical escolhido', item: 'Instrumento musical do tipo escolhido' },
        { id: 'unusual-weapon', label: 'Arma incomum (ex.: tridente ou rede)', item: 'Arma barata e incomum, como um tridente ou uma rede' },
      ],
    },
  },
  charlatao: {
    skills: ['Enganação', 'Prestidigitação'], tools: ['Kit de disfarce', 'Kit de falsificação'],
    equipment: ['Roupas finas', 'Kit de disfarce', 'Ferramentas do golpe escolhido', 'Bolsa com 15 po'],
  },
  criminoso: {
    skills: ['Enganação', 'Furtividade'], tools: ['Ferramentas de ladrão'], toolChoice: gamingSets,
    equipment: ['Pé de cabra', 'Roupas comuns escuras com capuz', 'Bolsa com 15 po'],
  },
  espião: {
    skills: ['Enganação', 'Furtividade'], tools: ['Ferramentas de ladrão'], toolChoice: gamingSets,
    equipment: ['Pé de cabra', 'Roupas comuns escuras com capuz', 'Bolsa com 15 po'],
  },
  eremita: {
    skills: ['Medicina', 'Religião'], languageChoices: 1, tools: ['Kit de herbalismo'],
    equipment: ['Estojo de pergaminhos com orações e estudos', 'Cobertor de inverno', 'Roupas comuns', 'Kit de herbalismo', 'Bolsa com 5 po'],
  },
  forasteiro: {
    skills: ['Atletismo', 'Sobrevivência'], languageChoices: 1, toolChoice: musicalInstruments,
    equipment: ['Bordão', 'Armadilha de caça', 'Fetiche de um animal morto', 'Roupas de viajante', 'Bolsa com 10 po'],
  },
  'herói do povo': {
    skills: ['Adestrar Animais', 'Sobrevivência'], tools: ['Veículos (terrestres)'], toolChoice: artisanTools,
    equipment: ['Ferramentas de artesão do tipo escolhido', 'Pá', 'Panela de ferro', 'Roupas comuns', 'Bolsa com 10 po'],
  },
  marinheiro: {
    skills: ['Atletismo', 'Percepção'], tools: ['Ferramentas de navegador', 'Veículos (aquáticos)'],
    equipment: ['Malagueta (clava)', 'Corda de seda (15 m)', 'Amuleto da sorte', 'Roupas comuns', 'Bolsa com 10 po'],
  },
  pirata: {
    skills: ['Atletismo', 'Percepção'], tools: ['Ferramentas de navegador', 'Veículos (aquáticos)'],
    equipment: ['Malagueta (clava)', 'Corda de seda (15 m)', 'Amuleto da sorte', 'Roupas comuns', 'Bolsa com 10 po'],
  },
  nobre: {
    skills: ['História', 'Persuasão'], languageChoices: 1, toolChoice: gamingSets,
    equipment: ['Roupas finas', 'Anel de sinete', 'Pergaminho de linhagem', 'Bolsa com 25 po'],
  },
  cavaleiro: {
    skills: ['História', 'Persuasão'], languageChoices: 1, toolChoice: gamingSets,
    equipment: ['Roupas finas', 'Anel de sinete', 'Pergaminho de linhagem', 'Estandarte ou outro símbolo de uma casa nobre', 'Bolsa com 25 po'],
  },
  orfao: {
    skills: ['Prestidigitação', 'Furtividade'], tools: ['Kit de disfarce', 'Ferramentas de ladrão'],
    equipment: ['Faca pequena', 'Mapa da cidade natal', 'Rato de estimação', 'Lembrança dos pais', 'Roupas comuns', 'Bolsa com 10 po'],
  },
  sabio: {
    skills: ['Arcanismo', 'História'], languageChoices: 2,
    equipment: ['Tinta escura', 'Pena', 'Faca pequena', 'Carta de um colega falecido com uma pergunta ainda sem resposta', 'Roupas comuns', 'Bolsa com 10 po'],
  },
  soldado: {
    skills: ['Atletismo', 'Intimidação'], tools: ['Veículos (terrestres)'], toolChoice: gamingSets,
    equipment: ['Insígnia da patente', 'Fetiche de um inimigo caído', 'Conjunto de dados de osso ou baralho', 'Roupas comuns', 'Bolsa com 10 po'],
  },
}

const abilityLabels = [
  ['strength', 'Força'],
  ['dexterity', 'Destreza'],
  ['constitution', 'Constituição'],
  ['intelligence', 'Inteligência'],
  ['wisdom', 'Sabedoria'],
  ['charisma', 'Carisma'],
] as const

const abilityShortLabels: Record<string, string> = {
  strength: 'For',
  dexterity: 'Des',
  constitution: 'Con',
  wisdom: 'Sab',
  intelligence: 'Int',
  charisma: 'Car',
}

const abilityScoreMethods: { id: AbilityScoreMethod; name: string; description: string }[] = [
  {
    id: 'manual-roll',
    name: 'Rolagem manual',
    description: 'Role 4d6, descarte o menor dado e digite a soma dos outros três em cada habilidade.',
  },
  {
    id: 'standard-array',
    name: 'Array padrão',
    description: 'Distribua 15, 14, 13, 12, 10 e 8, usando cada valor uma vez.',
  },
  {
    id: 'point-buy',
    name: 'Compra de pontos',
    description: 'Gaste até 27 pontos para escolher valores de 8 a 15.',
  },
]

const standardArray = [15, 14, 13, 12, 10, 8]
const pointBuyCosts: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

const skillAbilities: Record<string, string> = {
  Acrobacia: 'dexterity', 'Adestrar Animais': 'wisdom', Arcanismo: 'intelligence', Atletismo: 'strength',
  Atuação: 'charisma', Enganação: 'charisma', Furtividade: 'dexterity', História: 'intelligence',
  Intimidação: 'charisma', Intuição: 'wisdom', Investigação: 'intelligence', Medicina: 'wisdom',
  Natureza: 'intelligence', Percepção: 'wisdom', Persuasão: 'charisma', Prestidigitação: 'dexterity',
  Religião: 'intelligence', Sobrevivência: 'wisdom',
}

const quickBuilds: Record<string, string> = {
  barbaro: 'Primeiro, coloque seu valor de habilidade mais alto em Força, seguido por Constituição. Depois, escolha o antecedente Forasteiro.',
  bardo: 'Primeiro, coloque seu valor de habilidade mais alto em Carisma, seguido por Destreza. Depois, escolha o antecedente Artista.',
  clerigo: 'Primeiro, coloque seu valor de habilidade mais alto em Sabedoria, seguido por Força ou Constituição. Depois, escolha o antecedente Acólito.',
  druida: 'Primeiro, coloque seu valor de habilidade mais alto em Sabedoria, seguido por Constituição. Depois, escolha o antecedente Eremita.',
  guerreiro: 'Primeiro, escolha Força ou Destreza como seu maior valor, conforme prefira armas corpo a corpo ou ataques à distância e armas de acuidade. Constituição deve ser o próximo maior. Depois, escolha o antecedente Soldado.',
  monge: 'Primeiro, coloque seus maiores valores de habilidade em Destreza e Sabedoria. Depois, escolha o antecedente Eremita.',
  paladino: 'Primeiro, coloque seu valor de habilidade mais alto em Força, seguido por Carisma. Depois, escolha o antecedente Nobre.',
  patrulheiro: 'Primeiro, coloque seu valor de habilidade mais alto em Destreza, seguido por Sabedoria. Depois, escolha o antecedente Forasteiro.',
  ladino: 'Primeiro, coloque seu valor de habilidade mais alto em Destreza. Escolha Inteligência para enfatizar perícias ou Carisma para interações sociais. Depois, escolha o antecedente Charlatão.',
  feiticeiro: 'Primeiro, coloque seu valor de habilidade mais alto em Carisma, seguido por Constituição. Depois, escolha o antecedente Eremita.',
  bruxo: 'Primeiro, coloque seu valor de habilidade mais alto em Carisma, seguido por Constituição. Depois, escolha o antecedente Charlatão.',
  mago: 'Primeiro, coloque seu valor de habilidade mais alto em Inteligência, seguido por Constituição. Depois, escolha o antecedente Sábio.',
}

const classProficiencies: Record<string, { saves: string[]; skillCount: number; skills: string[]; armor?: string[]; weapons?: string[]; tools?: string[]; instrumentChoiceCount?: number; toolChoiceOptions?: string[] }> = {
  barbaro: {
    saves: ['Força', 'Constituição'],
    skillCount: 2,
    skills: ['Adestrar Animais', 'Atletismo', 'Intimidação', 'Natureza', 'Percepção', 'Sobrevivência'],
    armor: classArmorProficiencies.barbaro,
    weapons: ['Armas simples', 'Armas marciais'],
    tools: [],
  },
  bardo: {
    saves: ['Destreza', 'Carisma'],
    skillCount: 3,
    skills: ['Acrobacia', 'Adestrar Animais', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade', 'História', 'Intimidação', 'Intuição', 'Investigação', 'Medicina', 'Natureza', 'Percepção', 'Persuasão', 'Prestidigitação', 'Religião', 'Sobrevivência'],
    armor: classArmorProficiencies.bardo,
    weapons: ['Armas simples', 'Bestas de mão', 'Espadas longas', 'Rapieiras', 'Espadas curtas'],
    instrumentChoiceCount: 3,
  },
  bruxo: {
    saves: ['Sabedoria', 'Carisma'],
    skillCount: 2,
    skills: ['Arcanismo', 'Enganação', 'História', 'Intimidação', 'Investigação', 'Natureza', 'Religião'],
    armor: classArmorProficiencies.bruxo,
    weapons: ['Armas simples'],
    tools: [],
  },
  clerigo: { saves: ['Sabedoria', 'Carisma'], skillCount: 2, skills: ['História', 'Intuição', 'Medicina', 'Persuasão', 'Religião'], armor: classArmorProficiencies.clerigo, weapons: ['Armas simples'], tools: [] },
  druida: { saves: ['Inteligência', 'Sabedoria'], skillCount: 2, skills: ['Arcanismo', 'Adestrar Animais', 'Intuição', 'Medicina', 'Natureza', 'Percepção', 'Religião', 'Sobrevivência'], armor: classArmorProficiencies.druida, weapons: ['Clavas', 'Adagas', 'Dardos', 'Azagaias', 'Maças', 'Bordões', 'Cimitarras', 'Foices', 'Fundas', 'Lanças'], tools: ['Kit de herbalismo'] },
  feiticeiro: { saves: ['Constituição', 'Carisma'], skillCount: 2, skills: ['Arcanismo', 'Enganação', 'Intuição', 'Intimidação', 'Persuasão', 'Religião'], armor: classArmorProficiencies.feiticeiro, weapons: ['Adagas', 'Dardos', 'Fundas', 'Bordões', 'Bestas leves'], tools: [] },
  guerreiro: { saves: ['Força', 'Constituição'], skillCount: 2, skills: ['Acrobacia', 'Adestrar Animais', 'Atletismo', 'História', 'Intuição', 'Intimidação', 'Percepção', 'Sobrevivência'], armor: classArmorProficiencies.guerreiro, weapons: ['Armas simples', 'Armas marciais'], tools: [] },
  ladino: { saves: ['Destreza', 'Inteligência'], skillCount: 4, skills: ['Acrobacia', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade', 'Intimidação', 'Intuição', 'Investigação', 'Percepção', 'Persuasão', 'Prestidigitação'], armor: classArmorProficiencies.ladino, weapons: ['Armas simples', 'Bestas de mão', 'Espadas longas', 'Rapieiras', 'Espadas curtas'], tools: ['Ferramentas de ladrão'] },
  mago: { saves: ['Inteligência', 'Sabedoria'], skillCount: 2, skills: ['Arcanismo', 'História', 'Intuição', 'Investigação', 'Medicina', 'Religião'], armor: classArmorProficiencies.mago, weapons: ['Adagas', 'Dardos', 'Fundas', 'Bordões', 'Bestas leves'], tools: [] },
  monge: { saves: ['Força', 'Destreza'], skillCount: 2, skills: ['Acrobacia', 'Atletismo', 'Furtividade', 'História', 'Intuição', 'Religião'], armor: classArmorProficiencies.monge, weapons: ['Armas simples', 'Espadas curtas'], toolChoiceOptions: [...artisanTools, ...musicalInstruments] },
  paladino: { saves: ['Sabedoria', 'Carisma'], skillCount: 2, skills: ['Atletismo', 'Intimidação', 'Intuição', 'Medicina', 'Persuasão', 'Religião'], armor: classArmorProficiencies.paladino, weapons: ['Armas simples', 'Armas marciais'], tools: [] },
  patrulheiro: { saves: ['Força', 'Destreza'], skillCount: 3, skills: ['Acrobacia', 'Adestrar Animais', 'Atletismo', 'Furtividade', 'Intuição', 'Investigação', 'Natureza', 'Percepção', 'Sobrevivência'], armor: classArmorProficiencies.patrulheiro, weapons: ['Armas simples', 'Armas marciais'], tools: [] },
}

const racialAbilityBonuses: Record<string, Record<string, number>> = {
  anao: { constitution: 2 },
  elfo: { dexterity: 2 },
  halfling: { dexterity: 2 },
  draconato: { strength: 2, charisma: 1 },
  gnomo: { intelligence: 2 },
  'meio-orc': { strength: 2, constitution: 1 },
  tiefling: { intelligence: 1, charisma: 2 },
}

const alignmentOptions = [
  'Leal e bom',
  'Neutro e bom',
  'Caótico e bom',
  'Leal e neutro',
  'Neutro',
  'Caótico e neutro',
  'Leal e mau',
  'Neutro e mau',
  'Caótico e mau',
]

const alignmentDescriptions: Record<string, string> = {
  'Leal e bom': 'Você age como a sociedade espera de alguém bondoso e confiável, combinando compaixão com respeito à lei e à ordem.',
  'Neutro e bom': 'Você faz o melhor que pode para ajudar os outros, sem preconceitos e sem se prender demais a regras ou tradições.',
  'Caótico e bom': 'Você age conforme sua consciência manda, valorizando a liberdade individual e a bondade acima de convenções.',
  'Leal e neutro': 'Você age de acordo com leis, tradições ou códigos pessoais, priorizando ordem e previsibilidade sobre bem ou mal.',
  Neutro: 'Você evita se envolver em questões morais e faz o que parece melhor para o momento, sem inclinação forte para ordem ou caos.',
  'Caótico e neutro': 'Você segue seus próprios caprichos, colocando a liberdade pessoal acima de qualquer compromisso com ordem, bem ou mal.',
  'Leal e mau': 'Você busca seus objetivos de forma metódica, explorando leis, tradição e hierarquia para obter poder ou vantagem.',
  'Neutro e mau': 'Você faz o que puder para conseguir o que quer, sem hesitar em prejudicar os outros quando isso for conveniente.',
  'Caótico e mau': 'Você age com violência ou crueldade impulsiva, desprezando regras, autoridade e o bem-estar dos outros.',
}

const raceIllustrations: Record<string, string> = {
  Draconato: '/images/races/dragonborn.png',
  Elfo: '/images/races/elf.png',
  Gnomo: '/images/races/gnome.png',
  Halfling: '/images/races/halfling.png',
  Humano: '/images/races/human.png',
  'Meio-elfo': '/images/races/half-elf.png',
  'Meio-orc': '/images/races/half-orc.png',
  Tiefling: '/images/races/tiefling.png',
}

type RacialChoice = {
  name: string
  traits: string[]
  replaces?: string[]
}

type RaceConfiguration = {
  details: string[]
  traits: string[]
  choiceLabel?: string
  choiceInput?: 'select'
  choices?: RacialChoice[]
}

const racialConfigurations: Record<string, RaceConfiguration> = {
  Anão: {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Constituição aumenta em 2.',
      'Idade. Anões tornam-se maduros na mesma proporção que os humanos, mas são considerados jovens até atingirem a idade de 50 anos. Em média, eles vivem 350 anos.',
      'Tendência. A maioria dos anões é leal, pois acreditam firmemente nos benefícios de uma sociedade bem organizada. Eles tendem para o bem, com um forte senso de honestidade e uma crença de que todos merecem compartilhar os benefícios de uma ordem social justa.',
      'Tamanho. Anões estão entre 1,20 e 1,50 metro de altura e pesam cerca de 75 kg. Seu tamanho é Médio.',
      'Deslocamento. Seu deslocamento base de caminhada é de 7,5 metros. Seu deslocamento não é reduzido quando estiver usando armadura pesada.',
      'Idiomas. Você pode falar, ler e escrever Comum e Anão. O idioma Anão é repleto de consoantes duras e sons guturais, e essa característica influencia, como um sotaque, qualquer outro idioma que o anão falar.',
    ],
    traits: [
      'Visão no Escuro. Acostumado à vida subterrânea, você tem uma visão superior no escuro e na penumbra. Você enxerga na penumbra a até 18 metros como se fosse luz plena, e no escuro como se fosse na penumbra. Você não pode discernir cores no escuro, apenas tons de cinza.',
      'Resiliência Anã. Você possui vantagem em testes de resistência contra veneno e resistência contra dano de veneno (explicado no capítulo 9).',
      'Treinamento Anão em Combate. Você tem proficiência com machados de batalha, machadinhas, martelos leves e martelos de guerra.',
      'Proficiência com Ferramentas. Você tem proficiência em uma ferramenta de artesão à sua escolha entre: ferramentas de ferreiro, suprimentos de cervejeiro ou ferramentas de pedreiro.',
      'Especialização em Rochas. Sempre que você realizar um teste de Inteligência (História) relacionado à origem de um trabalho em pedra, você é considerado proficiente na perícia História e adiciona o dobro do seu bônus de proficiência ao teste, ao invés do seu bônus de proficiência normal.',
    ],
    choiceLabel: 'Sub-raça',
    choices: [
      {
        name: 'Anão da Colina',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Sabedoria aumenta em 1.',
          'Tenacidade Anã. Seu máximo de pontos de vida aumentam em 1, e cada vez que o anão da colina sobe um nível, ele recebe 1 ponto de vida adicional.',
        ],
      },
      {
        name: 'Anão da Montanha',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Força aumenta em 2.',
          'Treinamento Anão com Armaduras. Você adquire proficiência em armaduras leves e médias.',
        ],
      },
    ],
  },
  Elfo: {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Destreza aumenta em 2.',
      'Idade. Embora os elfos atinjam a maturidade física com aproximadamente a mesma idade dos humanos, a compreensão élfica da idade adulta vai além do crescimento físico, abrangendo experiências mundanas. Um elfo tipicamente assume a idade adulta e um nome adulto com cerca de 100 anos de idade e pode viver 750 anos.',
      'Tendência. Elfos amam a liberdade, a variedade e a expressão própria, logo eles inclinam-se forte e suavemente para os aspectos do caos. Eles valorizam e protegem a liberdade dos outros, como também a sua própria, e geralmente são mais bondosos que não. Os drow são exceção; seu exílio no Subterrâneo os tornou perversos e perigosos. Drows geralmente são mais maus que bons.',
      'Tamanho. Elfos medem entre 1,50 e 1,80 metro de altura e possuem constituição delgada. Seu tamanho é Médio.',
      'Deslocamento. Seu deslocamento base de caminhada é 9 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum e Élfico. O Élfico é um idioma fluido, com entonações sutis e gramática complexa. A literatura élfica é rica e variada, e suas canções e poemas são famosos entre outras raças.',
    ],
    traits: [
      'Visão no Escuro. Acostumado às florestas crepusculares e ao céu noturno, você tem uma visão superior no escuro e na penumbra. Você enxerga na penumbra a até 18 metros como se fosse luz plena, e no escuro como se fosse na penumbra. Você não pode discernir cores no escuro, apenas tons de cinza.',
      'Sentidos Aguçados. Você tem proficiência na perícia Percepção.',
      'Ancestral Feérico. Você tem vantagem em testes de resistência para resistir a ser enfeitiçado e magia não pode colocá-lo para dormir.',
      'Transe. Elfos não precisam dormir. Ao invés disso, eles meditam profundamente, permanecendo semiconscientes, durante 4 horas por dia. (A palavra em Comum para tal meditação é “transe”.) Enquanto medita, você pode sonhar de certo modo; tais sonhos na verdade são exercícios mentais que se tornam reflexos através de anos de prática. Depois de descansar dessa forma, você ganha os mesmos benefícios que um humano teria depois de 8 horas de sono.',
    ],
    choiceLabel: 'Sub-raça',
    choices: [
      {
        name: 'Alto Elfo',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Inteligência aumenta em 1.',
          'Treinamento Élfico com Armas. Você tem proficiência com espadas longas, espadas curtas, arcos longos e arcos curtos.',
          'Truque. Você conhece um truque, à sua escolha, da lista de truques do mago. Inteligência é a habilidade usada para conjurá-lo.',
          'Idioma Adicional. Você pode falar, ler e escrever um idioma adicional à sua escolha.',
        ],
      },
      {
        name: 'Elfo da Floresta',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Sabedoria aumenta em 1.',
          'Treinamento Élfico com Armas. Você tem proficiência com espadas longas, espadas curtas, arcos longos e arcos curtos.',
          'Pés Ligeiros. Seu deslocamento base de caminhada aumenta para 10,5 metros.',
          'Máscara da Natureza. Você pode tentar se esconder mesmo quando você está apenas levemente obscurecido por folhagem, chuva forte, neve caindo, névoa ou outro fenômeno natural.',
        ],
      },
      {
        name: 'Elfo Negro (Drow)',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Carisma aumenta em 1.',
          'Visão no Escuro Superior. Sua visão no escuro tem um raio de 36 metros.',
          'Sensibilidade à Luz Solar. Você tem desvantagem nas jogadas de ataque e testes de Sabedoria (Percepção) relacionados à visão quando você, o alvo do seu ataque ou o que quer que você esteja tentando perceber, esteja sob luz solar direta.',
          'Magia Drow. Você possui o truque globos de luz. Quando você alcança o 3º nível, você pode conjurar fogo das fadas. Quando você alcança o 5º nível, você pode conjurar escuridão. Você precisa terminar um descanso longo para poder conjurar as magias desse traço novamente. Carisma é sua habilidade chave para conjurar essas magias.',
        ],
      },
    ],
  },
  Halfling: {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Destreza aumenta em 2.',
      'Idade. Um halfling atinge a idade adulta aos 20 anos e, normalmente, vive até os 150 anos.',
      'Tendência. A maioria dos halflings é leal e boa. Via de regra, eles possuem um bom coração e são amáveis, odeiam ver o sofrimento dos outros e não toleram a opressão. Eles também são muito ordeiros e tradicionais, fortemente apegados à sua comunidade e ao conforto de suas antigas tradições.',
      'Tamanho. Halflings medem cerca de 0,90 metro de altura e pesam aproximadamente 20 kg. Seu tamanho é Pequeno.',
      'Deslocamento. Seu deslocamento base de caminhada é 7,5 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum e Halfling. A linguagem Halfling não é secreta, mas os halflings são relutantes em compartilhá-la com os outros.',
    ],
    traits: [
      'Sortudo. Quando você obtiver um 1 natural em uma jogada de ataque, teste de habilidade ou teste de resistência, você pode jogar o dado novamente e deve utilizar o novo resultado.',
      'Bravura. Você tem vantagem em testes de resistência contra ficar amedrontado.',
      'Agilidade Halfling. Você pode mover-se através do espaço de qualquer criatura que for de um tamanho maior que o seu.',
    ],
    choiceLabel: 'Sub-raça',
    choices: [
      {
        name: 'Pés Leves',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Carisma aumenta em 1.',
          'Furtividade Natural. Você pode tentar se esconder mesmo quando possuir apenas a cobertura de uma criatura que for no mínimo um tamanho maior que o seu.',
        ],
      },
      {
        name: 'Robusto',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Constituição aumenta em 1.',
          'Resiliência dos Robustos. Você possui vantagem em testes de resistência contra veneno e tem resistência contra dano de veneno.',
        ],
      },
    ],
  },
  Humano: {
    details: [
      'Idade. Os humanos chegam à idade adulta no final da adolescência e vivem menos de um século.',
      'Tendência. Os humanos não possuem inclinação a nenhuma tendência em especial. Os melhores e os piores são encontrados entre eles.',
      'Tamanho. Os humanos variam muito em altura e peso, podem ter quase 1,50 metro ou mais de 1,80 metro. Independentemente da sua posição entre esses tamanhos, o seu tamanho é Médio.',
      'Deslocamento. Seu deslocamento base de caminhada é 9 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum e outro idioma adicional, à sua escolha. Os humanos normalmente aprendem os idiomas dos povos que convivem, incluindo dialetos obscuros.',
    ],
    traits: ['Perícias. Você ganha proficiência em uma perícia, à sua escolha.'],
    choiceLabel: 'Escolha a variante humana',
    choices: [
      {
        name: 'Humano Padrão',
        traits: ['Aumento no Valor de Habilidade. Todos os seus valores de habilidade aumentam em 1.'],
      },
      {
        name: 'Humano Variante',
        replaces: ['Perícias. Você ganha proficiência em uma perícia, à sua escolha.'],
        traits: [
          'Aumento no Valor de Habilidade. Três valores de habilidade, à sua escolha, aumentam em 1.',
          'Perícias. Você ganha proficiência em duas perícias, à sua escolha, ao invés de uma.',
          'Talento. Você adquire um talento de sua escolha.',
        ],
      },
    ],
  },
  Draconato: {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Força aumenta em 2 e seu valor de Carisma aumenta em 1.',
      'Idade. Draconatos jovens crescem rapidamente. Eles caminham horas após nascerem, adquirindo o tamanho e desenvolvimento semelhante a de uma criança humana de 10 anos com 3 anos de idade e alcançam a maturidade aos 15. Eles costumam viver até os 80 anos.',
      'Tendência. Draconatos tendem aos extremos, realizando uma escolha consciente de um lado ou outro na guerra cósmica entre o bem e o mal. A maioria dos draconatos é boa, mas os que vão para o lado do mal podem ser vilões terríveis.',
      'Tamanho. Draconatos são mais altos e mais pesados que os humanos, geralmente possuindo mais de 1,80 metro e normalmente pesando mais de 125 kg. Seu tamanho é Médio.',
      'Deslocamento. Seu deslocamento base de caminhada é 9 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum e Dracônico. A língua Dracônica é conhecida por ser uma das mais antigas e ainda é usada no estudo de magia.',
    ],
    traits: [
      'Ancestral Dracônico. Você possui um ancestral dracônico. Escolha um tipo de dragão da tabela Ancestral Dracônico. Sua arma de sopro e resistência a dano são determinadas pelo tipo de dragão, como mostrado na tabela.',
      'Arma de Sopro. Você pode usar uma ação para exalar energia destrutiva. Seu ancestral dracônico determina o tamanho, a forma e o tipo de dano que você expele. Quando você usa sua arma de sopro, cada criatura na área exalada deve realizar um teste de resistência, o tipo do qual é determinado pelo seu ancestral dracônico. A CD para este teste de resistência é igual a 8 + seu modificador de Constituição + seu bônus de proficiência. Uma criatura sofre 2d6 de dano se falhar no teste de resistência e metade desse dano se obtiver sucesso. O dano aumenta para 3d6 no 6º nível, 4d6 no 11º nível e 5d6 no 16º nível. Após usar sua arma de sopro, você não poderá utilizá-la novamente até completar um descanso curto ou longo.',
      'Resistência a Dano. Você possui resistência ao tipo de dano associado ao seu ancestral dracônico.',
    ],
    choiceLabel: 'Escolha a cor do draconato',
    choiceInput: 'select',
    choices: [
      { name: 'Azul', traits: ['Ancestral Dracônico. Azul. Tipo de dano: elétrico. Arma de sopro: linha de 1,5 m por 9 m (teste de resistência de Destreza).'] },
      { name: 'Branco', traits: ['Ancestral Dracônico. Branco. Tipo de dano: frio. Arma de sopro: cone de 4,5 m (teste de resistência de Constituição).'] },
      { name: 'Bronze', traits: ['Ancestral Dracônico. Bronze. Tipo de dano: elétrico. Arma de sopro: linha de 1,5 m por 9 m (teste de resistência de Destreza).'] },
      { name: 'Cobre', traits: ['Ancestral Dracônico. Cobre. Tipo de dano: ácido. Arma de sopro: linha de 1,5 m por 9 m (teste de resistência de Destreza).'] },
      { name: 'Latão', traits: ['Ancestral Dracônico. Latão. Tipo de dano: fogo. Arma de sopro: linha de 1,5 m por 9 m (teste de resistência de Destreza).'] },
      { name: 'Negro', traits: ['Ancestral Dracônico. Negro. Tipo de dano: ácido. Arma de sopro: linha de 1,5 m por 9 m (teste de resistência de Destreza).'] },
      { name: 'Ouro', traits: ['Ancestral Dracônico. Ouro. Tipo de dano: fogo. Arma de sopro: cone de 4,5 m (teste de resistência de Destreza).'] },
      { name: 'Prata', traits: ['Ancestral Dracônico. Prata. Tipo de dano: frio. Arma de sopro: cone de 4,5 m (teste de resistência de Constituição).'] },
      { name: 'Verde', traits: ['Ancestral Dracônico. Verde. Tipo de dano: veneno. Arma de sopro: cone de 4,5 m (teste de resistência de Constituição).'] },
      { name: 'Vermelho', traits: ['Ancestral Dracônico. Vermelho. Tipo de dano: fogo. Arma de sopro: cone de 4,5 m (teste de resistência de Destreza).'] },
    ],
  },
  Gnomo: {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Inteligência aumenta em 2.',
      'Idade. Gnomos amadurecem a mesma idade dos humanos e a maioria espera viver entre 350 e 500 anos.',
      'Tendência. A maioria dos gnomos é boa. Aqueles que tendem para a ordem são sábios, engenheiros, pesquisadores, estudiosos ou inventores. Os que tendem para o caos são menestréis, brincalhões, andarilhos ou joalheiros caprichosos.',
      'Tamanho. Gnomos possuem entre 0,90 e 1,20 metro de altura e pesam cerca de 20 kg. Seu tamanho é Pequeno.',
      'Deslocamento. Seu deslocamento base de caminhada é 7,5 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum e Gnômico. A linguagem Gnômica, que usa o alfabeto Anão, é conhecida por seus tratados técnicos e catálogos de conhecimento sobre o mundo natural.',
    ],
    traits: [
      'Visão no Escuro. Acostumado à vida subterrânea, você tem uma visão superior no escuro e na penumbra. Você enxerga na penumbra a até 18 metros como se fosse luz plena, e no escuro como se fosse na penumbra. Você não pode discernir cores no escuro, apenas tons de cinza.',
      'Esperteza Gnômica. Você possui vantagem em todos os testes de resistência de Inteligência, Sabedoria e Carisma contra magia.',
    ],
    choiceLabel: 'Sub-raça',
    choices: [
      {
        name: 'Gnomo da Floresta',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Destreza aumenta em 1.',
          'Ilusionista Nato. Você conhece o truque ilusão menor. Inteligência é a sua habilidade usada para conjurá-lo.',
          'Falar com Bestas Pequenas. Através de sons e gestos, você pode comunicar ideias simples para Bestas pequenas ou menores. Gnomos da floresta amam animais e geralmente possuem esquilos, texugos, coelhos, toupeiras, pica-paus e outras criaturas como amados animais de estimação.',
        ],
      },
      {
        name: 'Gnomo das Rochas',
        traits: [
          'Aumento no Valor de Habilidade. Seu valor de Constituição aumenta em 1.',
          'Conhecimento de Artífice. Sempre que você realizar um teste de Inteligência (História) relacionado a itens mágicos, objetos alquímicos ou mecanismos tecnológicos, você pode adicionar o dobro do seu bônus de proficiência ao invés de qualquer bônus de proficiência que você normalmente use.',
          'Engenhoqueiro. Você tem proficiência com ferramentas de artesão (ferramentas de engenhoqueiro). Usando essas ferramentas, você pode gastar 1 hora e 10 po em materiais para construir um mecanismo Miúdo (CA 5, 1 pv). O mecanismo para de funcionar após 24 horas (a não ser que você gaste 1 hora reparando-o para manter o mecanismo funcionando), ou quando você usa sua ação para desmontá-lo; nesse momento, você pode recuperar os materiais usados para criá-lo. Você pode ter até três desses mecanismos ativos ao mesmo tempo. Quando você criar um mecanismo, escolha uma das opções: brinquedo mecânico, isqueiro ou caixa de música.',
        ],
      },
    ],
  },
  'Meio-elfo': {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Carisma aumenta em 2 e outros dois valores de habilidade, à sua escolha, aumentam em 1.',
      'Idade. Meio-elfos amadurecem à mesma velocidade que os humanos alcançam a idade adulta aos 20 anos. Eles vivem muito mais que os humanos, no entanto, raramente ultrapassando os 180 anos.',
      'Tendência. Meio-elfos compartilham a veia caótica da sua herança élfica. Eles valorizam tanto a sua liberdade quanto sua expressão criativa, não demonstrando qualquer apresso por líderes ou seguidores. Eles se irritam com regras, ressentindo com exigências de outros e, às vezes, provam não serem confiáveis, ou ao menos, imprevisíveis.',
      'Tamanho. Meio-elfos possuem aproximadamente o mesmo tamanho dos humanos, variando entre 1,50 metro e 1,80 metro de altura. Seu tamanho é Médio.',
      'Deslocamento. Seu deslocamento base de caminhada é 9 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum, Élfico e um idioma adicional, à sua escolha.',
    ],
    traits: [
      'Visão no Escuro. Graças ao seu sangue élfico, você tem uma visão superior no escuro e na penumbra. Você enxerga na penumbra a até 18 metros como se fosse luz plena, e no escuro como se fosse na penumbra. Você não pode discernir cores no escuro, apenas tons de cinza.',
      'Ancestral Feérico. Você possui vantagem em testes de resistência contra ser enfeitiçado e magia não pode colocá-lo para dormir.',
      'Versatilidade em Perícia. Você ganha proficiência em duas perícias, à sua escolha.',
    ],
  },
  'Meio-orc': {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Força aumenta em 2 e seu valor de Constituição aumenta em 1.',
      'Idade. Meio-orcs amadurecem um pouco antes dos humanos, atingindo a idade adulta aos 14 anos. Eles envelhecem notavelmente mais rápido e, raramente, vivem mais de 75 anos.',
      'Tendência. Meio-orcs herdam a tendência para o caos da sua ancestralidade orc e não são fortemente inclinados ao bem. Meio-orcs que cresceram entre os orcs e desejam viver entre eles normalmente são maus.',
      'Tamanho. Meio-orcs são um pouco maiores e mais robustos que os humanos, medindo entre 1,80 metro e 2,10 metros de altura. Seu tamanho é Médio.',
      'Deslocamento. Seu deslocamento base de caminhada é 9 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum e Orc. O Orc é um idioma áspero, com consoantes duras. Ele não possui alfabeto próprio, mas é escrito usando o alfabeto Anão.',
    ],
    traits: [
      'Visão no Escuro. Graças ao seu sangue orc, você tem uma visão superior no escuro e na penumbra. Você enxerga na penumbra a até 18 metros como se fosse luz plena, e no escuro como se fosse na penumbra. Você não pode discernir cores no escuro, apenas tons de cinza.',
      'Ameaçador. Você ganha proficiência na perícia Intimidação.',
      'Resistência Implacável. Quando você cai para 0 pontos de vida mas não é completamente morto, você pode cair para 1 ponto de vida. Você não pode usar essa característica novamente até completar um descanso longo.',
      'Ataques Selvagens. Quando você atinge um ataque crítico com uma arma corpo-a-corpo, você pode rolar um dos dados de dano da arma mais uma vez e adicioná-lo ao dano extra causado pelo acerto crítico.',
    ],
  },
  Tiefling: {
    details: [
      'Aumento no Valor de Habilidade. Seu valor de Inteligência aumenta em 1 e seu valor de Carisma aumenta em 2.',
      'Idade. Tieflings amadurecem ao mesmo tempo que os humanos, mas vivem alguns anos a mais.',
      'Tendência. Tieflings não possuem uma tendência inata para o mal, mas muitos acabam por abraçá-lo. Malignos ou não, uma natureza independente inclina a maioria dos tieflings ao caos.',
      'Tamanho. Tieflings possuem o mesmo tamanho e compleição dos humanos. Seu tamanho é Médio.',
      'Deslocamento. Seu deslocamento base de caminhada é 9 metros.',
      'Idiomas. Você pode falar, ler e escrever Comum e Infernal.',
    ],
    traits: [
      'Visão no Escuro. Graças a sua herança infernal, você tem uma visão superior no escuro e na penumbra. Você enxerga na penumbra a até 18 metros como se fosse luz plena, e no escuro como se fosse na penumbra. Você não pode discernir cores no escuro, apenas tons de cinza.',
      'Resistência Infernal. Você possui resistência a dano de fogo.',
      'Legado Infernal. Você conhece o truque taumaturgia. Quando você atingir o 3º nível, você poderá conjurar a magia repreensão infernal como uma magia de 2º nível. Quando você atingir o 5º nível, você também poderá conjurar a magia escuridão. Você precisa terminar um descanso longo para poder conjurar as magias desse traço novamente. Carisma é a sua habilidade de conjuração para essas magias.',
    ],
  },
}

const initialCharacter: CharacterDetails = {
  name: '',
  level: 1,
  experiencePoints: '0',
  maxHp: '',
  portraitUrl: '',
  portraitPath: '',
  raceId: '',
  racialChoice: '',
  characterClassId: '',
  classSubclassId: '',
  classFeatureChoices: {},
  primalPath: '',
  primalTotemChoices: { spiritualTotem: '', beastAspect: '', totemicAttunement: '' },
  backgroundId: '',
  age: '',
  height: '',
  weight: '',
  alignment: '',
  abilityScoreMethod: '',
  abilities: Object.fromEntries(abilityLabels.map(([key]) => [key, ''])),
  abilityScoreIncreases: { classId: '', selections: {} },
  featAbilityIncreases: {},
  racialAbilityChoices: [],
  raceLanguageChoices: [],
  backgroundLanguageChoices: [],
  backgroundSkillChoices: [],
  merchantAlternative: '',
  appliedRacialBonuses: {},
  skillProficiencies: [],
  bardInstrumentChoices: [],
  toolProficiencyChoices: [],
  backgroundEquipmentChoice: '',
  equipment: '',
  spells: '',
  feats: '',
}

function renderRacialText(text: string) {
  const titleEnd = text.indexOf('. ')
  const description = titleEnd === -1 ? text : text.slice(titleEnd + 1)
  const highlightedDescription = description.split(/(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/g).map((part, index) =>
    /^(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)$/.test(part) ? <strong key={index}>{part}</strong> : part,
  )

  if (titleEnd === -1) return highlightedDescription

  return <><strong>{text.slice(0, titleEnd + 1)}</strong>{highlightedDescription}</>
}

function digits(value: string, maxLength: number) {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

function normalizeTerm(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function readSelectedCantrips(value: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const spellData = parsed as { cantrips?: unknown; bonusCantrips?: unknown }
      const cantrips = [spellData.cantrips, spellData.bonusCantrips].flatMap((names) =>
        Array.isArray(names) ? names.filter((item): item is string => typeof item === 'string') : [],
      )
      return [...new Set(cantrips)]
    }
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed as string[] : []
  } catch {
    return []
  }
}

function readSelectedSpells(value: string): Record<number, string[]> {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const spells = (parsed as { spells?: unknown }).spells
    if (!spells || typeof spells !== 'object' || Array.isArray(spells)) return {}
    return Object.fromEntries(Object.entries(spells).flatMap(([level, names]) =>
      Array.isArray(names) && names.every((name) => typeof name === 'string') ? [[Number(level), names as string[]]] : [],
    ))
  } catch {
    return {}
  }
}

function readSelectedClassLevelSpells(value: string): Record<number, string[]> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const classLevels = (parsed as { classLevels?: unknown }).classLevels
    if (!classLevels || typeof classLevels !== 'object' || Array.isArray(classLevels)) return null
    return Object.fromEntries(Object.entries(classLevels).flatMap(([level, names]) =>
      Array.isArray(names) && names.every((name) => typeof name === 'string') ? [[Number(level), names as string[]]] : [],
    ))
  } catch {
    return null
  }
}

function formatAge(value: string) {
  const age = digits(value, 3)
  return age ? `${age} anos` : ''
}

function formatHeight(value: string) {
  const height = digits(value, 3)
  if (height.length < 2) return height
  return `${height[0]},${height.slice(1)} m`
}

function formatWeight(value: string) {
  const weight = digits(value, 3)
  return weight ? `${weight} kg` : ''
}

function isEntireFieldSelected(input: HTMLInputElement) {
  return input.selectionStart === 0 && input.selectionEnd === input.value.length
}

function selectedName(items: ReferenceItem[], id: string) {
  return items.find((item) => item.id === id)?.name ?? 'Não definido'
}

function hasMeaningfulCharacterData(value: CharacterDetails) {
  return Boolean(
    value.name.trim() || value.portraitPath || value.raceId || value.characterClassId || value.backgroundId
    || value.level !== 1 || value.experiencePoints !== '0' || value.maxHp || value.alignment
    || value.age || value.height || value.weight || value.abilityScoreMethod
    || Object.values(value.abilities).some(Boolean) || value.skillProficiencies.length
    || value.equipment || value.spells || value.feats,
  )
}

type CharacterCreationWizardProps = {
  characterId: string | null
  initialCharacterData?: Partial<CharacterDetails>
  initialDraft: CharacterDraft | null
  initialStep: number
  lastReachedStep: number
  onComplete: (character: CharacterDetails, id: string) => Promise<void>
  onClose: () => void
  onDeletePortrait: (path: string) => Promise<void>
  onPersistDraft: (draft: Omit<CharacterDraft, 'id'> & { id?: string }) => Promise<CharacterDraft>
  onSidebarSelect: (section: SidebarSection) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onStepChange: (step: number) => void
  onUploadPortrait: (file: File) => Promise<{ path: string; url: string }>
}

function AbilityScoreSummaryFrame() {
  return <svg aria-hidden="true" className="wizard__summary-ability-frame" focusable="false" viewBox="0 0 94 89">
    <path fill="transparent" d="M87.54,9.45a42.28,42.28,0,0,1-3-3A42.91,42.91,0,0,0,74.21,1H18.36a11,11,0,0,0-1.53.59A4.9,4.9,0,0,1,15.36,2.7,21.09,21.09,0,0,0,6,12.28a5.14,5.14,0,0,1,.12,1.59,5.15,5.15,0,0,1,.24,1.18c1,12.72.57,25.84.4,38.59-.09,6.5,0,13-.05,19.48,0,2-.11,4.08-.22,6.12a17.93,17.93,0,0,0,2.78,2.94A73.22,73.22,0,0,0,16.51,87H78l.07-.06a32.31,32.31,0,0,0,9.31-8.5c.13-6,.65-12,.36-18s.2-11.89.36-17.9c.16-6.53,0-13.11-.17-19.64C87.84,18.57,88.07,13.86,87.54,9.45Z" />
    <path fill="currentColor" d="M85,0H9L0,9.05V80l9,9H85l9-9V9.05Zm6.55,10.08v7a29.26,29.26,0,0,0-3.24-6.78v-.13h-.08a20.45,20.45,0,0,0-9.13-7.69H84ZM75.6,86.52H18.36a19,19,0,0,1-11.3-7.73V10.25A19.27,19.27,0,0,1,18.4,2.48H75.64a18.94,18.94,0,0,1,11.3,7.73V78.75A19.27,19.27,0,0,1,75.6,86.52ZM2.47,21.18a31.7,31.7,0,0,1,3.24-8.8V76.64c-.3-.53-.62-1-.89-1.62a32.92,32.92,0,0,1-2.35-7.11Zm85.82-8.82c.3.53.62,1,.89,1.62a32.92,32.92,0,0,1,2.35,7.11V67.81a31.64,31.64,0,0,1-3.24,8.81ZM10.05,2.48h4.87a20.45,20.45,0,0,0-9.13,7.69H5.71v.13a29.26,29.26,0,0,0-3.24,6.78v-7ZM2.47,78.92v-7A29.45,29.45,0,0,0,5.71,78.7v.13h.08a20.45,20.45,0,0,0,9.13,7.69H10.05ZM84,86.52H79.08a20.45,20.45,0,0,0,9.13-7.69h.08V78.7a29.45,29.45,0,0,0,3.24-6.78v7Z" />
  </svg>
}

function ArmorClassSummaryFrame() {
  return <svg aria-hidden="true" className="wizard__summary-armor-frame" focusable="false" viewBox="0 0 79 90">
    <path fill="transparent" d="M72.8,30.7v13.7c-1,3.6-9.7,30.9-31.9,38.6c-0.3-0.4-0.8-0.7-1.4-0.7c-0.6,0-1,0.3-1.4,0.7C26,78.7,17.9,68.6,12.9,59.8c0,0,0,0,0,0c-0.3-0.5-0.6-1-0.8-1.5c-3.6-6.7-5.4-12.4-5.9-14V30.7c0.7-0.3,1.2-0.9,1.2-1.7c0-0.1,0-0.2-0.1-0.3c6.2-4,8.5-11.5,9.2-15.2L38.1,7c0.3,0.4,0.8,0.7,1.4,0.7c0.6,0,1.1-0.3,1.4-0.7l21.4,6.6c0.8,3.6,3,11.1,9.2,15.2V29c0,0.2,0,0.4,0.1,0.6C71.8,30.1,72.3,30.5,72.8,30.7z" />
    <path fill="currentColor" d="M73.2,27.3c-0.4,0-0.8,0.2-1.1,0.4c-5.8-3.9-7.9-11.3-8.6-14.5l-0.1-0.4l-22-6.7c-0.1-0.9-0.8-1.7-1.8-1.7s-1.7,0.8-1.8,1.7l-22,6.7l-0.1,0.4c-0.6,3.2-2.7,10.6-8.6,14.5c-0.3-0.3-0.7-0.4-1.1-0.4c-1,0-1.8,0.8-1.8,1.9c0,0.8,0.5,1.5,1.2,1.7v13.5v0.2c0.9,3.2,9.7,31.2,32.4,39.2c0.1,1,0.8,1.8,1.8,1.8s1.8-0.8,1.8-1.8c9.3-3.3,17.3-10.1,23.8-20.4c5.3-8.4,7.9-16.5,8.6-18.8V30.9c0.7-0.3,1.2-0.9,1.2-1.7C75,28.1,74.2,27.3,73.2,27.3z M72.5,44.3c-1,3.6-9.6,30.5-31.5,38.2c-0.3-0.4-0.8-0.7-1.4-0.7c-0.6,0-1,0.3-1.4,0.7C16.3,74.8,7.8,47.9,6.7,44.3V30.9c0.7-0.3,1.2-0.9,1.2-1.7c0-0.1,0-0.2-0.1-0.3c6.1-4,8.4-11.4,9.1-15l21.3-6.5c0.3,0.4,0.8,0.7,1.4,0.7c0.6,0,1.1-0.3,1.4-0.7l21.2,6.5c0.8,3.6,3,11,9.1,15c0,0.1,0,0.2,0,0.3c0,0.8,0.5,1.5,1.2,1.7V44.3z M73.2,27.3c-0.4,0-0.8,0.2-1.1,0.4c-5.8-3.9-7.9-11.3-8.6-14.5l-0.1-0.4l-22-6.7c-0.1-0.9-0.8-1.7-1.8-1.7s-1.7,0.8-1.8,1.7l-22,6.7l-0.1,0.4c-0.6,3.2-2.7,10.6-8.6,14.5c-0.3-0.3-0.7-0.4-1.1-0.4c-1,0-1.8,0.8-1.8,1.9c0,0.8,0.5,1.5,1.2,1.7v13.5v0.2c0.9,3.2,9.7,31.2,32.4,39.2c0.1,1,0.8,1.8,1.8,1.8s1.8-0.8,1.8-1.8c9.3-3.3,17.3-10.1,23.8-20.4c5.3-8.4,7.9-16.5,8.6-18.8V30.9c0.7-0.3,1.2-0.9,1.2-1.7C75,28.1,74.2,27.3,73.2,27.3z M72.5,44.3c-1,3.6-9.6,30.5-31.5,38.2c-0.3-0.4-0.8-0.7-1.4-0.7c-0.6,0-1,0.3-1.4,0.7C16.3,74.8,7.8,47.9,6.7,44.3V30.9c0.7-0.3,1.2-0.9,1.2-1.7c0-0.1,0-0.2-0.1-0.3c6.1-4,8.4-11.4,9.1-15l21.3-6.5c0.3,0.4,0.8,0.7,1.4,0.7c0.6,0,1.1-0.3,1.4-0.7l21.2,6.5c0.8,3.6,3,11,9.1,15c0,0.1,0,0.2,0,0.3c0,0.8,0.5,1.5,1.2,1.7V44.3z M78.1,24.5c-8.7-1.8-9.9-14.9-9.9-15l-0.1-0.8L39.5,0L10.9,8.7l-0.1,0.8c0,0.1-1.2,13.3-9.9,15l-1,0.2v20.4v0.3C0,45.8,9.6,82.1,39.1,89.9l0.3,0.1l0.3-0.1C69.5,82.1,79,45.8,79.1,45.4V24.7L78.1,24.5z M76.7,45C76,47.5,66.6,80.1,39.5,87.5C12.6,80.1,3.2,47.4,2.5,45V26.7c8.3-2.4,10.3-13,10.7-16.1l26.4-8l26.4,8c0.4,3.1,2.4,13.7,10.7,16.1V45z M63.5,13.2l-0.1-0.4l-22-6.7c-0.1-0.9-0.8-1.7-1.8-1.7s-1.7,0.8-1.8,1.7l-22,6.7l-0.1,0.4c-0.6,3.2-2.7,10.6-8.6,14.5c-0.3-0.3-0.7-0.4-1.1-0.4c-1,0-1.8,0.8-1.8,1.9c0,0.8,0.5,1.5,1.2,1.7v13.5v0.2c0.9,3.2,9.7,31.2,32.4,39.2c0.1,1,0.8,1.8,1.8,1.8s1.8-0.8,1.8-1.8c9.3-3.3,17.3-10.1,23.8-20.4c5.3-8.4,7.9-16.5,8.6-18.8V30.9c0.7-0.3,1.2-0.9,1.2-1.7c0-1-0.8-1.9-1.8-1.9c-0.4,0-0.8,0.2-1.1,0.4C66.2,23.9,64.1,16.4,63.5,13.2z M72.5,30.9v13.5c-1,3.6-9.6,30.5-31.5,38.2c-0.3-0.4-0.8-0.7-1.4-0.7c-0.6,0-1,0.3-1.4,0.7C16.3,74.8,7.8,47.9,6.7,44.3V30.9c0.7-0.3,1.2-0.9,1.2-1.7c0-0.1,0-0.2-0.1-0.3c6.1-4,8.4-11.4,9.1-15l21.3-6.5c0.3,0.4,0.8,0.7,1.4,0.7c0.6,0,1.1-0.3,1.4-0.7l21.2,6.5c0.8,3.6,3,11,9.1,15c0,0.1,0,0.2,0,0.3C71.3,30,71.8,30.6,72.5,30.9z" />
  </svg>
}

function HitPointsSummaryHeart() {
  return <svg aria-hidden="true" className="wizard__summary-hit-points-heart" focusable="false" viewBox="0 0 91.3 86.28">
    <g fill="currentColor">
      <path d="M65.12,6.21c2.64,0,5.2.56,7.61,1.68,7.47,3.4,12.3,11.32,12.3,20.15,0,20.57-16.66,38.99-30.93,48.52-2.49,1.67-5.19,3.24-8.02,3.49-.2.02-.39.03-.58.03-2.56,0-5.03-1.44-7.54-3.04-15.83-10.1-31.81-29.16-31.81-48.99,0-8.84,4.83-16.75,12.3-20.17,2.42-1.1,4.98-1.66,7.61-1.66,5.25,0,10.57,2.28,15.4,6.59l1.65,1.47,1.64,1.47.85.76.85-.76,1.63-1.46,1.66-1.47c4.81-4.31,10.13-6.59,15.38-6.59h0ZM65.12,4.94c-5.57,0-11.18,2.39-16.23,6.91l-1.66,1.47-1.64,1.47-1.64-1.47-1.65-1.47c-5.06-4.52-10.67-6.91-16.24-6.91-2.82,0-5.56.6-8.14,1.78-7.92,3.62-13.04,11.99-13.04,21.32,0,20.25,16.42,39.87,32.39,50.06,2.47,1.58,5.22,3.24,8.22,3.24.23,0,.46,0,.69-.03,3.15-.27,6.04-1.98,8.62-3.7,15.73-10.51,31.49-29.37,31.49-49.58,0-9.33-5.12-17.7-13.04-21.31-2.58-1.19-5.32-1.79-8.14-1.79h0Z" />
      <path d="M45.59,16.28c-.89,0-1.61-.72-1.61-1.61s.72-1.61,1.61-1.61,1.61.72,1.61,1.61-.72,1.61-1.61,1.61Z" />
      <path d="M45.59,13.55c.61,0,1.11.5,1.11,1.11s-.5,1.11-1.11,1.11-1.11-.5-1.11-1.11.5-1.11,1.11-1.11h0ZM45.59,12.55c-1.17,0-2.11.95-2.11,2.11s.95,2.11,2.11,2.11,2.11-.95,2.11-2.11-.95-2.11-2.11-2.11h0Z" />
      <circle cx="45.65" cy="80.93" r="1.61" />
      <path d="M45.65,79.82c.61,0,1.11.5,1.11,1.11s-.5,1.11-1.11,1.11-1.11-.5-1.11-1.11.5-1.11,1.11-1.11h0ZM45.65,78.82c-1.17,0-2.11.95-2.11,2.11s.95,2.11,2.11,2.11,2.11-.95,2.11-2.11-.95-2.11-2.11-2.11h0Z" />
      <path d="M85.73,30.42c-.89,0-1.61-.72-1.61-1.61s.72-1.61,1.61-1.61,1.61.72,1.61,1.61-.72,1.61-1.61,1.61Z" />
      <path d="M85.73,27.7c.61,0,1.11.5,1.11,1.11s-.5,1.11-1.11,1.11-1.11-.5-1.11-1.11.5-1.11,1.11-1.11h0ZM85.73,26.7c-1.17,0-2.11.95-2.11,2.11s.95,2.11,2.11,2.11,2.11-.95,2.11-2.11-.95-2.11-2.11-2.11h0Z" />
      <path d="M5.73,30.42c-.89,0-1.61-.72-1.61-1.61s.72-1.61,1.61-1.61,1.61.72,1.61,1.61-.72,1.61-1.61,1.61Z" />
      <path d="M5.73,27.7c.61,0,1.11.5,1.11,1.11s-.5,1.11-1.11,1.11-1.11-.5-1.11-1.11.5-1.11,1.11-1.11h0ZM5.73,26.7c-1.17,0-2.11.95-2.11,2.11s.95,2.11,2.11,2.11,2.11-.95,2.11-2.11-.95-2.11-2.11-2.11h0Z" />
      <path d="M75.38,2.23c-3.23-1.48-6.67-2.23-10.2-2.23-6.8,0-13.55,2.82-19.53,8.17h-.01C39.67,2.82,32.92,0,26.12,0c-3.54,0-6.97.75-10.2,2.22C6.25,6.65,0,16.78,0,28.04c0,26.26,24.25,47.58,34.68,54.23,3.18,2.03,6.63,4.01,10.88,4.01.36,0,.73,0,1.07-.04,4.27-.37,7.8-2.39,10.98-4.52,15.37-10.26,33.69-30.38,33.69-53.68,0-11.26-6.25-21.39-15.92-25.81ZM56.24,79.67c-2.9,1.94-6.1,3.79-9.78,4.11-.29.02-.6.03-.9.03-3.57,0-6.56-1.71-9.55-3.62C25.92,73.75,2.47,53.09,2.47,28.04c0-10.29,5.69-19.55,14.48-23.57,2.91-1.33,5.99-2,9.17-2,6.18,0,12.37,2.61,17.88,7.54l1.65,1.46,1.65-1.46c5.51-4.93,11.7-7.54,17.88-7.54,3.19,0,6.27.68,9.17,2.01,8.79,4.01,14.48,13.26,14.48,23.56,0,22.2-17.72,41.7-32.59,51.63Z" />
    </g>
  </svg>
}

class CharacterCreationErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro ao renderizar a criação de personagem:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="creation-page">
        <section className="wizard wizard__render-error" aria-labelledby="wizard-render-error-title" role="alert">
          <h1 id="wizard-render-error-title">Não foi possível abrir esta etapa</h1>
          <p>A aplicação encontrou um erro. Envie os detalhes abaixo para podermos corrigir.</p>
          <details>
            <summary>Ver detalhes do erro</summary>
            <pre>{this.state.error.stack ?? this.state.error.message}</pre>
          </details>
        </section>
      </main>
    )
  }
}

function CharacterCreationWizardContent({
  characterId,
  initialCharacterData,
  initialDraft,
  initialStep,
  lastReachedStep,
  onComplete,
  onClose,
  onDeletePortrait,
  onPersistDraft,
  onSidebarSelect,
  theme,
  onToggleTheme,
  onStepChange,
  onUploadPortrait,
}: CharacterCreationWizardProps) {
  const activeStep = initialStep
  const toast = useToast()
  const { catalog: equipmentCatalog, loading: equipmentLoading, error: equipmentError, retry: retryEquipmentCatalog } = useEquipmentCatalog(true, activeStep >= 4)
  const [character, setCharacter] = useState(() => {
    const draft = initialCharacterData ?? initialDraft?.character
    if (!draft) return initialCharacter
    return {
      ...initialCharacter,
      ...draft,
      portraitPath: draft.portraitPath ?? '',
      experiencePoints: draft.experiencePoints ?? String(experienceThresholds[(draft.level ?? initialCharacter.level) - 1] ?? 0),
      classSubclassId: draft.classSubclassId ?? '',
      classFeatureChoices: draft.classFeatureChoices ?? {},
      primalPath: draft.primalPath ?? '',
      primalTotemChoices: { ...initialCharacter.primalTotemChoices, ...draft.primalTotemChoices },
      abilityScoreMethod: draft.abilityScoreMethod ?? (Object.values(draft.abilities ?? {}).some(Boolean) ? 'manual-roll' : ''),
      abilities: { ...initialCharacter.abilities, ...draft.abilities },
      maxHp: !initialDraft && Object.entries(draft.classFeatureChoices ?? {}).some(([key, selected]) => key.endsWith(':feat') && selected[0] === 'robusto')
        ? String(Math.max(0, Number(draft.maxHp || 0) - (draft.level ?? initialCharacter.level) * 2))
        : draft.maxHp ?? '',
      abilityScoreIncreases: draft.abilityScoreIncreases ?? initialCharacter.abilityScoreIncreases,
      featAbilityIncreases: draft.featAbilityIncreases ?? {},
      skillProficiencies: draft.skillProficiencies ?? [],
      bardInstrumentChoices: draft.bardInstrumentChoices ?? [],
      raceLanguageChoices: draft.raceLanguageChoices ?? [],
      backgroundLanguageChoices: draft.backgroundLanguageChoices ?? [],
      backgroundSkillChoices: draft.backgroundSkillChoices ?? [],
      toolProficiencyChoices: draft.toolProficiencyChoices ?? [],
      backgroundEquipmentChoice: draft.backgroundEquipmentChoice ?? '',
      merchantAlternative: draft.merchantAlternative ?? '',
    }
  })
  const [races, setRaces] = useState<ReferenceItem[]>([])
  const [classes, setClasses] = useState<ReferenceItem[]>([])
  const [backgrounds, setBackgrounds] = useState<ReferenceItem[]>([])
  const [loadError, setLoadError] = useState('')
  const [portraitUploading, setPortraitUploading] = useState(false)
  const [portraitError, setPortraitError] = useState('')
  const [portraitCropSource, setPortraitCropSource] = useState('')
  const [portraitCropReady, setPortraitCropReady] = useState(false)
  const [portraitCropError, setPortraitCropError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [showHigherClassLevels, setShowHigherClassLevels] = useState(false)
  const [cantripPanelOpen, setCantripPanelOpen] = useState(false)
  const [tomeCantripDrawerOpen, setTomeCantripDrawerOpen] = useState(false)
  const [ancientSecretsDrawerKey, setAncientSecretsDrawerKey] = useState<string | null>(null)
  const [featPanelOpen, setFeatPanelOpen] = useState(false)
  const [featPanelLevel, setFeatPanelLevel] = useState(0)
  const [featDraft, setFeatDraft] = useState('')
  const [selectionPanelLevel, setSelectionPanelLevel] = useState(0)
  const [selectionPanelSlot, setSelectionPanelSlot] = useState<number | null>(null)
  const [spellLevelFilter, setSpellLevelFilter] = useState<number | null>(null)
  const [spellListSearch, setSpellListSearch] = useState('')
  const [cantripDraft, setCantripDraft] = useState<string[]>([])
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false)
  const [equipmentResetAction, setEquipmentResetAction] = useState<(() => void) | null>(null)
  const [abilityPopover, setAbilityPopover] = useState<string | null>(null)
  const [racialConfirmation, setRacialConfirmation] = useState<'apply' | 'continue' | null>(null)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const pendingStep = useRef<number | null>(null)
  const draftId = useRef(initialDraft?.id)
  const draftSaveQueue = useRef(Promise.resolve())
  const callbacks = useRef({ onComplete, onClose, onDeletePortrait, onPersistDraft, onSidebarSelect, onStepChange, onUploadPortrait })
  const previousActiveStep = useRef(activeStep)
  const abilitiesRef = useRef<HTMLDivElement>(null)
  const firstAbilityInputRef = useRef<HTMLInputElement>(null)
  const portraitCropperRef = useRef<ReactCropperElement>(null)
  const portraitCropSourceRef = useRef('')
  const className = normalizeTerm(classes.find((item) => item.id === character.characterClassId)?.name ?? '')
  const featSubclass = classFeatures[className]?.subclasses.find((subclass) => subclass.id === character.classSubclassId)
  const selectedFeats = Object.entries(character.classFeatureChoices)
    .filter(([key]) => key.startsWith('ability-score-increase:') && key.endsWith(':feat'))
    .map(([, selection]) => selection[0])
  const canCastFeats = selectedFeats.includes('iniciado-em-magia')
    || (['bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'mago'].includes(className) && character.level >= 1)
    || (['paladino', 'patrulheiro'].includes(className) && character.level >= 2)
    || (className === 'guerreiro' && character.classSubclassId === 'cavaleiro-arcano' && character.level >= 3)
    || (className === 'ladino' && character.classSubclassId === 'trapaceiro-arcano' && character.level >= 3)
  const featArmorProficiencies = [
    ...(classProficiencies[className]?.armor ?? []),
    ...(className === 'bardo' && character.classSubclassId === 'colegio-da-bravura' ? ['Armaduras médias'] : []),
    ...(className === 'clerigo' && featSubclass?.features.some((feature) => feature.description.includes('armaduras pesadas')) ? ['Armaduras pesadas'] : []),
    ...(normalizeTerm(races.find((race) => race.id === character.raceId)?.name ?? '') === 'anao' ? ['Armaduras leves', 'Armaduras médias'] : []),
    ...(selectedFeats.includes('protecao-leve') ? ['Armaduras leves'] : []),
    ...(selectedFeats.includes('protecao-moderada') ? ['Armaduras médias'] : []),
    ...(selectedFeats.includes('protecao-pesada') ? ['Armaduras pesadas'] : []),
  ]
  const savedCantrips = readSelectedCantrips(character.spells)
  const knownPactTomeCantrips = [...new Set([
    ...savedCantrips,
    ...getGrantedClassCantrips(className, character.classSubclassId, character.level, character.classFeatureChoices[`${character.characterClassId}:${character.classSubclassId}:2:Truque Adicional:land-bonus-cantrip`]?.[0]),
  ])]
  const selectedSpellsByLevel = readSelectedSpells(character.spells)
  const cantripProgression = className === 'guerreiro' && character.classSubclassId === 'cavaleiro-arcano' && character.level >= 3
    ? eldritchKnightSpellProgression[character.level - 3]?.[0] ?? 0
    : className === 'ladino' && character.classSubclassId === 'trapaceiro-arcano' && character.level >= 3
      ? arcaneTricksterSpellProgression[character.level - 3]?.[0] ?? 0
      : className === 'bardo' ? bardSpellProgression[character.level - 1]?.[0]
        : className === 'bruxo' ? warlockSpellProgression[character.level - 1]?.[0]
          : className === 'clerigo' ? clericSpellProgression[character.level - 1]?.[0]
            : className === 'druida' ? druidSpellProgression[character.level - 1]?.[0]
              : className === 'feiticeiro' ? sorcererSpellProgression[character.level - 1]?.[0]
                : className === 'mago' ? wizardSpellProgression[character.level - 1]?.[0]
                  : 0
  const cantripCount = cantripProgression ?? 0
  const selectedCantripSlots = Array.from({ length: cantripCount }, (_, index) => savedCantrips[index] ?? '')
  const selectedCantrips = selectedCantripSlots.filter(Boolean)
  const spellcastingAbility = className === 'guerreiro' && character.classSubclassId === 'cavaleiro-arcano'
    || className === 'ladino' && character.classSubclassId === 'trapaceiro-arcano'
    ? 'Inteligência'
    : spellcastingAbilityByClass[className]
  const cantripClass = className === 'guerreiro' && character.classSubclassId === 'cavaleiro-arcano'
    || className === 'ladino' && character.classSubclassId === 'trapaceiro-arcano'
    ? 'mago'
    : className
  const availableCantrips = cantripsByClass[cantripClass] ?? []
  const spellCatalogClass = cantripClass
  const circleTerrain = character.classFeatureChoices[
    `${character.characterClassId}:circulo-da-terra:2:Terreno do Círculo:terra`
  ]?.[0]
  const availableLeveledSpells = getSpellListForSelection(spellCatalogClass, character.classSubclassId, circleTerrain)
  const alwaysPreparedSpellNames = new Set(Object.values(getAlwaysPreparedSpells(className, character.classSubclassId, character.level, circleTerrain)).flat())
  const spellcastingProgression = (() : { slots: number[]; selectionLimit: number | null; selectionKind: 'known' | 'prepared' | 'spellbook'; pactSlotLevel: number } => {
    const levelIndex = character.level - 1
    const halfCasterIndex = character.level - 3
    if (className === 'bardo') {
      const row = bardSpellProgression[levelIndex]
      return { slots: row?.[2] ?? [], selectionLimit: row?.[1] ?? 0, selectionKind: 'known', pactSlotLevel: 0 }
    }
    if (className === 'bruxo') {
      const row = warlockSpellProgression[levelIndex]
      const pactSlotLevel = row?.[3] ?? 0
      const slots = Array.from({ length: pactSlotLevel }, (_, index) => index === pactSlotLevel - 1 ? row?.[2] ?? 0 : 0)
      return { slots, selectionLimit: row?.[1] ?? 0, selectionKind: 'known', pactSlotLevel }
    }
    if (className === 'clerigo') {
      const row = clericSpellProgression[levelIndex]
      return { slots: row?.[1] ?? [], selectionLimit: Math.max(1, character.level + (getAbilityModifier('wisdom') ?? 0)), selectionKind: 'prepared', pactSlotLevel: 0 }
    }
    if (className === 'druida') {
      const row = druidSpellProgression[levelIndex]
      return { slots: row?.[1] ?? [], selectionLimit: Math.max(1, character.level + (getAbilityModifier('wisdom') ?? 0)), selectionKind: 'prepared', pactSlotLevel: 0 }
    }
    if (className === 'feiticeiro') {
      const row = sorcererSpellProgression[levelIndex]
      return { slots: row?.[2] ?? [], selectionLimit: row?.[1] ?? 0, selectionKind: 'known', pactSlotLevel: 0 }
    }
    if (className === 'mago') {
      const row = wizardSpellProgression[levelIndex]
      return { slots: row?.[1] ?? [], selectionLimit: 6 + Math.max(0, character.level - 1) * 2, selectionKind: 'spellbook', pactSlotLevel: 0 }
    }
    if (className === 'paladino') {
      const slots = paladinSpellProgression[levelIndex] ?? []
      return { slots, selectionLimit: slots.length ? Math.max(1, Math.floor(character.level / 2) + (getAbilityModifier('charisma') ?? 0)) : 0, selectionKind: 'prepared', pactSlotLevel: 0 }
    }
    if (className === 'patrulheiro') {
      const row = rangerSpellProgression[levelIndex]
      return { slots: row?.[1] ?? [], selectionLimit: row?.[0] ?? 0, selectionKind: 'known', pactSlotLevel: 0 }
    }
    if (className === 'guerreiro' && character.classSubclassId === 'cavaleiro-arcano' && halfCasterIndex >= 0) {
      const row = eldritchKnightSpellProgression[halfCasterIndex]
      return { slots: row?.[2] ?? [], selectionLimit: row?.[1] ?? 0, selectionKind: 'known', pactSlotLevel: 0 }
    }
    if (className === 'ladino' && character.classSubclassId === 'trapaceiro-arcano' && halfCasterIndex >= 0) {
      const row = arcaneTricksterSpellProgression[halfCasterIndex]
      return { slots: row?.[2] ?? [], selectionLimit: row?.[1] ?? 0, selectionKind: 'known', pactSlotLevel: 0 }
    }
    return { slots: [], selectionLimit: 0, selectionKind: 'known', pactSlotLevel: 0 }
  })()
  const maxSpellLevel = spellcastingProgression.slots.length
  const spellLevelByName: Record<string, number> = Object.fromEntries(
    Object.entries(availableLeveledSpells).flatMap(([level, spells]) => spells.map((spell) => [spell, Number(level)])),
  )
  const hasLearnedSpellProgression = spellcastingProgression.selectionKind !== 'prepared'
  const currentKnownSpellCount = hasLearnedSpellProgression
    ? getKnownSpellCountAtClassLevel(className, character.classSubclassId, character.level) ?? 0
    : 0
  const savedClassLevelSpells = readSelectedClassLevelSpells(character.spells)
  const savedKnownSpells = (() => {
    try {
      const parsed: unknown = JSON.parse(character.spells)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      const knownSpells = (parsed as { knownSpells?: unknown }).knownSpells
      return Array.isArray(knownSpells) && knownSpells.every((name) => typeof name === 'string') ? knownSpells as string[] : null
    } catch {
      return null
    }
  })()
  const legacyKnownSpells = savedClassLevelSpells
    ? savedClassLevelSpells[character.level]
      ?? Object.entries(savedClassLevelSpells)
        .filter(([level]) => Number(level) <= character.level)
        .sort(([first], [second]) => Number(second) - Number(first))[0]?.[1]
      ?? []
    : Object.entries(selectedSpellsByLevel)
      .sort(([first], [second]) => Number(first) - Number(second))
      .flatMap(([level, spells]) => spells.map((name) => ({ name, level: Number(level) })))
      .filter(({ level }) => level <= maxSpellLevel)
      .map(({ name }) => name)
  const selectedKnownSpellSlots = Array.from({ length: currentKnownSpellCount }, (_, index) =>
    (savedKnownSpells ?? legacyKnownSpells)[index] ?? '',
  )
  const selectedLeveledSpellCount = hasLearnedSpellProgression
    ? selectedKnownSpellSlots.filter(Boolean).length
    : Object.values(selectedSpellsByLevel).flat().filter((name) => !alwaysPreparedSpellNames.has(name)).length
  const canSelectLeveledSpells = hasLearnedSpellProgression
    ? currentKnownSpellCount > 0
    : spellcastingProgression.selectionLimit !== null && spellcastingProgression.selectionLimit > 0 && maxSpellLevel > 0
  const hasSpellcastingChoices = cantripCount > 0 || canSelectLeveledSpells
  const visibleSteps = steps
    .map((label, index) => ({ label, index }))
    .filter(({ index }) => index !== 5 || hasSpellcastingChoices)
  const activeVisibleStep = visibleSteps.findIndex(({ index }) => index === activeStep)
  const displayedStepIndex = activeVisibleStep >= 0 ? activeVisibleStep : visibleSteps.length - 1
  const isFinalStep = activeStep === (hasSpellcastingChoices ? 5 : 4)
  const selectedPreparedSpells = Object.entries(selectedSpellsByLevel)
    .flatMap(([level, spells]) => spells.filter((name) => !alwaysPreparedSpellNames.has(name)).map((name) => ({ name, level: Number(level) })))
  const hitDie = classHitDice[className]
  const classLanguages = className === 'druida' ? ['Druídico'] : className === 'feiticeiro' && character.classSubclassId === 'linhagem-draconica' ? ['Dracônico'] : []
  const raceName = normalizeTerm(races.find((item) => item.id === character.raceId)?.name ?? '')
  const raceSkills = raceName === 'elfo' ? ['Percepção'] : raceName === 'meio-orc' ? ['Intimidação'] : []
  const constitutionModifier = getAbilityModifier('constitution')
  const hillDwarfBonus = normalizeTerm(character.racialChoice).includes('colina') ? 1 : 0
  const baseMaxHp = character.level === 1
    ? hitDie && constitutionModifier !== null ? String(Math.max(1, hitDie + constitutionModifier + hillDwarfBonus)) : ''
    : character.maxHp
  const featHitPointBonus = selectedFeats.includes('robusto') ? character.level * 2 : 0
  const maxHp = baseMaxHp ? String(Number(baseMaxHp) + featHitPointBonus) : ''

  const currentSnapshot = JSON.stringify({ ...character, maxHp: baseMaxHp, portraitUrl: '' })
  const lastSavedSnapshot = useRef(currentSnapshot)

  const persistDraftNow = useCallback(async (step = activeStep, value = character) => {
    if (!characterId && !hasMeaningfulCharacterData(value)) return

    const savedCharacter = { ...value, maxHp: value.level === 1 ? baseMaxHp : value.maxHp, portraitUrl: '' }
    const nextDraft = {
      ...(characterId ? { id: characterId } : draftId.current ? { id: draftId.current } : {}),
      character: savedCharacter,
      furthestStep: Math.max(activeStep, lastReachedStep, step),
      lastStep: step,
    }
    const pendingSave = draftSaveQueue.current.then(() => callbacks.current.onPersistDraft(nextDraft))
    draftSaveQueue.current = pendingSave.then(() => undefined, () => undefined)

    try {
      const persisted = await pendingSave
      if (!characterId) draftId.current = persisted.id
      lastSavedSnapshot.current = JSON.stringify(savedCharacter)
    } catch {
      toast.error('Não foi possível salvar as alterações da ficha. Verifique a conexão e tente novamente.')
      throw new Error('character-save-failed')
    }
  }, [activeStep, baseMaxHp, character, characterId, lastReachedStep, toast])

  useEffect(() => {
    callbacks.current = { onComplete, onClose, onDeletePortrait, onPersistDraft, onSidebarSelect, onStepChange, onUploadPortrait }
  }, [onComplete, onClose, onDeletePortrait, onPersistDraft, onSidebarSelect, onStepChange, onUploadPortrait])

  useEffect(() => {
    if (activeStep !== 5 || hasSpellcastingChoices || (character.characterClassId && classes.length === 0)) return
    void persistDraftNow(4).then(() => callbacks.current.onStepChange(4)).catch(() => undefined)
  }, [activeStep, character.characterClassId, classes.length, hasSpellcastingChoices, persistDraftNow])

  useEffect(() => {
    if (!featPanelOpen) return
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.wizard__cantrip-drawer-options')?.scrollTo(0, 0)
    })
  }, [featPanelOpen])

  useEffect(() => {
    return () => {
      if (portraitCropSourceRef.current) URL.revokeObjectURL(portraitCropSourceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!hasMeaningfulCharacterData(character) || currentSnapshot === lastSavedSnapshot.current) return
    const timer = window.setTimeout(() => {
      void persistDraftNow().catch(() => undefined)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [activeStep, baseMaxHp, character, currentSnapshot, lastReachedStep, persistDraftNow])

  useEffect(() => {
    if (previousActiveStep.current === activeStep) return
    previousActiveStep.current = activeStep
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    window.scrollTo({ top: 0, behavior })
  }, [activeStep])

  useEffect(() => {
    if (activeStep === 2 && character.abilityScoreMethod === 'manual-roll') firstAbilityInputRef.current?.focus({ preventScroll: true })
  }, [activeStep, character.abilityScoreMethod])

  useEffect(() => {
    if (!abilityPopover) return

    function closeOnOutsideClick(event: PointerEvent) {
      if (!abilitiesRef.current?.contains(event.target as Node)) setAbilityPopover(null)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAbilityPopover(null)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [abilityPopover])

  useEffect(() => {
    if (!supabase) return
    const client = supabase

    async function loadReferences() {
      const [racesResult, classesResult, backgroundsResult] = await Promise.all([
        client.from('races').select('id, name').order('name'),
        client.from('character_classes').select('id, name').order('name'),
        client.from('backgrounds').select('id, name').order('name'),
      ])

      const error = racesResult.error ?? classesResult.error ?? backgroundsResult.error
      if (error) {
        setLoadError('Não foi possível carregar as opções do banco agora.')
        return
      }

      setRaces(racesResult.data ?? [])
      setClasses(classesResult.data ?? [])
      setBackgrounds(backgroundsResult.data ?? [])
    }

    void loadReferences()
  }, [])

  function updateCharacter<K extends keyof CharacterDetails>(key: K, value: CharacterDetails[K]) {
    const equipmentFields: (keyof CharacterDetails)[] = [
      'characterClassId', 'classSubclassId', 'classFeatureChoices', 'level', 'primalPath', 'primalTotemChoices',
      'raceId', 'racialChoice', 'backgroundId', 'toolProficiencyChoices', 'backgroundEquipmentChoice',
    ]
    const update = (current: CharacterDetails) => {
      const invalidatesAbilityIncreases = key === 'characterClassId' || key === 'level'
        ? current[key] !== value
        : key === 'abilities' && abilityValuesChanged(current.abilities, value as CharacterDetails['abilities'])
      const base = invalidatesAbilityIncreases
        ? resetClassAbilityScoreIncreases(current, key === 'abilities' ? value as CharacterDetails['abilities'] : undefined)
        : current
      return { ...base, [key]: value }
    }
    if (equipmentFields.includes(key) && !(key === 'classFeatureChoices' && !classFeatureChoiceAffectsEquipment(value as CharacterDetails['classFeatureChoices']))) requestStartingEquipmentReset(update)
    else setCharacter(update)
  }

  function abilityValuesChanged(first: Record<string, string>, second: Record<string, string>) {
    return abilityLabels.some(([ability]) => first[ability] !== second[ability])
  }

  function resetClassAbilityScoreIncreases(current: CharacterDetails, replacementAbilities?: Record<string, string>): CharacterDetails {
    const abilities = { ...current.abilities }
    const increases = current.abilityScoreIncreases
    for (const selections of Object.values(increases?.selections ?? {})) {
      const amount = selections.length === 1 ? 2 : selections.length === 2 ? 1 : 0
      for (const ability of selections) {
        const value = Number(abilities[ability])
        if (amount && abilities[ability] !== '' && Number.isFinite(value)) abilities[ability] = String(value - amount)
      }
    }
    for (const { ability, amount } of Object.values(current.featAbilityIncreases ?? {})) {
      const value = Number(abilities[ability])
      if (amount && abilities[ability] !== '' && Number.isFinite(value)) abilities[ability] = String(value - amount)
    }
    if (replacementAbilities) {
      for (const [ability, value] of Object.entries(replacementAbilities)) {
        if (value !== current.abilities[ability]) abilities[ability] = value
      }
    }
    return {
      ...current,
      abilities,
      classFeatureChoices: Object.fromEntries(Object.entries(current.classFeatureChoices)
        .filter(([key]) => !key.startsWith('ability-score-increase:'))),
      abilityScoreIncreases: { classId: '', selections: {} },
      featAbilityIncreases: {},
    }
  }

  function classAbilityScoreIncreaseKey(classId: string, level: number) {
    return `ability-score-increase:${classId}:${level}`
  }

  function classAbilityScoreIncreaseModeKey(key: string) {
    return `${key}:mode`
  }

  function classAbilityScoreIncreaseFeatKey(key: string) {
    return `${key}:feat`
  }

  function selectClassAbilityIncreaseMode(key: string, mode: 'ability' | 'feat') {
    setCharacter((current) => {
      const choices = { ...current.classFeatureChoices }
      const increases = current.abilityScoreIncreases ?? { classId: '', selections: {} }
      const abilities = { ...current.abilities }
      if (mode === 'feat') {
        const confirmed = increases.classId === current.characterClassId ? increases.selections[key] : undefined
        if (confirmed) {
          const amount = confirmed.length === 1 ? 2 : 1
          for (const ability of confirmed) {
            const score = Number(abilities[ability])
            if (abilities[ability] !== '' && Number.isFinite(score)) abilities[ability] = String(score - amount)
          }
        }
        delete choices[key]
        const selections = { ...increases.selections }
        delete selections[key]
        return {
          ...current,
          abilities,
          classFeatureChoices: { ...choices, [classAbilityScoreIncreaseModeKey(key)]: ['feat'] },
          abilityScoreIncreases: { ...increases, selections },
        }
      }
      const featKey = classAbilityScoreIncreaseFeatKey(key)
      const featAbilityIncreases = { ...(current.featAbilityIncreases ?? {}) }
      const previousFeatIncrease = featAbilityIncreases[featKey]
      if (previousFeatIncrease) {
        const score = Number(abilities[previousFeatIncrease.ability])
        if (previousFeatIncrease.amount && Number.isFinite(score)) abilities[previousFeatIncrease.ability] = String(score - previousFeatIncrease.amount)
        delete featAbilityIncreases[featKey]
      }
      delete choices[classAbilityScoreIncreaseFeatKey(key)]
      return {
        ...current,
        abilities,
        classFeatureChoices: { ...choices, [classAbilityScoreIncreaseModeKey(key)]: ['ability'] },
        featAbilityIncreases,
      }
    })
  }

  function openFeatSelection(level: number, selected = '') {
    setFeatPanelLevel(level)
    setFeatDraft(selected)
    setFeatPanelOpen(true)
  }

  function confirmFeatSelection() {
    const key = classAbilityScoreIncreaseKey(character.characterClassId, featPanelLevel)
    const feat = feats.find((item) => item.id === featDraft)
    if (!feat || getFeatPrerequisiteFailure(feat, character.abilities, canCastFeats, featArmorProficiencies)) return
    const alreadySelected = Object.entries(character.classFeatureChoices)
      .filter(([choiceKey]) => choiceKey.startsWith('ability-score-increase:') && choiceKey.endsWith(':feat') && choiceKey !== classAbilityScoreIncreaseFeatKey(key))
      .some(([, selected]) => selected[0] === feat.id)
    if (alreadySelected && !feat.repeatable) return
    setCharacter((current) => {
      const featKey = classAbilityScoreIncreaseFeatKey(key)
      const previousFeatId = current.classFeatureChoices[featKey]?.[0]
      const featAbilityIncreases = { ...(current.featAbilityIncreases ?? {}) }
      const previousIncrease = featAbilityIncreases[featKey]
      const abilities = { ...current.abilities }
      if (previousIncrease && previousFeatId !== feat.id) {
        const value = Number(abilities[previousIncrease.ability])
        if (previousIncrease.amount && Number.isFinite(value)) abilities[previousIncrease.ability] = String(value - previousIncrease.amount)
        delete featAbilityIncreases[featKey]
      }
      if (previousFeatId !== feat.id) {
        const bonus = getFeatAbilityBonus(feat, abilities)
        if (bonus) {
          if (bonus.amount) abilities[bonus.ability] = String(Number(abilities[bonus.ability]) + bonus.amount)
          featAbilityIncreases[featKey] = bonus
        }
      }
      return {
        ...current,
        abilities,
        featAbilityIncreases,
        classFeatureChoices: {
          ...current.classFeatureChoices,
          [classAbilityScoreIncreaseModeKey(key)]: ['feat'],
          [featKey]: [feat.id],
        },
      }
    })
    setFeatPanelOpen(false)
  }

  function getClassAbilityScoreIncreaseTotals() {
    const totals: Record<string, number> = {}
    for (const selections of Object.values(character.abilityScoreIncreases?.selections ?? {})) {
      const amount = selections.length === 1 ? 2 : selections.length === 2 ? 1 : 0
      for (const ability of selections) totals[ability] = (totals[ability] ?? 0) + amount
    }
    return totals
  }

  function getFeatAbilityIncreaseTotals() {
    const totals: Record<string, number> = {}
    for (const { ability, amount } of Object.values(character.featAbilityIncreases ?? {})) {
      totals[ability] = (totals[ability] ?? 0) + amount
    }
    return totals
  }

  function selectFeatAbilityIncrease(key: string, ability: string) {
    const featId = character.classFeatureChoices[classAbilityScoreIncreaseFeatKey(key)]?.[0]
    const feat = feats.find((item) => item.id === featId)
    if (!feat?.abilityBonus || !('chooseFrom' in feat.abilityBonus) || !feat.abilityBonus.chooseFrom.includes(ability)) return
    setCharacter((current) => {
      const featKey = classAbilityScoreIncreaseFeatKey(key)
      const abilities = { ...current.abilities }
      const featAbilityIncreases = { ...(current.featAbilityIncreases ?? {}) }
      const previous = featAbilityIncreases[featKey]
      if (previous) {
        const previousScore = Number(abilities[previous.ability])
        if (previous.amount && Number.isFinite(previousScore)) abilities[previous.ability] = String(previousScore - previous.amount)
      }
      const bonus = getFeatAbilityBonus(feat, abilities, ability)
      if (!bonus) return current
      if (bonus.amount) abilities[ability] = String(Number(abilities[ability]) + bonus.amount)
      featAbilityIncreases[featKey] = bonus
      return { ...current, abilities, featAbilityIncreases }
    })
  }

  function toggleClassAbilityIncrease(key: string, ability: string) {
    setCharacter((current) => {
      const selected = current.classFeatureChoices[key] ?? []
      const increases = current.abilityScoreIncreases ?? { classId: '', selections: {} }
      const confirmed = increases.classId === current.characterClassId ? increases.selections[key] : undefined
      const abilities = { ...current.abilities }
      if (confirmed) {
        const amount = confirmed.length === 1 ? 2 : 1
        for (const previousAbility of confirmed) {
          const value = Number(abilities[previousAbility])
          if (abilities[previousAbility] !== '' && Number.isFinite(value)) abilities[previousAbility] = String(value - amount)
        }
      }
      const nextSelection = selected.includes(ability)
        ? selected.filter((value) => value !== ability)
        : selected.length < 2 ? [...selected, ability] : selected
      const classFeatureChoices = { ...current.classFeatureChoices }
      if (nextSelection.length) classFeatureChoices[key] = nextSelection
      else delete classFeatureChoices[key]
      const selections = { ...increases.selections }
      delete selections[key]
      return {
        ...current,
        abilities,
        classFeatureChoices,
        abilityScoreIncreases: { ...increases, selections },
      }
    })
  }

  function confirmClassAbilityIncrease(key: string) {
    setCharacter((current) => {
      if (!abilityScoresAreValid()) return current
      const selected = current.classFeatureChoices[key] ?? []
      if (selected.length < 1 || selected.length > 2 || new Set(selected).size !== selected.length) return current
      const amount = selected.length === 1 ? 2 : 1
      if (selected.some((ability) => {
        const value = Number(current.abilities[ability])
        return !current.abilities[ability] || !Number.isInteger(value) || value < 1 || value + amount > 20
      })) return current
      const increases = current.abilityScoreIncreases ?? { classId: '', selections: {} }
      if (increases.classId === current.characterClassId && increases.selections[key]) return current
      const abilities = { ...current.abilities }
      for (const ability of selected) abilities[ability] = String(Number(abilities[ability]) + amount)
      return {
        ...current,
        abilities,
        abilityScoreIncreases: {
          classId: current.characterClassId,
          selections: { ...increases.selections, [key]: [...selected] },
        },
      }
    })
  }

  function classFeatureChoiceAffectsEquipment(value: CharacterDetails['classFeatureChoices']) {
    const normalizedClass = normalizeTerm(classes.find((item) => item.id === character.characterClassId)?.name ?? '')
    if (normalizedClass === 'bruxo') {
      const pactChoice = (choices: CharacterDetails['classFeatureChoices']) => Object.fromEntries(
        Object.entries(choices).filter(([key]) => key.includes('Dádiva do Pacto')),
      )
      return JSON.stringify(pactChoice(value)) !== JSON.stringify(pactChoice(character.classFeatureChoices))
    }
    return false
  }

  function updateClassFeatureChoices(update: (current: CharacterDetails) => CharacterDetails) {
    const next = update(character)
    if (classFeatureChoiceAffectsEquipment(next.classFeatureChoices)) requestStartingEquipmentReset(update)
    else setCharacter(update)
  }

  function requestStartingEquipmentReset(update: (current: CharacterDetails) => CharacterDetails) {
    const apply = () => setCharacter((current) => {
      const candidate = update(current)
      const changesClassOrLevel = candidate.characterClassId !== current.characterClassId || candidate.level !== current.level
      const next = changesClassOrLevel ? update(resetClassAbilityScoreIncreases(current)) : candidate
      const inventory = readInventory(current.equipment, equipmentCatalog ?? undefined)
      return { ...next, equipment: JSON.stringify({ ...inventory, initialEquipmentConfirmed: false, choices: {} }) }
    })
    if (readInventory(character.equipment, equipmentCatalog ?? undefined).initialEquipmentConfirmed) setEquipmentResetAction(() => apply)
    else apply()
  }

  function confirmStartingEquipmentReset() {
    equipmentResetAction?.()
    setEquipmentResetAction(null)
  }

  async function selectPortrait(file?: File) {
    if (!file || portraitUploading) return
    setPortraitError('')
    setPortraitUploading(true)
    const previousPath = character.portraitPath
    let uploadedPath = ''
    try {
      const uploaded = await callbacks.current.onUploadPortrait(file)
      uploadedPath = uploaded.path
      const nextCharacter = { ...character, portraitPath: uploaded.path, portraitUrl: uploaded.url }
      await persistDraftNow(activeStep, nextCharacter)
      setCharacter(nextCharacter)
      if (previousPath && previousPath !== uploaded.path) {
        await callbacks.current.onDeletePortrait(previousPath).catch(() => undefined)
      }
    } catch (error) {
      if (uploadedPath && uploadedPath !== previousPath) {
        await callbacks.current.onDeletePortrait(uploadedPath).catch(() => undefined)
      }
      setPortraitError(error instanceof Error && error.message !== 'character-save-failed'
        ? error.message
        : 'A imagem foi enviada, mas não foi possível salvar a ficha. Tente novamente.')
    } finally {
      setPortraitUploading(false)
    }
  }

  function openPortraitCropper(file?: File) {
    if (!file) return
    setPortraitError('')
    setPortraitCropError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPortraitError('Use uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPortraitError('A imagem deve ter no máximo 5 MB.')
      return
    }
    setPortraitCropReady(false)
    const source = URL.createObjectURL(file)
    portraitCropSourceRef.current = source
    setPortraitCropSource(source)
  }

  function closePortraitCropper() {
    if (portraitCropSourceRef.current) URL.revokeObjectURL(portraitCropSourceRef.current)
    portraitCropSourceRef.current = ''
    setPortraitCropSource('')
    setPortraitCropReady(false)
    setPortraitCropError('')
  }

  async function confirmPortraitCrop() {
    try {
      const canvas = portraitCropperRef.current?.cropper.getCroppedCanvas({
        width: 512,
        height: 512,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      })
      if (!canvas) throw new Error('crop-canvas-unavailable')

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('crop-blob-unavailable')), 'image/jpeg', 0.9)
      })
      closePortraitCropper()
      void selectPortrait(new File([blob], 'retrato-personagem.jpg', { type: 'image/jpeg' }))
    } catch {
      setPortraitCropError('Não foi possível processar o recorte. Ajuste a imagem e tente novamente.')
    }
  }

  function getAbilityModifier(ability: string) {
    const value = character.abilities[ability]
    if (!value || !Number.isFinite(Number(value))) return null
    const score = Number(value) - (character.appliedRacialBonuses[ability] ?? 0) + (getRacialAbilityBonuses()[ability] ?? 0)
    return Math.floor((score - 10) / 2)
  }

  function getBackgroundRulesFor(current = character) {
    const background = backgrounds.find((item) => item.id === current.backgroundId)
    return Object.entries(backgroundRules).find(([name]) => normalizeTerm(name) === normalizeTerm(background?.name ?? ''))?.[1]
  }

  function getRaceLanguageRulesFor(current = character) {
    const race = races.find((item) => item.id === current.raceId)
    return racialLanguages[normalizeTerm(race?.name ?? '')] ?? { fixed: [] }
  }

  function getRaceLanguageChoiceCount(current = character) {
    const race = races.find((item) => item.id === current.raceId)
    const extraHighElfLanguage = normalizeTerm(race?.name ?? '') === 'elfo' && normalizeTerm(current.racialChoice).includes('alto elfo') ? 1 : 0
    return (getRaceLanguageRulesFor(current).choices ?? 0) + extraHighElfLanguage
  }

  function selectBackground(backgroundId: string) {
    if (backgroundId === character.backgroundId) return
    const rules = getBackgroundRulesFor({ ...character, backgroundId })
    requestStartingEquipmentReset((current) => ({
      ...current,
      backgroundId,
      backgroundLanguageChoices: [],
      backgroundSkillChoices: [],
      merchantAlternative: '',
      toolProficiencyChoices: [],
      backgroundEquipmentChoice: '',
      skillProficiencies: current.skillProficiencies.filter((skill) => !rules?.skills.includes(skill)),
    }))
  }

  function toggleLanguageChoice(language: string) {
    setCharacter((current) => {
      const raceCount = getRaceLanguageChoiceCount(current)
      const background = getBackgroundRulesFor(current)
      const backgroundCount = (background?.languageChoices ?? 0) + (background?.merchantAlternative && current.merchantAlternative === 'language' ? 1 : 0)
      const selected = [...current.raceLanguageChoices, ...current.backgroundLanguageChoices]
      const next = selected.includes(language) ? selected.filter((value) => value !== language)
        : selected.length < raceCount + backgroundCount && !getRaceLanguageRulesFor(current).fixed.includes(language)
          ? [...selected, language] : selected
      return {
        ...current,
        raceLanguageChoices: next.slice(0, raceCount),
        backgroundLanguageChoices: next.slice(raceCount),
      }
    })
  }

  function toggleBackgroundSkillChoice(skill: string) {
    setCharacter((current) => {
      const rules = getBackgroundRulesFor(current)
      const previous = current.backgroundSkillChoices ?? []
      const next = previous.includes(skill)
        ? previous.filter((selected) => selected !== skill)
        : previous.length < (rules?.skillChoiceCount ?? 0) && rules?.skillChoices?.includes(skill)
          ? [...previous, skill]
          : previous
      return { ...current, backgroundSkillChoices: next }
    })
  }

  function selectAbilityScoreMethod(method: AbilityScoreMethod) {
    if (Object.values(character.appliedRacialBonuses).some((bonus) => bonus > 0)) return
    if (character.abilityScoreMethod === method) return
    const emptyScores = Object.fromEntries(abilityLabels.map(([key]) => [key, method === 'point-buy' ? '8' : '']))
    setAbilityPopover(null)
    setCharacter((current) => ({
      ...resetClassAbilityScoreIncreases(current),
      abilityScoreMethod: method,
      abilities: emptyScores,
      appliedRacialBonuses: {},
    }))
  }

  function resetRacialBonuses<K extends 'raceId' | 'racialChoice' | 'racialAbilityChoices'>(key: K, value: CharacterDetails[K]) {
    setCharacter((current) => {
      const base = resetClassAbilityScoreIncreases(current)
      const abilities = { ...base.abilities }
      for (const [ability, bonus] of Object.entries(base.appliedRacialBonuses)) {
        const currentValue = Number(abilities[ability])
        if (abilities[ability] !== '' && Number.isFinite(currentValue)) abilities[ability] = String(currentValue - bonus)
      }

      return {
        ...base,
        [key]: value,
        ...(key === 'raceId' ? {
          racialChoice: '',
          racialAbilityChoices: [],
          raceLanguageChoices: [],
          backgroundLanguageChoices: [],
        } : key === 'racialChoice' ? { raceLanguageChoices: [] } : {}),
        abilities,
        appliedRacialBonuses: {},
      }
    })
  }

  function getRacialAbilityBonuses(current = character) {
    const race = races.find((item) => item.id === current.raceId)
    const raceName = normalizeTerm(race?.name ?? '')
    const choice = normalizeTerm(current.racialChoice)
    const bonuses = { ...(racialAbilityBonuses[raceName] ?? {}) }
    const add = (ability: string, amount: number) => {
      bonuses[ability] = (bonuses[ability] ?? 0) + amount
    }

    if (raceName === 'anao') {
      if (choice.includes('colina')) add('wisdom', 1)
      if (choice.includes('montanha')) add('strength', 2)
    } else if (raceName === 'elfo') {
      if (choice.includes('alto')) add('intelligence', 1)
      if (choice.includes('floresta')) add('wisdom', 1)
      if (choice.includes('drow')) add('charisma', 1)
    } else if (raceName === 'halfling') {
      if (choice.includes('leves')) add('charisma', 1)
      if (choice.includes('robusto')) add('constitution', 1)
    } else if (raceName === 'humano') {
      if (choice.includes('padrao')) {
        for (const [ability] of abilityLabels) add(ability, 1)
      } else if (choice.includes('variante')) {
        for (const ability of current.racialAbilityChoices.slice(0, 3)) add(ability, 1)
      }
    } else if (raceName === 'gnomo') {
      if (choice.includes('floresta')) add('dexterity', 1)
      if (choice.includes('rochas')) add('constitution', 1)
    } else if (raceName === 'meio-elfo') {
      add('charisma', 2)
      for (const ability of current.racialAbilityChoices.slice(0, 2)) {
        if (ability !== 'charisma') add(ability, 1)
      }
    }

    return bonuses
  }

  function revertRacialBonuses() {
    setCharacter((current) => {
      const base = resetClassAbilityScoreIncreases(current)
      const abilities = { ...base.abilities }
      for (const [ability, bonus] of Object.entries(base.appliedRacialBonuses)) {
        const value = Number(abilities[ability])
        if (abilities[ability] !== '' && Number.isFinite(value)) abilities[ability] = String(value - bonus)
      }
      return { ...base, abilities, appliedRacialBonuses: {} }
    })
  }

  function abilityScoresAreValid() {
    const method = character.abilityScoreMethod
    if (!method) return false

    const classIncreases = getClassAbilityScoreIncreaseTotals()
    const featIncreases = getFeatAbilityIncreaseTotals()
    const scores = abilityLabels.map(([key]) => {
      const value = character.abilities[key]
      return value === '' ? NaN : Number(value) - (character.appliedRacialBonuses[key] ?? 0) - (classIncreases[key] ?? 0) - (featIncreases[key] ?? 0)
    })
    if (scores.some((score) => !Number.isInteger(score))) return false
    if (method === 'manual-roll') return scores.every((score) => score >= 3 && score <= 18)
    if (method === 'standard-array') {
      return scores.every((score) => standardArray.includes(score)) && new Set(scores).size === standardArray.length
    }
    return scores.every((score) => score >= 8 && score <= 15) &&
      scores.reduce((total, score) => total + pointBuyCosts[score], 0) <= 27
  }

  function racialAbilityChoicesAreValid() {
    const race = races.find((item) => item.id === character.raceId)
    const raceName = normalizeTerm(race?.name ?? '')
    const choice = normalizeTerm(character.racialChoice)
    const selectionCount = raceName === 'humano' && choice.includes('variante') ? 3 : raceName === 'meio-elfo' ? 2 : 0
    const choices = character.racialAbilityChoices.slice(0, selectionCount)
    return selectionCount === 0 || (
      choices.length === selectionCount &&
      new Set(choices).size === selectionCount &&
      (raceName !== 'meio-elfo' || !choices.includes('charisma'))
    )
  }

  function racialBonusesAreApplied() {
    const bonuses = Object.entries(getRacialAbilityBonuses()).filter(([, bonus]) => bonus > 0)
    return bonuses.length === 0 || (
      bonuses.every(([ability, bonus]) => character.appliedRacialBonuses[ability] === bonus) &&
      Object.entries(character.appliedRacialBonuses).every(([ability, bonus]) => bonus <= 0 || bonuses.some(([key, value]) => key === ability && value === bonus))
    )
  }

  function canConfirmRacialBonuses() {
    const race = races.find((item) => item.id === character.raceId)
    const configuration = race ? racialConfigurations[race.name] : undefined
    const raceIsConfigured = Boolean(race) && (!configuration?.choices || Boolean(character.racialChoice))
    const selectedClass = classes.some((item) => item.id === character.characterClassId)
    return selectedClass && !racialBonusesAreApplied() && raceIsConfigured && abilityScoresAreValid() && racialAbilityChoicesAreValid()
  }

  function abilitiesSectionIsComplete() {
    const selectedClass = classes.some((item) => item.id === character.characterClassId)
    const race = races.find((item) => item.id === character.raceId)
    const configuration = race ? racialConfigurations[race.name] : undefined
    const raceIsConfigured = Boolean(race) && (!configuration?.choices || Boolean(character.racialChoice))
    return selectedClass && raceIsConfigured && abilityScoresAreValid() && racialAbilityChoicesAreValid() && racialBonusesAreApplied()
  }

  function hitPointsSectionIsComplete() {
    return abilitiesSectionIsComplete() && Boolean(maxHp) && Number.isInteger(Number(maxHp)) && Number(maxHp) >= 1
  }

  function backgroundSectionIsComplete() {
    const background = getBackgroundRulesFor()
    return hitPointsSectionIsComplete() && Boolean(background) &&
      (character.backgroundSkillChoices?.length ?? 0) === (background?.skillChoiceCount ?? 0) &&
      (!background?.merchantAlternative || Boolean(character.merchantAlternative))
  }

  function getErrors(step = activeStep) {
    const errors: Record<string, string> = {}
    if (step === 0) {
      if (!character.name.trim()) errors.name = 'Informe o nome do personagem para continuar.'
      if (!Number.isInteger(character.level) || character.level < 1 || character.level > 20) errors.level = 'Selecione um nível entre 1 e 20.'
      if (!character.experiencePoints || !Number.isInteger(Number(character.experiencePoints)) || Number(character.experiencePoints) < 0) errors.experiencePoints = 'Informe uma quantidade de XP igual ou maior que zero.'
    }
    if (step === 1) {
      const selectedRace = races.find((race) => race.id === character.raceId)
      const configuration = selectedRace ? racialConfigurations[selectedRace.name] : undefined
      if (!selectedRace) errors.raceId = 'Selecione uma raça para continuar.'
      if (configuration?.choices && !configuration.choices.some((choice) => choice.name === character.racialChoice)) {
        errors.racialChoice = `Selecione uma opção de ${configuration.choiceLabel?.toLowerCase() ?? 'sub-raça'} para continuar.`
      }
    }
    if (step === 2) {
      if (!classes.some((item) => item.id === character.characterClassId)) {
        errors.characterClassId = 'Selecione a classe do personagem.'
        return errors
      }
      if (!character.abilityScoreMethod) errors.abilityScoreMethod = 'Escolha um método para definir as habilidades.'
      if (!abilityScoresAreValid()) errors.abilities = character.abilityScoreMethod === 'manual-roll'
        ? 'Preencha as seis habilidades com valores inteiros entre 3 e 18, antes dos bônus raciais.'
        : character.abilityScoreMethod === 'standard-array'
          ? 'Distribua 15, 14, 13, 12, 10 e 8, sem repetir valores.'
          : 'Defina as seis habilidades entre 8 e 15, gastando no máximo 27 pontos.'
      const race = races.find((item) => item.id === character.raceId)
      const raceName = normalizeTerm(race?.name ?? '')
      const choice = normalizeTerm(character.racialChoice)
      const selectionCount = raceName === 'humano' && choice.includes('variante') ? 3 : raceName === 'meio-elfo' ? 2 : 0
      const choices = character.racialAbilityChoices.slice(0, selectionCount)
      if (selectionCount > 0 && (
        choices.length !== selectionCount || new Set(choices).size !== selectionCount ||
        (raceName === 'meio-elfo' && choices.includes('charisma'))
      )) errors.racialAbilityChoices = `Escolha ${selectionCount} habilidades diferentes para receber os bônus raciais.`
      if (errors.abilityScoreMethod || errors.abilities || errors.racialAbilityChoices) return errors

      if (!maxHp || !Number.isInteger(Number(maxHp)) || Number(maxHp) < 1) {
        errors.maxHp = character.level === 1
          ? 'Selecione a classe e defina Constituição para calcular os PV do 1º nível.'
          : 'Informe os PV máximos como um número inteiro maior que zero.'
        return errors
      }

      const background = backgrounds.find((item) => item.id === character.backgroundId)
      const backgroundRulesForCharacter = getBackgroundRulesFor()
      if (!background || !backgroundRulesForCharacter) {
        errors.backgroundId = 'Selecione um antecedente com regras disponíveis.'
        return errors
      }
      if (backgroundRulesForCharacter.merchantAlternative && !character.merchantAlternative) {
        errors.merchantAlternative = 'Escolha ferramentas de navegador ou um idioma adicional.'
        return errors
      }

      const raceLanguageCount = getRaceLanguageChoiceCount()
      const backgroundLanguageCount = (backgroundRulesForCharacter?.languageChoices ?? 0) +
        (backgroundRulesForCharacter?.merchantAlternative && character.merchantAlternative === 'language' ? 1 : 0)
      const allLanguageChoices = [...character.raceLanguageChoices, ...character.backgroundLanguageChoices]
      const languageCount = raceLanguageCount + backgroundLanguageCount
      if (character.raceLanguageChoices.length !== raceLanguageCount ||
        character.backgroundLanguageChoices.length !== backgroundLanguageCount ||
        new Set(allLanguageChoices).size !== allLanguageChoices.length ||
        allLanguageChoices.some((language) => getRaceLanguageRulesFor().fixed.includes(language))) {
        errors.languages = `Escolha ${languageCount} ${languageCount === 1 ? 'idioma' : 'idiomas'} para continuar.`
      }

      const selectedClass = classes.find((item) => item.id === character.characterClassId)
      const normalizedClassName = normalizeTerm(selectedClass?.name ?? '')
      const proficiencies = classProficiencies[normalizedClassName]
      const classSkills = new Set(proficiencies?.skills ?? [])
      const loreSubclass = classFeatures[normalizedClassName]?.subclasses.find((subclass) => subclass.id === character.classSubclassId)
      const loreFeature = loreSubclass?.features.find((feature) => feature.choices?.some((choice) => choice.id === 'lore-additional-skills'))
      const loreChoice = loreFeature?.choices?.find((choice) => choice.id === 'lore-additional-skills')
      const loreChoiceKey = loreFeature && loreChoice
        ? `${character.characterClassId}:${character.classSubclassId}:${loreFeature.level}:${loreFeature.name}:${loreChoice.id}`
        : ''
      const loreSkills = normalizedClassName === 'bardo' && character.level >= 3 && loreChoiceKey
        ? character.classFeatureChoices[loreChoiceKey] ?? []
        : []
      const clericChoices = Object.entries(character.classFeatureChoices)
        .filter(([key]) => key.startsWith(`${character.characterClassId}:${character.classSubclassId}:`))
      const knowledgeSkills = normalizedClassName === 'clerigo' && character.classSubclassId === 'dominio-do-conhecimento'
        ? clericChoices.filter(([key]) => key.endsWith(':knowledge-skills')).flatMap(([, choices]) => choices)
        : []
      const natureSkills = normalizedClassName === 'clerigo' && character.classSubclassId === 'dominio-da-natureza'
        ? clericChoices.filter(([key]) => key.endsWith(':nature-skill')).flatMap(([, choices]) => choices)
        : []
      const grantedSkills = new Set([...(backgroundRulesForCharacter?.skills ?? []), ...(character.backgroundSkillChoices ?? []), ...raceSkills, ...loreSkills, ...knowledgeSkills, ...natureSkills])
      if (!(proficiencies && character.skillProficiencies.length === proficiencies.skillCount &&
        new Set(character.skillProficiencies).size === character.skillProficiencies.length &&
        character.skillProficiencies.every((skill) => classSkills.has(skill) && !grantedSkills.has(skill)))) errors.skillProficiencies = `Escolha ${proficiencies?.skillCount ?? 'as'} perícias da classe, sem repetir as concedidas pela raça ou pelo antecedente.`
      const toolChoiceOptions = proficiencies?.toolChoiceOptions ?? musicalInstruments
      if ((proficiencies?.instrumentChoiceCount || proficiencies?.toolChoiceOptions) && (character.bardInstrumentChoices.length !== (proficiencies.instrumentChoiceCount ?? 1) ||
        new Set(character.bardInstrumentChoices).size !== character.bardInstrumentChoices.length ||
        character.bardInstrumentChoices.some((instrument) => !toolChoiceOptions.includes(instrument)))) {
        errors.bardInstrumentChoices = proficiencies.toolChoiceOptions ? 'Escolha um tipo de ferramenta de artesão ou um instrumento musical.' : `Escolha ${proficiencies.instrumentChoiceCount} instrumentos musicais diferentes.`
      }
      if (backgroundRulesForCharacter.toolChoice && (character.toolProficiencyChoices.length !== 1 || !backgroundRulesForCharacter.toolChoice.includes(character.toolProficiencyChoices[0]))) errors.toolProficiencyChoices = 'Escolha uma proficiência com ferramenta do antecedente.'
      if (backgroundRulesForCharacter.skillChoiceCount &&
        (character.backgroundSkillChoices?.length !== backgroundRulesForCharacter.skillChoiceCount ||
          new Set(character.backgroundSkillChoices).size !== character.backgroundSkillChoices.length ||
          character.backgroundSkillChoices.some((skill) => !backgroundRulesForCharacter.skillChoices?.includes(skill)))) {
        errors.backgroundSkillChoices = `Escolha ${backgroundRulesForCharacter.skillChoiceCount} perícias do antecedente.`
      }
      if (backgroundRulesForCharacter.requiredLanguageOptions && !backgroundRulesForCharacter.requiredLanguageOptions.some((language) => character.backgroundLanguageChoices.includes(language))) errors.languages = 'Escolha ao menos um dos idiomas permitidos pelo antecedente Assombrado.'
    }
    if (step === 3 && normalizeTerm(selectedName(classes, character.characterClassId)) === 'barbaro' && character.level >= 3 && !character.primalPath) {
      errors.primalPath = 'Escolha um Caminho Primitivo para o bárbaro a partir do nível 3.'
    }
    if (step === 3 && normalizeTerm(selectedName(classes, character.characterClassId)) === 'barbaro' && character.primalPath === 'totem-warrior') {
      if (character.level >= 3 && !character.primalTotemChoices.spiritualTotem) errors['primalTotemChoices.spiritualTotem'] = 'Escolha um animal para o Totem Espiritual.'
      if (character.level >= 6 && !character.primalTotemChoices.beastAspect) errors['primalTotemChoices.beastAspect'] = 'Escolha um animal para o Aspecto da Besta.'
      if (character.level >= 14 && !character.primalTotemChoices.totemicAttunement) errors['primalTotemChoices.totemicAttunement'] = 'Escolha um animal para a Sintonia Totêmica.'
    }
    if (step === 3) {
      const featureData = classFeatures[normalizeTerm(selectedName(classes, character.characterClassId))]
      if (featureData) {
        const selectedSubclass = featureData.subclasses.find((subclass) => subclass.id === character.classSubclassId)
        const subclassLevel = featureData.subclasses[0]?.selectionLevel
        if (subclassLevel && character.level >= subclassLevel && !selectedSubclass) {
          errors.classSubclassId = `Escolha a subclasse de ${selectedName(classes, character.characterClassId)}.`
        }
        const features = [...featureData.features, ...(selectedSubclass?.features ?? [])]
        for (const feature of features) {
          if (feature.level > character.level) continue
          if (normalizeTerm(feature.name) === 'incremento no valor de habilidade') {
            const key = classAbilityScoreIncreaseKey(character.characterClassId, feature.level)
            const selection = character.classFeatureChoices[key] ?? []
            const mode = character.classFeatureChoices[classAbilityScoreIncreaseModeKey(key)]?.[0]
              ?? (selection.length ? 'ability' : '')
            const selectedFeatId = character.classFeatureChoices[classAbilityScoreIncreaseFeatKey(key)]?.[0]
            const confirmedSelection = character.abilityScoreIncreases?.classId === character.characterClassId
              ? character.abilityScoreIncreases.selections[key]
              : undefined
            if (mode === 'feat') {
              const feat = feats.find((item) => item.id === selectedFeatId)
              const featAbility = character.featAbilityIncreases?.[classAbilityScoreIncreaseFeatKey(key)]?.ability
              const featAbilityOptions = feat?.abilityBonus && 'chooseFrom' in feat.abilityBonus ? feat.abilityBonus.chooseFrom : undefined
              const repeated = Object.entries(character.classFeatureChoices)
                .filter(([choiceKey]) => choiceKey.startsWith('ability-score-increase:') && choiceKey.endsWith(':feat') && choiceKey !== classAbilityScoreIncreaseFeatKey(key))
                .some(([, selected]) => selected[0] === selectedFeatId)
              if (!feat || getFeatPrerequisiteFailure(feat, character.abilities, canCastFeats, featArmorProficiencies) || (repeated && !feat.repeatable) || (featAbilityOptions && !featAbilityOptions.includes(featAbility ?? ''))) {
                errors[`classFeatureChoices.${key}`] = 'Escolha um talento cujos pré-requisitos sejam atendidos.'
              }
            } else if (mode !== 'ability' || (selection.length !== 1 && selection.length !== 2) || new Set(selection).size !== selection.length ||
              selection.some((ability) => !abilityLabels.some(([key]) => key === ability)) ||
              JSON.stringify(confirmedSelection) !== JSON.stringify(selection)) {
              errors[`classFeatureChoices.${key}`] = 'Escolha uma habilidade para receber +2 ou duas para receber +1 em cada e confirme o incremento.'
            }
          }
          for (const choice of feature.choices ?? []) {
            const key = `${character.characterClassId}:${character.classSubclassId}:${feature.level}:${feature.name}:${choice.id}`
            if ((character.classFeatureChoices[key]?.length ?? 0) < choice.choose) {
              errors[`classFeatureChoices.${key}`] = `Escolha ${choice.choose === 1 ? 'uma opção' : `${choice.choose} opções`} em ${choice.name}.`
            }
          }
        }
        if (normalizeTerm(selectedName(classes, character.characterClassId)) === 'bruxo' && character.level >= 3) {
          const pactKey = warlockPactChoiceKey(character.characterClassId, character.classSubclassId)
          if (character.classFeatureChoices[pactKey]?.includes('pacto-do-tomo')) {
            const tomeCantripKey = warlockTomeCantripChoiceKey(character.characterClassId, character.classSubclassId)
            if (!isValidPactTomeCantripSelection(character.classFeatureChoices[tomeCantripKey] ?? [], knownPactTomeCantrips)) {
              errors[`classFeatureChoices.${tomeCantripKey}`] = 'Escolha três truques diferentes para o Livro das Sombras.'
            }
          }
        }
        if (normalizeTerm(selectedName(classes, character.characterClassId)) === 'bruxo') {
          for (const [invocationKey, invocationIds] of Object.entries(character.classFeatureChoices)) {
            if (!invocationKey.endsWith(':mystic-invocations') || !invocationIds.includes('livro-de-segredos-antigos')) continue
            const ritualKey = ancientSecretsRitualChoiceKey(invocationKey)
            if (!isValidAncientSecretsRitualSelection(character.classFeatureChoices[ritualKey] ?? [])) {
              errors[`classFeatureChoices.${ritualKey}`] = 'Escolha dois rituais diferentes de 1º nível para o Livro de Segredos Antigos.'
            }
          }
        }
        if (normalizeTerm(selectedName(classes, character.characterClassId)) === 'bardo') {
          const bardBaseSkills = new Set([
            ...character.skillProficiencies,
            ...(character.backgroundSkillChoices ?? []),
            ...raceSkills,
            ...(getBackgroundRulesFor()?.skills ?? []),
          ])
          const loreFeature = selectedSubclass?.features.find((feature) =>
            feature.choices?.some((choice) => choice.id === 'lore-additional-skills'),
          )
          const loreChoice = loreFeature?.choices?.find((choice) => choice.id === 'lore-additional-skills')
          const loreKey = loreFeature && loreChoice
            ? `${character.characterClassId}:${character.classSubclassId}:${loreFeature.level}:${loreFeature.name}:${loreChoice.id}`
            : ''
          const loreSkills = loreKey ? character.classFeatureChoices[loreKey] ?? [] : []
          const proficientSkills = new Set([...bardBaseSkills, ...loreSkills])
          for (const [key, choices] of Object.entries(character.classFeatureChoices)) {
            if (key.startsWith(`${character.characterClassId}:${character.classSubclassId}:`) && key.endsWith(':bard-expertise') &&
              (choices.length !== 2 || new Set(choices).size !== 2 || choices.some((skill) => !proficientSkills.has(skill)))) {
              errors[`classFeatureChoices.${key}`] = 'A Aptidão só pode ser escolhida para duas perícias diferentes em que você tenha proficiência.'
            }
          }
          if (loreChoice && (loreSkills.length !== 3 || new Set(loreSkills).size !== 3 ||
            loreSkills.some((skill) => bardBaseSkills.has(skill)))) {
            errors[`classFeatureChoices.${loreKey}`] = 'Escolha três perícias diferentes nas quais ainda não tenha proficiência.'
          }
        }
        if (normalizeTerm(selectedName(classes, character.characterClassId)) === 'bruxo') {
          const pactKey = `${character.characterClassId}:${character.classSubclassId}:3:Dádiva do Pacto:dadiva-do-pacto`
          const pact = character.classFeatureChoices[pactKey]?.[0]
          for (const feature of featureData.features.filter((item) => item.level <= character.level)) {
            const invocationChoice = feature.choices?.find((choice) => choice.id === 'mystic-invocations')
            if (!invocationChoice) continue
            const key = `${character.characterClassId}:${character.classSubclassId}:${feature.level}:${feature.name}:${invocationChoice.id}`
            const selected = character.classFeatureChoices[key] ?? []
            if (selected.some((id) => {
              const invocation = invocationChoice.options.find((option) => option.id === id)
              return invocation && !warlockInvocationIsAvailable(invocation, pact)
            })) {
              errors[`classFeatureChoices.${key}`] = 'Esta invocação exige uma Dádiva do Pacto diferente da selecionada.'
            }
          }
        }
        if (normalizeTerm(selectedName(classes, character.characterClassId)) === 'feiticeiro') {
          const metamagicSelections: { key: string; optionIds: string[] }[] = []
          for (const feature of featureData.features.filter((item) => item.level <= character.level)) {
            const choice = feature.choices?.find((item) => item.id === 'sorcerer-metamagic')
            if (!choice) continue
            const key = `${character.characterClassId}:${character.classSubclassId}:${feature.level}:${feature.name}:${choice.id}`
            const optionIds = character.classFeatureChoices[key] ?? []
            metamagicSelections.push({ key, optionIds })
            if (optionIds.some((id) => !choice.options.some((option) => option.id === id))) {
              errors[`classFeatureChoices.${key}`] = 'Escolha opções de Metamágica disponíveis.'
            }
          }
          const selectedMetamagics = metamagicSelections.flatMap(({ optionIds }) => optionIds)
          if (new Set(selectedMetamagics).size !== selectedMetamagics.length) {
            const firstMetamagicKey = metamagicSelections[0]?.key
            if (firstMetamagicKey) errors[`classFeatureChoices.${firstMetamagicKey}`] = 'Escolha opções de Metamágica diferentes entre si.'
          }
        }
        if (normalizeTerm(selectedName(classes, character.characterClassId)) === 'clerigo' && selectedSubclass?.id === 'dominio-do-conhecimento') {
          const knowledgeFeature = selectedSubclass.features.find((feature) => feature.name === 'Bênçãos do Conhecimento')
          const choices = knowledgeFeature?.choices ?? []
          const keyFor = (choiceId: string) => {
            const choice = choices.find((item) => item.id === choiceId)
            return knowledgeFeature && choice ? `${character.characterClassId}:${character.classSubclassId}:${knowledgeFeature.level}:${knowledgeFeature.name}:${choice.id}` : ''
          }
          const skills = keyFor('knowledge-skills') ? character.classFeatureChoices[keyFor('knowledge-skills')] ?? [] : []
          const languages = keyFor('knowledge-languages') ? character.classFeatureChoices[keyFor('knowledge-languages')] ?? [] : []
          if (skills.length !== 2 || new Set(skills).size !== 2 || skills.some((skill) => !['Arcanismo', 'História', 'Natureza', 'Religião'].includes(skill))) {
            errors[`classFeatureChoices.${keyFor('knowledge-skills')}`] = 'Escolha duas perícias diferentes entre Arcanismo, História, Natureza e Religião.'
          }
          const knownLanguages = new Set([...getRaceLanguageRulesFor().fixed, ...classLanguages, ...character.raceLanguageChoices, ...character.backgroundLanguageChoices])
          if (languages.length !== 2 || new Set(languages).size !== 2 || languages.some((language) => !languageOptions.includes(language) || knownLanguages.has(language))) {
            errors[`classFeatureChoices.${keyFor('knowledge-languages')}`] = 'Escolha dois idiomas diferentes que seu personagem ainda não conheça.'
          }
        }
      }
    }
    if (step === 3 && normalizeTerm(selectedName(classes, character.characterClassId)) === 'barbaro') {
      for (const feature of barbarianFeatures.filter((item) => item.level <= character.level && normalizeTerm(item.name) === 'incremento no valor de habilidade')) {
        const key = classAbilityScoreIncreaseKey(character.characterClassId, feature.level)
        const selection = character.classFeatureChoices[key] ?? []
        const mode = character.classFeatureChoices[classAbilityScoreIncreaseModeKey(key)]?.[0] ?? (selection.length ? 'ability' : '')
        const featId = character.classFeatureChoices[classAbilityScoreIncreaseFeatKey(key)]?.[0]
        const confirmed = character.abilityScoreIncreases?.classId === character.characterClassId
          ? character.abilityScoreIncreases.selections[key]
          : undefined
        if (mode === 'feat') {
          const feat = feats.find((item) => item.id === featId)
          const featAbility = character.featAbilityIncreases?.[classAbilityScoreIncreaseFeatKey(key)]?.ability
          const featAbilityOptions = feat?.abilityBonus && 'chooseFrom' in feat.abilityBonus ? feat.abilityBonus.chooseFrom : undefined
          const repeated = Object.entries(character.classFeatureChoices)
            .filter(([choiceKey]) => choiceKey.startsWith('ability-score-increase:') && choiceKey.endsWith(':feat') && choiceKey !== classAbilityScoreIncreaseFeatKey(key))
            .some(([, selected]) => selected[0] === featId)
          if (!feat || getFeatPrerequisiteFailure(feat, character.abilities, canCastFeats, featArmorProficiencies) || (repeated && !feat.repeatable) || (featAbilityOptions && !featAbilityOptions.includes(featAbility ?? ''))) {
            errors[`classFeatureChoices.${key}`] = 'Escolha um talento cujos pré-requisitos sejam atendidos.'
          }
        } else if (mode !== 'ability' || (selection.length !== 1 && selection.length !== 2) || JSON.stringify(confirmed) !== JSON.stringify(selection)) {
          errors[`classFeatureChoices.${key}`] = 'Escolha uma habilidade para receber +2 ou duas para receber +1 em cada e confirme o incremento.'
        }
      }
    }
    if (step === 4) {
      if (!equipmentCatalog) errors.equipment = equipmentError
         ? 'Não foi possível carregar os equipamentos do Supabase. Tente novamente antes de continuar.'
         : 'Aguarde o carregamento dos equipamentos antes de continuar.'
      else {
         const inventory = readInventory(character.equipment, equipmentCatalog)
         const plan = startingEquipmentPlan(equipmentCatalog, getEquipmentContext(), inventory)
         if (plan.missing.length) errors.equipment = `Complete as escolhas do equipamento inicial: ${plan.missing.join('; ')}.`
         else if (!inventory.initialEquipmentConfirmed) errors.equipment = 'Confirme o equipamento inicial antes de continuar.'
         else if (plan.grants.some(grant => inventory.applied[grant.key] !== equipmentGrantFingerprint(grant)) || Object.keys(inventory.applied).some(key => !plan.grants.some(grant => grant.key === key))) errors.equipment = 'Abra Equipamentos e aguarde a montagem do inventário antes de continuar.'
       }
    }
    if (step === 5 && cantripCount > 0 && selectedCantrips.length !== cantripCount) {
      errors.cantrips = `Escolha ${cantripCount} truques para sua classe neste nível.`
    }
    if (step === 5 && spellcastingProgression.selectionLimit !== null && selectedLeveledSpellCount !== spellcastingProgression.selectionLimit) {
      errors.spells = `Selecione ${spellcastingProgression.selectionLimit} magias entre os níveis disponíveis.`
    }
    return errors
  }

  function stepIsComplete(step: number) {
    if (step === 6) return activeStep === 6 && [0, 1, 2, 3, 4].every((requiredStep) => Object.keys(getErrors(requiredStep)).length === 0)
    if (step === 5) return Boolean(character.characterClassId && className)
      && (cantripCount === 0 || selectedCantrips.length === cantripCount)
      && (spellcastingProgression.selectionLimit === null || selectedLeveledSpellCount === spellcastingProgression.selectionLimit)
    if (step === 4) return backgroundSectionIsComplete() && Object.keys(getErrors(step)).length === 0
    if (step === 3) return [0, 1, 2].every((requiredStep) => Object.keys(getErrors(requiredStep)).length === 0) && Object.keys(getErrors(step)).length === 0
    return Object.keys(getErrors(step)).length === 0
  }

  const errors = validationAttempted ? getErrors() : {}
  const requiredMark = <span className="wizard__required" aria-label="obrigatório">*</span>
  function fieldProps(key: string) {
    return { 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `error-${key}` : undefined }
  }
  function feedback(key: string) {
    return errors[key] ? <small className="wizard__field-error" id={`error-${key}`} role="alert">{errors[key]}</small> : null
  }

  function renderOtherClassFeaturesStep(selectedClass: ReferenceItem, featureData: ClassFeatureData) {
    type DisplayFeature = { feature: ClassFeature; id: string; isSubclassFeature: boolean }
    const isBard = normalizeTerm(selectedClass.name) === 'bardo'
    const isFighter = normalizeTerm(selectedClass.name) === 'guerreiro'
    const isWarlock = normalizeTerm(selectedClass.name) === 'bruxo'
    const isCleric = normalizeTerm(selectedClass.name) === 'clerigo'
    const isDruid = normalizeTerm(selectedClass.name) === 'druida'
    const isRogue = normalizeTerm(selectedClass.name) === 'ladino'
    const isWizard = normalizeTerm(selectedClass.name) === 'mago'
    const isPaladin = normalizeTerm(selectedClass.name) === 'paladino'
    const isRanger = normalizeTerm(selectedClass.name) === 'patrulheiro'
    const isSorcerer = normalizeTerm(selectedClass.name) === 'feiticeiro'
    const selectedSubclass = featureData.subclasses.find((subclass) => subclass.id === character.classSubclassId)
    const isArcaneKnight = isFighter && selectedSubclass?.id === 'cavaleiro-arcano'
    const isArcaneTrickster = isRogue && selectedSubclass?.id === 'trapaceiro-arcano'
    const getLevelFeatures = (level: number): DisplayFeature[] => {
      const features: DisplayFeature[] = [
        ...featureData.features.filter((feature) => feature.level === level).map((feature, index) => ({
          feature,
          id: `class-feature-base-${level}-${index}`,
          isSubclassFeature: false,
        })),
        ...(selectedSubclass?.features.filter((feature) => feature.level === level).map((feature, index) => ({
          feature,
          id: `class-feature-subclass-${level}-${index}`,
          isSubclassFeature: true,
        })) ?? []),
      ]
      if (level === 3 && isBard && selectedSubclass?.id === 'colegio-do-conhecimento') {
        const aptitudeIndex = features.findIndex(({ feature }) => normalizeTerm(feature.name) === 'aptidao')
        const additionalProficiencyIndex = features.findIndex(({ feature, isSubclassFeature }) =>
          isSubclassFeature && normalizeTerm(feature.name) === 'proficiencia adicional',
        )
        if (aptitudeIndex >= 0 && additionalProficiencyIndex >= 0) {
          const [aptitude] = features.splice(aptitudeIndex, 1)
          const updatedAdditionalIndex = features.findIndex(({ feature, isSubclassFeature }) =>
            isSubclassFeature && normalizeTerm(feature.name) === 'proficiencia adicional',
          )
          features.splice(updatedAdditionalIndex + 1, 0, aptitude)
        }
      }
      return features
    }
    const choiceKey = (feature: ClassFeature, choiceId: string) =>
      `${character.characterClassId}:${character.classSubclassId}:${feature.level}:${feature.name}:${choiceId}`
    const loreProficiencyFeature = selectedSubclass?.features.find((feature) =>
      feature.choices?.some((choice) => choice.id === 'lore-additional-skills'),
    )
    const loreProficiencyChoice = loreProficiencyFeature?.choices?.find((choice) => choice.id === 'lore-additional-skills')
    const loreProficiencyKey = loreProficiencyFeature && loreProficiencyChoice
      ? choiceKey(loreProficiencyFeature, loreProficiencyChoice.id)
      : ''
    const pactFeature = featureData.features.find((feature) => feature.name === 'Dádiva do Pacto')
    const pactChoice = pactFeature?.choices?.find((choice) => choice.id === 'dadiva-do-pacto')
    const selectedWarlockPact = pactFeature && pactChoice
      ? character.classFeatureChoices[choiceKey(pactFeature, pactChoice.id)]?.[0]
      : undefined
    const tomeCantripKey = warlockTomeCantripChoiceKey(character.characterClassId, character.classSubclassId)
    const bardBaseSkillProficiencies = new Set([
      ...character.skillProficiencies,
      ...(character.backgroundSkillChoices ?? []),
      ...raceSkills,
      ...(getBackgroundRulesFor()?.skills ?? []),
    ])
    const loreSkillProficiencies = new Set(
      selectedSubclass?.id === 'colegio-do-conhecimento'
        ? character.classFeatureChoices[loreProficiencyKey] ?? []
        : [],
    )
    const rogueSkillProficiencies = new Set([
      ...character.skillProficiencies,
      ...(character.backgroundSkillChoices ?? []),
      ...raceSkills,
      ...(getBackgroundRulesFor()?.skills ?? []),
    ])
    const rogueToolProficiencies = new Set([
      ...(classProficiencies[normalizeTerm(selectedClass.name)]?.tools ?? []),
      ...(getBackgroundRulesFor()?.tools ?? []),
      ...(character.toolProficiencyChoices ?? []),
    ])

    return (
      <section aria-label={`Características de classe: ${selectedClass.name}`} className="wizard__class-features">
        <section className="wizard__section-card wizard__barbarian-progression" aria-label={`Progressão de ${selectedClass.name}`}>
          {renderStepHeading()}
          <div className="wizard__barbarian-table-wrap" role="region" tabIndex={0}>
            <table className={`wizard__barbarian-table${isBard ? ' wizard__barbarian-table--bard' : isWarlock ? ' wizard__barbarian-table--warlock' : isSorcerer ? ' wizard__barbarian-table--sorcerer' : isCleric || isDruid ? ' wizard__barbarian-table--cleric' : isArcaneKnight ? ' wizard__barbarian-table--eldritch-knight' : ''}${isRogue ? ' wizard__barbarian-table--rogue' : ''}${isArcaneTrickster ? ' wizard__barbarian-table--arcane-trickster' : ''}${isWizard ? ' wizard__barbarian-table--wizard' : ''}`}>
              <thead>
                <tr>
                  <th scope="col">Nível</th>
                  <th scope="col">Bônus de proficiência</th>
                  <th scope="col">Características</th>
                  {isRogue && <th scope="col">Ataque Furtivo</th>}
                  {normalizeTerm(selectedClass.name) === 'monge' && <>
                    <th scope="col">Artes marciais</th>
                    <th scope="col">Pontos de chi</th>
                    <th scope="col">Deslocamento sem armadura</th>
                  </>}
                  {isPaladin && Array.from({ length: 5 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  {isRanger && <>
                    <th scope="col">Magias conhecidas</th>
                    {Array.from({ length: 5 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  </>}
                  {isBard && <>
                    <th scope="col">Truques</th>
                    <th scope="col">Magias conhecidas</th>
                    {Array.from({ length: 9 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  </>}
                  {isWarlock && <>
                    <th scope="col">Truques</th>
                    <th scope="col">Magias conhecidas</th>
                    <th scope="col">Espaços de pacto</th>
                    <th scope="col">Nível do espaço</th>
                    <th scope="col">Invocações</th>
                  </>}
                  {(isCleric || isDruid) && <>
                    <th scope="col">Truques</th>
                    <th scope="col">Magias preparadas</th>
                    {Array.from({ length: 9 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  </>}
                  {isSorcerer && <>
                    <th scope="col">Truques</th>
                    <th scope="col">Magias conhecidas</th>
                    <th scope="col">Pontos de feitiçaria</th>
                    {Array.from({ length: 9 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  </>}
                  {isArcaneKnight && <>
                    <th scope="col">Truques</th>
                    <th scope="col">Magias conhecidas</th>
                    {Array.from({ length: 4 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  </>}
                  {isArcaneTrickster && <>
                    <th scope="col">Truques</th>
                    <th scope="col">Magias conhecidas</th>
                    {Array.from({ length: 4 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  </>}
                  {isWizard && <>
                    <th scope="col">Truques</th>
                    <th scope="col">Magias preparadas</th>
                    {Array.from({ length: 9 }, (_, index) => <th scope="col" key={index}>Espaços {index + 1}º</th>)}
                  </>}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
                  const features = getLevelFeatures(level).filter(({ feature }) =>
                    !isWarlock || feature.name !== 'Invocações Místicas' || level === 2,
                  )
                  const spellProgress = isBard ? bardSpellProgression[level - 1] : undefined
                  const warlockProgress = isWarlock ? warlockSpellProgression[level - 1] : undefined
                  const clericProgress = isCleric ? clericSpellProgression[level - 1] : undefined
                  const druidProgress = isDruid ? druidSpellProgression[level - 1] : undefined
                  const sorcererProgress = isSorcerer ? sorcererSpellProgression[level - 1] : undefined
                  const arcaneKnightProgress = isArcaneKnight && level >= 3 ? eldritchKnightSpellProgression[level - 3] : undefined
                  const arcaneTricksterProgress = isArcaneTrickster && level >= 3 ? arcaneTricksterSpellProgression[level - 3] : undefined
                  const wizardProgress = isWizard ? wizardSpellProgression[level - 1] : undefined
                  const paladinProgress = isPaladin ? paladinSpellProgression[level - 1] : undefined
                  const rangerProgress = isRanger ? rangerSpellProgression[level - 1] : undefined
                  const preparedSpellProgress = clericProgress ?? druidProgress
                  const wisdomModifier = isCleric || isDruid ? getAbilityModifier('wisdom') : null
                  const intelligenceModifier = isWizard ? getAbilityModifier('intelligence') : null
                  return (
                    <tr aria-current={level === character.level ? 'true' : undefined} className={level === character.level ? 'wizard__barbarian-table-current' : undefined} key={level}>
                      <th scope="row">{level}º</th>
                      <td>+{2 + Math.floor((level - 1) / 4)}</td>
                      <td>
                        {features.length === 0 ? '—' : features.map(({ feature, id, isSubclassFeature }, index) => (
                          <span key={id}>
                            {index > 0 && ', '}
                            <button
                              aria-controls={id}
                              className="wizard__barbarian-table-feature-link"
                              onClick={() => {
                                const target = document.getElementById(id)
                                if (target) scrollToClassFeature(target)
                              }}
                              type="button"
                            >
                              {feature.name}{isSubclassFeature && selectedSubclass ? ` · ${selectedSubclass.name}` : ''}
                            </button>
                          </span>
                        ))}
                      </td>
                      {isRogue && <td>{rogueSneakAttackProgression[level - 1]}d6</td>}
                      {normalizeTerm(selectedClass.name) === 'monge' && <>
                        <td>{monkProgression[level - 1][0]}</td>
                        <td>{monkProgression[level - 1][1] ?? '—'}</td>
                        <td>{monkProgression[level - 1][2] ?? '—'}</td>
                      </>}
                      {paladinProgress && Array.from({ length: 5 }, (_, index) => <td key={index}>{paladinProgress[index] ?? '—'}</td>)}
                      {rangerProgress && <>
                        <td>{rangerProgress[0] || '—'}</td>
                        {Array.from({ length: 5 }, (_, index) => <td key={index}>{rangerProgress[1][index] ?? '—'}</td>)}
                      </>}
                      {spellProgress && <>
                        <td>{spellProgress[0]}</td>
                        <td>{spellProgress[1]}</td>
                        {Array.from({ length: 9 }, (_, index) => <td key={index}>{spellProgress[2][index] ?? '—'}</td>)}
                      </>}
                      {warlockProgress && <>
                        <td>{warlockProgress[0]}</td>
                        <td>{warlockProgress[1]}</td>
                        <td>{warlockProgress[2]}</td>
                        <td>{warlockProgress[3]}º</td>
                        <td>{warlockProgress[4] || '—'}</td>
                      </>}
                      {preparedSpellProgress && <>
                        <td>{preparedSpellProgress[0]}</td>
                        <td>{wisdomModifier === null ? '—' : Math.max(1, level + wisdomModifier)}</td>
                        {Array.from({ length: 9 }, (_, index) => <td key={index}>{preparedSpellProgress[1][index] ?? '—'}</td>)}
                      </>}
                      {sorcererProgress && <>
                        <td>{sorcererProgress[0]}</td>
                        <td>{sorcererProgress[1]}</td>
                        <td>{level === 1 ? '—' : level}</td>
                        {Array.from({ length: 9 }, (_, index) => <td key={index}>{sorcererProgress[2][index] ?? '—'}</td>)}
                      </>}
                      {isArcaneKnight && <>
                        <td>{arcaneKnightProgress?.[0] ?? '—'}</td>
                        <td>{arcaneKnightProgress?.[1] ?? '—'}</td>
                        {Array.from({ length: 4 }, (_, index) => <td key={index}>{arcaneKnightProgress?.[2][index] ?? '—'}</td>)}
                      </>}
                      {isArcaneTrickster && <>
                        <td>{arcaneTricksterProgress?.[0] ?? '—'}</td>
                        <td>{arcaneTricksterProgress?.[1] ?? '—'}</td>
                        {Array.from({ length: 4 }, (_, index) => <td key={index}>{arcaneTricksterProgress?.[2][index] ?? '—'}</td>)}
                      </>}
                      {wizardProgress && <>
                        <td>{wizardProgress[0]}</td>
                        <td>{intelligenceModifier === null ? '—' : Math.max(1, level + intelligenceModifier)}</td>
                        {Array.from({ length: 9 }, (_, index) => <td key={index}>{wizardProgress[1][index] ?? '—'}</td>)}
                      </>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        <div className="wizard__class-feature-list">
          {Array.from({ length: showHigherClassLevels ? 20 : character.level }, (_, index) => index + 1).map((level) => {
            const isUnlocked = level <= character.level
            const levelFeatures = getLevelFeatures(level)
            const subclassSelectionDue = featureData.subclasses[0]?.selectionLevel === level

            return (
              <section aria-disabled={!isUnlocked} className="wizard__section-card wizard__class-level-row" key={level}>
                <header className="wizard__class-level-heading">
                  <h3>Nível {level}</h3>
                </header>
                <div className="wizard__class-level-features">
                  {subclassSelectionDue && (
                    <fieldset {...fieldProps('classSubclassId')} aria-label={`Subclasse de ${selectedClass.name}`} aria-required={isUnlocked} className="wizard__class-path" disabled={!isUnlocked}>
                      <legend>Escolha sua subclasse {isUnlocked && requiredMark}</legend>
                      {feedback('classSubclassId')}
                      <div className="wizard__class-path-options">
                        {featureData.subclasses.map((subclass: ClassSubclass) => (
                          <button
                            aria-pressed={character.classSubclassId === subclass.id}
                            className="wizard__class-path-option"
                            key={subclass.id}
                            onClick={() => requestStartingEquipmentReset((current) => ({
                              ...current,
                              classSubclassId: subclass.id,
                              classFeatureChoices: rebaseClassFeatureChoicesForSubclass(
                                current.classFeatureChoices,
                                current.characterClassId,
                                current.classSubclassId,
                                subclass.id,
                                featureData.features,
                              ),
                            }))}
                            type="button"
                          >
                            <span aria-hidden="true" className="wizard__method-radio" />
                            <strong>{subclass.name}</strong>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  {levelFeatures.map(({ feature, id, isSubclassFeature }) => (
                    <article className={`wizard__class-feature${isSubclassFeature ? ' wizard__class-feature--path' : ''}`} id={id} key={id} tabIndex={-1}>
                      <div className="wizard__class-feature-heading">
                        <h4>
                          {feature.name}
                          {isSubclassFeature && selectedSubclass && <span className="wizard__class-feature-path-reference"> · {selectedSubclass.name}</span>}
                        </h4>
                      </div>
                      <p>{feature.description}</p>
                      {normalizeTerm(feature.name) === 'incremento no valor de habilidade' && (() => {
                        const key = classAbilityScoreIncreaseKey(character.characterClassId, feature.level)
                        const modeKey = classAbilityScoreIncreaseModeKey(key)
                        const featKey = classAbilityScoreIncreaseFeatKey(key)
                        const mode = character.classFeatureChoices[modeKey]?.[0] ?? (character.classFeatureChoices[key]?.length ? 'ability' : '')
                        const selected = character.classFeatureChoices[key] ?? []
                        const selectedFeatId = character.classFeatureChoices[featKey]?.[0] ?? ''
                        const selectedFeat = feats.find((item) => item.id === selectedFeatId)
                        const selectedFeatAbility = selectedFeat?.abilityBonus && 'ability' in selectedFeat.abilityBonus ? selectedFeat.abilityBonus.ability : ''
                        const confirmed = character.abilityScoreIncreases?.classId === character.characterClassId
                          && JSON.stringify(character.abilityScoreIncreases.selections[key]) === JSON.stringify(selected)
                        const amount = selected.length === 1 ? 2 : 1
                        const canConfirm = abilityScoresAreValid() && (selected.length === 2
                          ? selected.every((ability) => Boolean(character.abilities[ability]) && Number(character.abilities[ability]) < 20)
                          : selected.length === 1 && Boolean(character.abilities[selected[0]]) && Number(character.abilities[selected[0]]) <= 18)
                        return <div className="wizard__asi-choice">
                          <div className="wizard__asi-mode">
                            <strong>Escolha como usar este incremento</strong>
                            <div aria-label="Escolha como usar este incremento" className="wizard__asi-mode-options" role="radiogroup">
                              <button aria-pressed={mode === 'ability'} className="wizard__method-option wizard__asi-mode-option" disabled={!isUnlocked} onClick={() => selectClassAbilityIncreaseMode(key, 'ability')} type="button">
                                <span aria-hidden="true" className="wizard__method-radio" /><strong>Incremento no valor de habilidade</strong>
                              </button>
                              <button aria-pressed={mode === 'feat'} className="wizard__method-option wizard__asi-mode-option" disabled={!isUnlocked} onClick={() => {
                              selectClassAbilityIncreaseMode(key, 'feat')
                              openFeatSelection(feature.level, selectedFeatId)
                              }} type="button"><span aria-hidden="true" className="wizard__method-radio" /><strong>Escolher um talento</strong></button>
                            </div>
                          </div>
                          {mode === 'ability' && <>
                            <div {...fieldProps(`classFeatureChoices.${key}`)} aria-label="Habilidades para incremento" className="wizard__skill-options" role="group">
                              {abilityLabels.map(([ability, label]) => {
                                const isSelected = selected.includes(ability)
                                const value = Number(character.abilities[ability])
                                const disabled = !isSelected && (selected.length >= 2 || !character.abilities[ability] || !Number.isInteger(value) || value < 1 || value >= 20)
                                return <button
                                  aria-pressed={isSelected}
                                  className="wizard__skill-option wizard__skill-option--detailed"
                                  disabled={!isUnlocked || disabled}
                                  key={ability}
                                  onClick={() => toggleClassAbilityIncrease(key, ability)}
                                  type="button"
                                >
                                  <span aria-hidden="true" className="wizard__selection-dot wizard__selection-dot--checkbox" />
                                  <span className="wizard__skill-ability">{label}</span>
                                  <span>{isSelected && !confirmed ? `${value} → ${value + amount}` : character.abilities[ability] || '—'}</span>
                                </button>
                              })}
                            </div>
                            <Button
                              disabled={!isUnlocked || !canConfirm || confirmed}
                              onClick={() => confirmClassAbilityIncrease(key)}
                              type="button"
                            >{confirmed ? 'Incremento confirmado' : 'Confirmar incremento'}</Button>
                          </>}
                          {mode === 'feat' && <div className="wizard__asi-feat-selected">
                            {selectedFeat ? <><strong>{selectedFeat.name}</strong><span>{selectedFeat.description}</span></> : <span>Selecione um talento no painel para continuar.</span>}
                            {selectedFeat?.abilityBonus && ('chooseFrom' in selectedFeat.abilityBonus
                              ? <div className="wizard__feat-ability-choice" aria-label={`Escolha uma habilidade para ${selectedFeat.name}`}>
                                <span>Escolha uma habilidade para receber +1:</span>
                                <div className="wizard__skill-options" role="group">
                                  {selectedFeat.abilityBonus.chooseFrom.map((ability) => {
                                    const label = abilityLabels.find(([id]) => id === ability)?.[1] ?? ability
                                    const increase = character.featAbilityIncreases?.[featKey]
                                    const active = increase?.ability === ability
                                    return <button aria-pressed={active} className="wizard__skill-option" key={ability} onClick={() => selectFeatAbilityIncrease(key, ability)} type="button">
                                      <span aria-hidden="true" className="wizard__method-radio" />{label}{active ? ` · ${character.abilities[ability]}${increase.amount ? ' (+1 aplicado)' : ' (máximo 20)'}` : ''}
                                    </button>
                                  })}
                                </div>
                              </div>
                              : <span>{abilityLabels.find(([id]) => id === selectedFeatAbility)?.[1]}: {character.abilities[selectedFeatAbility] || '—'}{character.featAbilityIncreases?.[featKey]?.amount ? ' (+1 aplicado)' : ' (máximo 20)'}</span>)}
                            <Button disabled={!isUnlocked} onClick={() => openFeatSelection(feature.level, selectedFeatId)} type="button" variant="secondary">{selectedFeat ? 'Alterar talento' : 'Selecionar talento'}</Button>
                          </div>}
                          {feedback(`classFeatureChoices.${key}`)}
                        </div>
                      })()}
                      {feature.choices?.map((choice) => {
                        const key = choiceKey(feature, choice.id)
                        const selected = character.classFeatureChoices[key] ?? []
                        const isBardExpertise = normalizeTerm(selectedClass.name) === 'bardo' && choice.id === 'bard-expertise'
                        const isRogueExpertise = isRogue && choice.id === 'rogue-expertise'
                        const isLoreSkillChoice = selectedSubclass?.id === 'colegio-do-conhecimento'
                          && choice.id === 'lore-additional-skills'
                        const isKnowledgeLanguageChoice = selectedSubclass?.id === 'dominio-do-conhecimento'
                          && choice.id === 'knowledge-languages'
                        const selectedElsewhere = Object.entries(character.classFeatureChoices)
                          .filter(([selectedKey]) => selectedKey !== key &&
                            selectedKey.startsWith(`${character.characterClassId}:${character.classSubclassId}:`) &&
                            selectedKey.endsWith(`:${choice.id}`))
                          .flatMap(([, optionIds]) => optionIds)
                        const availableOptions = choice.options.filter((option) => {
                          if ((option.level ?? 1) > character.level) return false
                          if (selectedElsewhere.includes(option.id) && !selected.includes(option.id)) return false
                          if (isKnowledgeLanguageChoice && !selected.includes(option.id) &&
                            ([...getRaceLanguageRulesFor().fixed, ...classLanguages, ...character.raceLanguageChoices, ...character.backgroundLanguageChoices].includes(option.name))) return false
                          if (isBardExpertise && !selected.includes(option.id)
                            && !bardBaseSkillProficiencies.has(option.name) && !loreSkillProficiencies.has(option.name)) return false
                          if (isRogueExpertise && !selected.includes(option.id) &&
                            (option.id === 'thieves-tools' ? !rogueToolProficiencies.has(option.name) : !rogueSkillProficiencies.has(option.name))) return false
                          if (isLoreSkillChoice && !selected.includes(option.id)
                            && bardBaseSkillProficiencies.has(option.name)) return false
                          return true
                        })
                        const isDraconicAncestor = normalizeTerm(selectedClass.name) === 'feiticeiro'
                          && normalizeTerm(feature.name) === 'ancestral draconico'
                          && choice.id === 'ancestral'
                        const isFightingStyle = (normalizeTerm(selectedClass.name) === 'guerreiro' || isPaladin || isRanger)
                          && normalizeTerm(feature.name).startsWith('estilo de luta')
                          && choice.id === 'estilo-de-luta'
                        const isWarlockInvocation = isWarlock && choice.id === 'mystic-invocations'
                        const isWarlockPactChoice = isWarlock && choice.id === 'dadiva-do-pacto'
                        const ancientSecretsKey = ancientSecretsRitualChoiceKey(key)
                        const ancientSecretsRituals = character.classFeatureChoices[ancientSecretsKey] ?? []
                        const selectedOption = availableOptions.find((option) => selected.includes(option.id))
                        return (
                          <fieldset {...fieldProps(`classFeatureChoices.${key}`)} aria-label={choice.name} aria-required={isUnlocked} className="wizard__class-path" disabled={!isUnlocked} key={choice.id}>
                            <legend>{choice.name} — escolha {choice.choose === 1 ? 'uma opção' : `${choice.choose} opções`} {isUnlocked && requiredMark}</legend>
                            {feedback(`classFeatureChoices.${key}`)}
                            {isBardExpertise || isLoreSkillChoice ? (
                              <div {...fieldProps(`classFeatureChoices.${key}`)} tabIndex={-1} aria-label={choice.name} className="wizard__skill-options" role="group">
                                {availableOptions.map((option) => {
                                  const isSelected = selected.includes(option.id)
                                  return <button
                                    aria-pressed={isSelected}
                                    className="wizard__skill-option wizard__skill-option--detailed"
                                    disabled={!isSelected && selected.length >= choice.choose}
                                    key={option.id}
                                    onClick={() => updateClassFeatureChoices((current) => {
                                      const previous = current.classFeatureChoices[key] ?? []
                                      const next = previous.includes(option.id)
                                        ? previous.filter((id) => id !== option.id)
                                        : previous.length < choice.choose ? [...previous, option.id] : previous
                                      return { ...current, classFeatureChoices: { ...current.classFeatureChoices, [key]: next } }
                                    })}
                                    type="button"
                                  >
                                    <span aria-hidden="true" className={`wizard__selection-dot${choice.choose > 1 ? ' wizard__selection-dot--checkbox' : ''}`} />
                                    <span className="wizard__skill-ability">({abilityShortLabels[skillAbilities[option.name]]})</span>
                                    {option.name}
                                  </button>
                                })}
                              </div>
                            ) : isDraconicAncestor || isFightingStyle ? (
                              <label className="wizard__field">
                                <span>{isDraconicAncestor ? 'Ancestral dracônico' : 'Estilo de Luta'}</span>
                                <select
                                  aria-label={isDraconicAncestor ? 'Ancestral dracônico' : 'Estilo de Luta'}
                                  value={selected[0] ?? ''}
                                  onChange={(event) => updateClassFeatureChoices((current) => ({
                                    ...current,
                                    classFeatureChoices: { ...current.classFeatureChoices, [key]: event.target.value ? [event.target.value] : [] },
                                  }))}
                                >
                                  <option value="">{isDraconicAncestor ? 'Selecione um ancestral' : 'Selecione um estilo de luta'}</option>
                                  {availableOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                                </select>
                                {selectedOption?.description && <small>{selectedOption.description}</small>}
                              </label>
                            ) : <div className="wizard__class-path-options">
                              {availableOptions.map((option) => (
                                <button
                                  aria-pressed={selected.includes(option.id)}
                                  className={`wizard__class-path-option${choice.choose > 1 ? ' wizard__class-path-option--multi' : ''}`}
                                  disabled={isWarlockInvocation && !warlockInvocationIsAvailable(option, selectedWarlockPact) && !selected.includes(option.id)}
                                  key={option.id}
                                  onClick={() => {
                                    updateClassFeatureChoices((current) => {
                                    const previous = current.classFeatureChoices[key] ?? []
                                    const next = choice.choose === 1
                                      ? isWarlockInvocation && previous.includes(option.id) ? [] : [option.id]
                                      : previous.includes(option.id)
                                        ? previous.filter((id) => id !== option.id)
                                        : previous.length < choice.choose ? [...previous, option.id] : previous
                                    return { ...current, classFeatureChoices: { ...current.classFeatureChoices, [key]: next } }
                                    })
                                    if (isWarlockPactChoice && option.id === 'pacto-do-tomo') setTomeCantripDrawerOpen(true)
                                    if (isWarlockInvocation && option.id === 'livro-de-segredos-antigos' && !selected.includes(option.id)) setAncientSecretsDrawerKey(ancientSecretsKey)
                                  }}
                                  type="button"
                                >
                                  <span aria-hidden="true" className={`wizard__method-radio${choice.choose > 1 ? ' wizard__method-radio--checkbox' : ''}`} />
                                  <strong>{option.name}</strong>
                                  <span>{option.description}</span>
                                </button>
                              ))}
                            </div>}
                            {isWarlockPactChoice && selected.includes('pacto-do-tomo') && <div {...fieldProps(`classFeatureChoices.${tomeCantripKey}`)} className="wizard__class-feature-detail" tabIndex={-1}>
                              <p>{character.classFeatureChoices[tomeCantripKey]?.length ?? 0} de 3 truques escolhidos para o Livro das Sombras.</p>
                              <Button onClick={() => setTomeCantripDrawerOpen(true)} type="button" variant="secondary">{character.classFeatureChoices[tomeCantripKey]?.length === 3 ? 'Alterar truques' : 'Escolher truques'}</Button>
                              {feedback(`classFeatureChoices.${tomeCantripKey}`)}
                            </div>}
                            {isWarlockInvocation && selected.includes('livro-de-segredos-antigos') && <div {...fieldProps(`classFeatureChoices.${ancientSecretsKey}`)} className="wizard__class-feature-detail" tabIndex={-1}>
                              <p>{ancientSecretsRituals.length} de 2 rituais de 1º nível escolhidos para o Livro das Sombras.</p>
                              <Button onClick={() => setAncientSecretsDrawerKey(ancientSecretsKey)} type="button" variant="secondary">{ancientSecretsRituals.length === 2 ? 'Alterar rituais' : 'Escolher rituais'}</Button>
                              {feedback(`classFeatureChoices.${ancientSecretsKey}`)}
                            </div>}
                          </fieldset>
                        )
                      })}
                    </article>
                  ))}
                  {levelFeatures.length === 0 && !subclassSelectionDue && <p className="wizard__class-feature-empty">Nenhuma característica nova neste nível.</p>}
                </div>
              </section>
            )
          })}
          {!showHigherClassLevels && character.level < 20 && <Button className="wizard__higher-levels-trigger" variant="secondary" type="button" onClick={() => setShowHigherClassLevels(true)}>Ver habilidades acima do nível {character.level}</Button>}
        </div>
        <Modal open={featPanelOpen} title="Selecionar talento" theme={theme} variant="drawer" showHeader={false} onClose={() => setFeatPanelOpen(false)}>
          <div className="wizard__cantrip-drawer-content">
            <header>
              <div><h2 id="feat-drawer-title">Selecionar talento</h2><p>Nível {featPanelLevel} · Escolha um talento que atenda aos pré-requisitos.</p></div>
              <button aria-label="Fechar painel" className="wizard__cantrip-drawer-close" onClick={() => setFeatPanelOpen(false)} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button>
            </header>
            <div aria-label="Talentos disponíveis" className="wizard__cantrip-drawer-options" role="radiogroup">
              {feats.map((feat) => {
                const prerequisiteFailure = getFeatPrerequisiteFailure(feat, character.abilities, canCastFeats, featArmorProficiencies)
                const alreadySelected = Object.entries(character.classFeatureChoices)
                  .filter(([choiceKey]) => choiceKey.startsWith('ability-score-increase:') && choiceKey.endsWith(':feat') && choiceKey !== classAbilityScoreIncreaseFeatKey(classAbilityScoreIncreaseKey(character.characterClassId, featPanelLevel)))
                  .some(([, selected]) => selected[0] === feat.id)
                const failure = prerequisiteFailure || (alreadySelected && !feat.repeatable ? 'Este talento só pode ser escolhido uma vez.' : '')
                return <label className="wizard__cantrip-drawer-option wizard__feat-option" key={feat.id} title={failure || undefined}>
                  <input checked={featDraft === feat.id} disabled={Boolean(failure)} name="feat-selection" onChange={() => setFeatDraft(feat.id)} type="radio" />
                  <span className="wizard__spell-option-details">
                    <span className="wizard__feat-heading"><strong>{feat.name}{feat.repeatable ? ' · Repetível' : ''}</strong><span className="wizard__feat-prerequisite">Pré-requisito: {feat.prerequisite}.</span></span>
                    <span className="wizard__feat-description">{feat.description}</span>
                  </span>
                </label>
              })}
            </div>
            <footer>
              <Button onClick={() => setFeatPanelOpen(false)} type="button" variant="secondary">Cancelar</Button>
              <Button disabled={!featDraft || Boolean(feats.find((item) => item.id === featDraft && getFeatPrerequisiteFailure(item, character.abilities, canCastFeats, featArmorProficiencies)))} onClick={confirmFeatSelection} type="button">Confirmar talento</Button>
            </footer>
          </div>
        </Modal>
        {tomeCantripDrawerOpen && selectedWarlockPact === 'pacto-do-tomo' && <PactTomeCantripDrawer
          open
          selectedCantrips={character.classFeatureChoices[tomeCantripKey] ?? []}
          knownCantrips={knownPactTomeCantrips}
          theme={theme}
          onClose={() => setTomeCantripDrawerOpen(false)}
          onConfirm={(cantrips) => {
            if (!isValidPactTomeCantripSelection(cantrips, knownPactTomeCantrips)) return
            updateClassFeatureChoices((current) => ({
              ...current,
              classFeatureChoices: { ...current.classFeatureChoices, [tomeCantripKey]: cantrips },
            }))
            setTomeCantripDrawerOpen(false)
          }}
        />}
        {ancientSecretsDrawerKey && <SpellSelectionDrawer
          open
          title="Escolher rituais para o Livro das Sombras"
          description="Escolha duas magias rituais de 1º nível de quaisquer listas de classe."
          options={getRitualSpellOptions(1)}
          selectedSpells={character.classFeatureChoices[ancientSecretsDrawerKey] ?? []}
          selectionCount={2}
          theme={theme}
          onClose={() => setAncientSecretsDrawerKey(null)}
          onConfirm={(rituals) => {
            if (!isValidAncientSecretsRitualSelection(rituals)) return
            updateClassFeatureChoices((current) => ({
              ...current,
              classFeatureChoices: { ...current.classFeatureChoices, [ancientSecretsDrawerKey]: rituals },
            }))
            setAncientSecretsDrawerKey(null)
          }}
        />}
      </section>
    )
  }

  async function navigateTo(target: number) {
    if (target === activeStep) return
    const isHiddenSpellStepTarget = !hasSpellcastingChoices && target >= 5 && activeStep === 4
    const destination = isHiddenSpellStepTarget ? steps.length : target
    if (destination > activeStep && activeStep === 2 && canConfirmRacialBonuses()) {
      pendingStep.current = destination
      setRacialConfirmation('continue')
      return
    }
    if (target > activeStep && Object.keys(getErrors()).length > 0) {
      setValidationAttempted(true)
      requestAnimationFrame(() => {
        if (activeStep === 4 && getErrors(4).equipment) {
          const confirmButton = document.getElementById('equipment-confirm-button')
          confirmButton?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          confirmButton?.focus({ preventScroll: true })
          return
        }
        const invalid = document.querySelector<HTMLElement>('.wizard [aria-invalid="true"]')
        invalid?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        invalid?.focus({ preventScroll: true })
      })
      return
    }
    // Never skip steps that have not yet been completed.
    if (destination > activeStep) {
      for (let step = 0; step < destination; step++) {
        if (Object.keys(getErrors(step)).length > 0) {
          setValidationAttempted(true)
          try {
            await persistDraftNow(step)
            callbacks.current.onStepChange(step)
          } catch {
            // Do not navigate away from data that failed to save.
          }
          return
        }
      }
    }
    if (destination < steps.length) {
      setValidationAttempted(false)
      try {
        await persistDraftNow(destination)
        callbacks.current.onStepChange(destination)
      } catch {
        // Keep the current step open until its changes are safely saved.
      }
      return
    }

    setCompleting(true)
    let draftSaved = false
    try {
      await persistDraftNow(activeStep)
      draftSaved = true
      const id = characterId ?? draftId.current ?? crypto.randomUUID()
      await callbacks.current.onComplete({ ...character, maxHp, portraitUrl: '' }, id)
      toast.success(`Ficha de ${character.name} salva na sua conta.`)
    } catch {
      if (draftSaved) toast.error(`Não foi possível concluir e salvar a ficha de ${character.name}. Tente novamente.`)
    } finally {
      setCompleting(false)
    }
  }

  async function confirmRacialBonuses() {
    const shouldContinue = racialConfirmation === 'continue'
    const destination = pendingStep.current ?? activeStep + 1
    pendingStep.current = null
    const bonuses = getRacialAbilityBonuses()
    const nextCharacter = {
      ...character,
      abilities: Object.fromEntries(
        Object.entries(character.abilities).map(([ability, value]) => [
          ability,
          bonuses[ability] ? String(Number(value) + bonuses[ability]) : value,
        ]),
      ),
      appliedRacialBonuses: bonuses,
    }
    setCharacter(nextCharacter)
    setRacialConfirmation(null)
    setAbilityPopover(null)
    if (shouldContinue && activeStep < steps.length - 1) {
      const hasOtherErrors = Object.keys(getErrors()).length > 0
      setValidationAttempted(hasOtherErrors)
      if (hasOtherErrors) {
        requestAnimationFrame(() => {
          const invalid = document.querySelector<HTMLElement>('.wizard [aria-invalid="true"]')
          invalid?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          invalid?.focus({ preventScroll: true })
        })
      } else {
        try {
          await persistDraftNow(destination, nextCharacter)
          callbacks.current.onStepChange(destination)
        } catch {
          // Stay on the current step if saving fails.
        }
      }
    }
  }

  function renderClassStep() {
    const selectedClass = classes.find((item) => item.id === character.characterClassId)
    const quickBuild = selectedClass ? quickBuilds[normalizeTerm(selectedClass.name)] : undefined
    const classIsSelected = Boolean(selectedClass)
    const abilitiesAreComplete = abilitiesSectionIsComplete()
    const hitPointsAreComplete = hitPointsSectionIsComplete()

    return (
      <div className="wizard__class-step">
        <div className="wizard__section-card wizard__class-selection">
        {renderStepHeading()}
        <label className="wizard__field">
          <span>Classe {requiredMark}</span>
          <select
            {...fieldProps('characterClassId')}
            required
            onChange={(event) => {
              const characterClassId = event.currentTarget.value
              requestStartingEquipmentReset((current) => ({
                ...current,
                characterClassId,
                classSubclassId: '',
                classFeatureChoices: {},
                spells: '',
                primalPath: '',
                primalTotemChoices: initialCharacter.primalTotemChoices,
                skillProficiencies: [],
                bardInstrumentChoices: [],
              }))
            }}
            value={character.characterClassId}
          >
            <option value="">Selecione uma classe</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {feedback('characterClassId')}
        </label>
        {loadError && <p className="wizard__notice">{loadError}</p>}
        {classes.length === 0 && !loadError && <p className="wizard__notice">Carregando opções…</p>}
        {quickBuild && (
          <article className="wizard__quick-build">
            <p className="wizard__paper-eyebrow">Construção rápida</p>
            <p className="wizard__quick-build-text">{quickBuild.split(/(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma|(?<=antecedente )[^.]+)/g).map((part, index) => index % 2 ? <strong key={index}>{part}</strong> : part)}</p>
          </article>
        )}
        </div>
        <div aria-disabled={!classIsSelected} className="wizard__section-gate" inert={!classIsSelected}>
          {renderAbilitiesStep()}
        </div>
        <section
          aria-disabled={!abilitiesAreComplete}
          aria-labelledby="hp-title"
          className="wizard__section-card wizard__proficiency-section"
          inert={!abilitiesAreComplete}
        >
          <h2 id="hp-title">Pontos de vida</h2>
          {hitDie ? (
            <article className="wizard__racial-traits">
              <ul className="wizard__racial-details">
                <li><strong>Dado de Vida.</strong> 1d{hitDie} por nível de classe ({character.level}d{hitDie} no nível {character.level}).</li>
                <li><strong>PV no 1º nível.</strong> {hitDie} + modificador de Constituição.</li>
                <li><strong>PV nos níveis seguintes.</strong> 1d{hitDie} (ou {hitDie / 2 + 1}) + modificador de Constituição por nível após o 1º (mínimo de 1 PV por nível).</li>
              </ul>
            </article>
          ) : <p>Selecione uma classe para consultar as regras de pontos de vida.</p>}
          <label className="wizard__field">
            <span>PV máximos {requiredMark}</span>
            <input {...fieldProps('maxHp')} required disabled={character.level === 1} type="number" min="1" step="1" value={maxHp} onChange={(event) => updateCharacter('maxHp', event.target.value)} />
            {feedback('maxHp')}
          </label>
          <p>{character.level === 1
            ? `Calculado automaticamente: dado de vida máximo + modificador de Constituição (incluindo o aumento racial)${hillDwarfBonus ? ' + 1 PV de Anão da Colina' : ''}.`
            : `Registre o total para o nível ${character.level}, incluindo Constituição e eventuais bônus raciais ou talentos.`}</p>
        </section>
        {renderBackgroundSelectionStep(hitPointsAreComplete)}
        {renderClassProficienciesStep()}
      </div>
    )
  }

  function renderBackgroundSelectionStep(isEnabled: boolean) {
    const background = getBackgroundRulesFor()
    const backgroundLanguageCount = (background?.languageChoices ?? 0) +
      (background?.merchantAlternative && character.merchantAlternative === 'language' ? 1 : 0)

    return (
      <section
        aria-disabled={!isEnabled}
        aria-labelledby="background-title"
        className="wizard__section-card wizard__background-section"
        inert={!isEnabled}
      >
        <h2 id="background-title">Antecedente</h2>
        <label className="wizard__field">
          <span>Antecedente {requiredMark}</span>
          <select {...fieldProps('backgroundId')} required value={character.backgroundId} onChange={(event) => selectBackground(event.target.value)}>
            <option value="">Selecione um antecedente</option>
            {backgrounds.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {feedback('backgroundId')}
        </label>
        {background?.merchantAlternative && (
          <div className="wizard__language-choice">
            <p>Mercador de Guilda: escolha um benefício no lugar das ferramentas de artesão. {requiredMark}</p>
            {feedback('merchantAlternative')}
            <div {...fieldProps('merchantAlternative')} tabIndex={-1} className="wizard__skill-options" role="group" aria-label="Benefício alternativo de Mercador de Guilda">
              <button
                aria-pressed={character.merchantAlternative === 'navigator-tools'}
                className="wizard__skill-option"
                onClick={() => setCharacter((current) => ({
                  ...current,
                  merchantAlternative: 'navigator-tools',
                  backgroundLanguageChoices: current.backgroundLanguageChoices.slice(0, background.languageChoices ?? 0),
                }))}
                type="button"
              >Ferramentas de navegador</button>
              <button
                aria-pressed={character.merchantAlternative === 'language'}
                className="wizard__skill-option"
                onClick={() => updateCharacter('merchantAlternative', 'language')}
                type="button"
              >Um idioma adicional</button>
            </div>
          </div>
        )}
        {background && (
          <article className="wizard__racial-traits">
            <p className="wizard__paper-eyebrow">Características · {selectedName(backgrounds, character.backgroundId)}</p>
            <ul className="wizard__racial-details">
              <li><strong>Proficiência em perícias.</strong> {background.skillChoiceCount ? `Escolha ${background.skillChoiceCount} entre ${(background.skillChoices ?? []).join(', ')}.` : `${background.skills.join(', ')}.`}</li>
              <li><strong>Proficiência em ferramentas.</strong> {[...(background.tools ?? []), ...(background.merchantAlternative && character.merchantAlternative === 'navigator-tools' ? ['Ferramentas de navegador'] : [])].join(', ') || 'Nenhuma proficiência fixa.'} {background.toolChoice && `Escolha uma proficiência dentre ${background.toolChoice.length} opções.`} {background.merchantAlternative && 'O Mercador de Guilda pode escolher ferramentas de navegador ou um idioma adicional.'}</li>
              <li><strong>Idiomas.</strong> {backgroundLanguageCount ? `${backgroundLanguageCount} à sua escolha${background.requiredLanguageOptions ? `, sendo ao menos um entre ${background.requiredLanguageOptions.join(', ')}` : ''}${character.backgroundLanguageChoices.length ? ` (${character.backgroundLanguageChoices.join(', ')})` : ''}.` : 'Nenhum idioma adicional.'}</li>
            </ul>
            {background.skillChoiceCount ? <div>
              <p>Escolha {background.skillChoiceCount} perícias do antecedente. ({character.backgroundSkillChoices?.length ?? 0} de {background.skillChoiceCount} selecionadas)</p>
              {feedback('backgroundSkillChoices')}
              <div {...fieldProps('backgroundSkillChoices')} tabIndex={-1} aria-label="Escolha as perícias do antecedente" className="wizard__skill-options" role="group">
                {background.skillChoices?.map((skill) => {
                  const selected = character.backgroundSkillChoices?.includes(skill) ?? false
                  return <button aria-pressed={selected} className="wizard__skill-option" disabled={!selected && (character.backgroundSkillChoices?.length ?? 0) >= background.skillChoiceCount!} key={skill} onClick={() => toggleBackgroundSkillChoice(skill)} type="button"><span aria-hidden="true" className="wizard__selection-dot wizard__selection-dot--checkbox" />{skill}</button>
                })}
              </div>
            </div> : null}
          </article>
        )}
      </section>
    )
  }

  function renderClassProficienciesStep() {
    const selectedClass = classes.find((item) => item.id === character.characterClassId)
    const normalizedClassName = normalizeTerm(selectedClass?.name ?? '')
    const proficiencies = classProficiencies[normalizedClassName]
    const hasValorCollege = normalizedClassName === 'bardo' && character.level >= 3 && character.classSubclassId === 'colegio-da-bravura'
    const hasClericHeavyArmor = normalizedClassName === 'clerigo' && ['dominio-da-guerra', 'dominio-da-natureza', 'dominio-da-tempestade', 'dominio-da-vida'].includes(character.classSubclassId)
    const hasClericMartialWeapons = normalizedClassName === 'clerigo' && ['dominio-da-guerra', 'dominio-da-tempestade'].includes(character.classSubclassId)
    const armorProficiencies = [...(proficiencies?.armor ?? []), ...(hasValorCollege ? ['Armaduras médias', 'Escudos'] : []), ...(hasClericHeavyArmor ? ['Armaduras pesadas'] : [])]
    const weaponProficiencies = [...(proficiencies?.weapons ?? []), ...(hasValorCollege || hasClericMartialWeapons ? ['Armas marciais'] : [])]
    const selectedSubclass = classFeatures[normalizedClassName]?.subclasses.find((subclass) => subclass.id === character.classSubclassId)
    const loreFeature = selectedSubclass?.features.find((feature) => feature.choices?.some((choice) => choice.id === 'lore-additional-skills'))
    const loreChoice = loreFeature?.choices?.find((choice) => choice.id === 'lore-additional-skills')
    const loreChoiceKey = loreFeature && loreChoice
      ? `${character.characterClassId}:${character.classSubclassId}:${loreFeature.level}:${loreFeature.name}:${loreChoice.id}`
      : ''
    const collegeSkillChoices = normalizedClassName === 'bardo' && character.level >= 3 && loreChoiceKey
      ? character.classFeatureChoices[loreChoiceKey] ?? []
      : []
    const clericFeatureChoices = Object.entries(character.classFeatureChoices)
      .filter(([key]) => key.startsWith(`${character.characterClassId}:${character.classSubclassId}:`))
    const knowledgeSkills = normalizedClassName === 'clerigo' && character.classSubclassId === 'dominio-do-conhecimento'
      ? clericFeatureChoices.filter(([key]) => key.endsWith(':knowledge-skills')).flatMap(([, choices]) => choices)
      : []
    const natureSkills = normalizedClassName === 'clerigo' && character.classSubclassId === 'dominio-da-natureza'
      ? clericFeatureChoices.filter(([key]) => key.endsWith(':nature-skill')).flatMap(([, choices]) => choices)
      : []
    const background = getBackgroundRulesFor()
    const backgroundSkills = new Set([...(background?.skills ?? []), ...(character.backgroundSkillChoices ?? [])])
    const grantedSkills = new Set([...backgroundSkills, ...raceSkills, ...collegeSkillChoices, ...knowledgeSkills, ...natureSkills])
    const raceLanguageRules = getRaceLanguageRulesFor()
    const raceLanguageChoiceCount = getRaceLanguageChoiceCount()
    const backgroundLanguageChoiceCount = (background?.languageChoices ?? 0) +
      (background?.merchantAlternative && character.merchantAlternative === 'language' ? 1 : 0)
    const proficiencyBonus = 2 + Math.floor((character.level - 1) / 4)
    const isEnabled = backgroundSectionIsComplete()

    if (!selectedClass || !proficiencies) {
      return <div aria-disabled={!isEnabled} className="wizard__section-gate" inert={!isEnabled}><p className="wizard__notice">Selecione uma classe para consultar seus testes de resistência e perícias.</p></div>
    }

    const selectedSkills = new Set(character.skillProficiencies.filter((skill) => !grantedSkills.has(skill)))
    const bardExpertiseSkills = new Set(normalizedClassName === 'bardo'
      ? Object.entries(character.classFeatureChoices)
        .filter(([key]) => key.startsWith(`${character.characterClassId}:${character.classSubclassId}:`) && key.endsWith(':bard-expertise'))
        .flatMap(([, choices]) => choices)
      : [])
    const clericExpertiseSkills = new Set(knowledgeSkills)
    const remaining = proficiencies.skillCount - selectedSkills.size
    const languageChoices = [...character.raceLanguageChoices, ...character.backgroundLanguageChoices]
    const languageCount = raceLanguageChoiceCount + backgroundLanguageChoiceCount
    const requiredBackgroundLanguages = new Set(background?.requiredLanguageOptions ?? [])
    const fixedLanguages = new Set([...raceLanguageRules.fixed, ...classLanguages])
    const skillOrder = (skill: string) => grantedSkills.has(skill) ? 1 : proficiencies.skills.includes(skill) ? 0 : 2

    return (
      <div aria-disabled={!isEnabled} className="wizard__class-proficiencies" inert={!isEnabled}>
        <section className="wizard__section-card wizard__proficiencies-group" aria-labelledby="proficiencies-title">
        <h2 id="proficiencies-title">Proficiências</h2>
        <aside className="wizard__proficiency-context">
          <p className="wizard__paper-eyebrow">Bônus de proficiência: +{proficiencyBonus} · Nível {character.level}</p>
          <p>Este bônus é somado ao modificador de habilidade nos testes de resistência e perícias em que sua classe, raça ou antecedente concede proficiência. Sem proficiência, use apenas o modificador; o bônus é somado uma única vez.</p>
          <p>O bônus é usado nas regras de testes de habilidade, testes de resistência e jogadas de ataque.</p>
        </aside>
        <section aria-labelledby="saving-throws-title" className="wizard__proficiency-section">
          <h3 id="saving-throws-title">Testes de resistência</h3>
          <p>A classe <strong>{selectedClass.name}</strong> concede proficiência nestes testes:</p>
          <div className="wizard__proficiency-chips">
            {proficiencies.saves.map((save) => {
              const ability = abilityLabels.find(([, label]) => label === save)?.[0]
              const modifier = ability ? getAbilityModifier(ability) : null
              const total = modifier === null ? null : modifier + proficiencyBonus
              return <span className="wizard__proficiency-chip" key={save}>{save} {total === null ? '—' : `${total >= 0 ? '+' : ''}${total}`}</span>
            })}
          </div>
        </section>
        {(proficiencies.armor?.length || proficiencies.weapons?.length || proficiencies.tools) ? <section aria-labelledby="equipment-proficiencies-title" className="wizard__proficiency-section">
          <h3 id="equipment-proficiencies-title">Proficiências com equipamentos</h3>
          <div className="wizard__proficiency-chips">
            {armorProficiencies.length ? <span className="wizard__proficiency-chip">Armaduras: {armorProficiencies.join(', ')}</span> : null}
            {weaponProficiencies.length ? <span className="wizard__proficiency-chip">Armas: {weaponProficiencies.join(', ')}</span> : null}
            {proficiencies.tools ? <span className="wizard__proficiency-chip">Ferramentas: {proficiencies.tools.length ? proficiencies.tools.join(', ') : 'Nenhuma'}</span> : null}
            {proficiencies.instrumentChoiceCount || proficiencies.toolChoiceOptions ? <span className="wizard__proficiency-chip">Ferramentas: {character.bardInstrumentChoices.length ? character.bardInstrumentChoices.join(', ') : proficiencies.toolChoiceOptions ? 'Uma ferramenta de artesão ou instrumento musical à escolha' : `${proficiencies.instrumentChoiceCount} instrumentos musicais à escolha`}</span> : null}
          </div>
        </section> : null}
        {proficiencies.instrumentChoiceCount || proficiencies.toolChoiceOptions ? <section aria-labelledby="bard-instruments-title" className="wizard__proficiency-section">
          <h3 id="bard-instruments-title">{proficiencies.toolChoiceOptions ? 'Proficiência com ferramentas' : 'Instrumentos musicais'} {requiredMark}</h3>
          <p>{proficiencies.toolChoiceOptions ? 'Escolha um tipo de ferramenta de artesão ou um instrumento musical.' : `Escolha ${proficiencies.instrumentChoiceCount} instrumentos diferentes. (${character.bardInstrumentChoices.length} de ${proficiencies.instrumentChoiceCount} selecionados)`}</p>
          {feedback('bardInstrumentChoices')}
          <div {...fieldProps('bardInstrumentChoices')} tabIndex={-1} aria-label={proficiencies.toolChoiceOptions ? 'Escolha uma proficiência com ferramentas' : `Escolha ${proficiencies.instrumentChoiceCount} instrumentos musicais`} className="wizard__skill-options" role="group">
            {(proficiencies.toolChoiceOptions ?? musicalInstruments).map((instrument) => {
              const selected = character.bardInstrumentChoices.includes(instrument)
              return <Button
                aria-pressed={selected}
                className="wizard__skill-option"
                disabled={!selected && character.bardInstrumentChoices.length >= (proficiencies.instrumentChoiceCount ?? 1)}
                key={instrument}
                variant="ghost"
                onClick={() => setCharacter((current) => ({
                  ...current,
                  bardInstrumentChoices: current.bardInstrumentChoices.includes(instrument)
                    ? current.bardInstrumentChoices.filter((choice) => choice !== instrument)
                    : [...current.bardInstrumentChoices, instrument],
                }))}
              ><span aria-hidden="true" className={`wizard__selection-dot${(proficiencies.instrumentChoiceCount ?? 1) > 1 ? ' wizard__selection-dot--checkbox' : ''}`} />{instrument}</Button>
            })}
          </div>
        </section> : null}
        <section aria-labelledby="class-skills-title" className="wizard__proficiency-section">
          <h3 id="class-skills-title">Perícias {requiredMark}</h3>
          <p>Escolha {proficiencies.skillCount} perícias. ({remaining > 0 ? `Faltam ${remaining}` : 'Seleção completa'})</p>
          {feedback('skillProficiencies')}
          <div {...fieldProps('skillProficiencies')} tabIndex={-1} aria-label={`Escolha ${proficiencies.skillCount} perícias`} className="wizard__skill-options" role="group">
            {Object.keys(skillAbilities).sort((a, b) => skillOrder(a) - skillOrder(b)).map((skill) => {
              const granted = grantedSkills.has(skill)
              const source = [
                raceSkills.includes(skill) && `raça ${selectedName(races, character.raceId)}`,
                backgroundSkills.has(skill) && `antecedente ${selectedName(backgrounds, character.backgroundId)}`,
                collegeSkillChoices.includes(skill) && 'Colégio do Conhecimento',
                knowledgeSkills.includes(skill) && 'Domínio do Conhecimento',
                natureSkills.includes(skill) && 'Domínio da Natureza',
              ].filter(Boolean).join(' e ')
              const selected = granted || selectedSkills.has(skill)
              const ability = skillAbilities[skill]
              const modifier = getAbilityModifier(ability)
              const hasExpertise = selected && (bardExpertiseSkills.has(skill) || clericExpertiseSkills.has(skill))
              const total = modifier === null ? null : modifier + (selected ? proficiencyBonus * (hasExpertise ? 2 : 1) : 0)
              return (
                <button
                  aria-label={skill}
                  aria-description={`${abilityLabels.find(([key]) => key === ability)?.[1]}. Modificador total: ${total ?? 'a definir'}.${hasExpertise ? ' Bônus de proficiência dobrado por Aptidão.' : ''} ${granted ? `Concedida por ${source}.` : selected ? 'Proficiência escolhida.' : 'Sem proficiência.'}`}
                  aria-pressed={selected}
                  aria-disabled={granted || undefined}
                  data-tooltip={granted ? `Concedida por ${source}.` : undefined}
                  className={`wizard__skill-option wizard__skill-option--detailed${granted ? ' wizard__skill-option--granted' : ''}`}
                  disabled={!granted && (!proficiencies.skills.includes(skill) || (!selected && selectedSkills.size >= proficiencies.skillCount))}
                  title={granted ? undefined : proficiencies.skills.includes(skill) ? 'Proficiência à escolha da classe' : 'Esta classe não permite escolher esta perícia'}
                  key={skill}
                  onClick={() => !granted && setCharacter((current) => {
                    const classSelections = current.skillProficiencies.filter((value) => !grantedSkills.has(value))
                    return {
                      ...current,
                      skillProficiencies: classSelections.includes(skill)
                        ? classSelections.filter((value) => value !== skill)
                        : classSelections.length < proficiencies.skillCount
                          ? [...classSelections, skill]
                          : classSelections,
                    }
                  })}
                  type="button"
                >
                  <span className={`wizard__selection-dot${proficiencies.skillCount > 1 ? ' wizard__selection-dot--checkbox' : ''}`} aria-hidden="true" />
                  <span className="wizard__skill-ability">({abilityShortLabels[ability]})</span>
                  {skill} <strong>{total === null ? '—' : `${total >= 0 ? '+' : ''}${total}`}</strong>
                </button>
              )
            })}
          </div>
        </section>
        {(background?.tools?.length || background?.toolChoice || (background?.merchantAlternative && character.merchantAlternative === 'navigator-tools')) && <section aria-labelledby="background-tool-proficiencies-title" className="wizard__proficiency-section">
          <h3 id="background-tool-proficiencies-title">Proficiências com ferramentas do antecedente</h3>
          {background?.tools?.length ? <div className="wizard__proficiency-chips">{background.tools.map(tool => <span className="wizard__proficiency-chip" key={tool}>{tool}</span>)}</div> : null}
          {background?.merchantAlternative && character.merchantAlternative === 'navigator-tools' && <div className="wizard__proficiency-chips"><span className="wizard__proficiency-chip">Ferramentas de navegador</span></div>}
          {background?.toolChoice && <>
            {requiredMark}{feedback('toolProficiencyChoices')}
            <div {...fieldProps('toolProficiencyChoices')} tabIndex={-1} aria-label="Escolha a proficiência com ferramenta" className="wizard__skill-options" role="group">
              {background.toolChoice.map(tool => {
                const selected = character.toolProficiencyChoices.includes(tool)
                return <Button aria-pressed={selected} className="wizard__skill-option" key={tool} onClick={() => updateCharacter('toolProficiencyChoices', selected ? [] : [tool])} variant={selected ? 'primary' : 'secondary'} size="small" type="button"><span aria-hidden="true" className="wizard__selection-dot" />{tool}</Button>
              })}
            </div>
          </>}
        </section>}
        </section>
        <section aria-labelledby="languages-title" className="wizard__section-card wizard__proficiency-section wizard__languages-section">
          <h2 id="languages-title">Idiomas {languageCount > 0 && requiredMark}</h2>
          {languageCount > 0 && <p>Escolha {languageCount} {languageCount === 1 ? 'idioma' : 'idiomas'}. ({languageCount > languageChoices.length ? `Faltam ${languageCount - languageChoices.length}` : 'Seleção completa'})</p>}
          {requiredBackgroundLanguages.size > 0 && <p>Ao menos um idioma do antecedente deve ser: {[...requiredBackgroundLanguages].join(', ')}.</p>}
          {feedback('languages')}
          <div {...fieldProps('languages')} tabIndex={-1} aria-label="Idiomas do personagem" className="wizard__skill-options" role="group">
            {[...languageOptions, ...classLanguages].map((language) => {
              const fixed = fixedLanguages.has(language)
              const selected = fixed || languageChoices.includes(language)
              const source = [raceLanguageRules.fixed.includes(language) && `raça ${selectedName(races, character.raceId)}`, classLanguages.includes(language) && `classe ${selectedClass.name}`].filter(Boolean).join(' e ')
              return (
                <button aria-pressed={selected} aria-disabled={fixed || undefined} aria-description={fixed ? `Concedido por ${source}.` : undefined} data-tooltip={fixed ? `Concedido por ${source}.` : undefined} className={`wizard__skill-option wizard__skill-option--detailed${fixed ? ' wizard__skill-option--granted' : ''}`} disabled={!selected && languageChoices.length >= languageCount} key={language} onClick={() => { if (!fixed) toggleLanguageChoice(language) }} type="button">
                  <span className={`wizard__selection-dot${languageCount > 1 ? ' wizard__selection-dot--checkbox' : ''}`} aria-hidden="true" />{language}
                </button>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  function renderAbilitiesStep() {
    const selectedRace = races.find((race) => race.id === character.raceId)
    const raceName = normalizeTerm(selectedRace?.name ?? '')
    const choice = normalizeTerm(character.racialChoice)
    const selectionCount = raceName === 'humano' && choice.includes('variante') ? 3 : raceName === 'meio-elfo' ? 2 : 0
    const method = character.abilityScoreMethod
    const bonuses = getRacialAbilityBonuses()
    const classIncreases = getClassAbilityScoreIncreaseTotals()
    const configuration = selectedRace ? racialConfigurations[selectedRace.name] : undefined
    const raceIsConfigured = Boolean(selectedRace) && (!configuration?.choices || Boolean(character.racialChoice))
    const raceBonusLabel = selectedRace
      ? character.racialChoice && !normalizeTerm(character.racialChoice).startsWith(raceName)
        ? `${selectedRace.name} (${character.racialChoice})`
        : character.racialChoice || selectedRace.name
      : ''
    const targets = Object.entries(bonuses).filter(([, bonus]) => bonus > 0)
    const allocationsAreValid = selectionCount === 0 || (
      character.racialAbilityChoices.length >= selectionCount &&
      new Set(character.racialAbilityChoices.slice(0, selectionCount)).size === selectionCount &&
      (raceName !== 'meio-elfo' || character.racialAbilityChoices.slice(0, selectionCount).every((ability) => ability !== 'charisma'))
    )
    const canApply = raceIsConfigured && allocationsAreValid && targets.length > 0 && targets.every(([ability, bonus]) => {
      const value = Number(character.abilities[ability])
      return character.abilities[ability] !== '' && Number.isInteger(value) && value >= 1 && value + bonus <= 30
    }) && abilityScoresAreValid()
    const hasAppliedBonuses = Object.values(character.appliedRacialBonuses).some((bonus) => bonus > 0)
    const chosenAbilities = new Set(character.racialAbilityChoices.slice(0, selectionCount))
    const needsFlexibleChoices = selectionCount > 0 && chosenAbilities.size < selectionCount
    const pointBuySpent = abilityLabels.reduce((total, [key]) => {
      const value = character.abilities[key]
      const score = Number(value) - (character.appliedRacialBonuses[key] ?? 0) - (classIncreases[key] ?? 0)
      return total + (value !== '' && Number.isInteger(score) ? pointBuyCosts[score] ?? 0 : 0)
    }, 0)

    function toggleAbilityChoice(ability: string) {
      const choices = character.racialAbilityChoices.slice(0, selectionCount)
      const nextChoices = choices.includes(ability)
        ? choices.filter((choice) => choice !== ability)
        : choices.length < selectionCount
          ? [...choices, ability]
          : choices
      resetRacialBonuses('racialAbilityChoices', nextChoices)
    }

    function assignAbilityScore(ability: string, score: number) {
      updateCharacter('abilities', { ...character.abilities, [ability]: String(score) })
      setAbilityPopover(null)
    }

    return (
      <div className="wizard__ability-step wizard__section-card">
        <section className="wizard__method-picker" aria-labelledby="ability-method-title">
          <h2 id="ability-method-title">Como definir os valores de habilidade? {requiredMark}</h2>
          {feedback('abilityScoreMethod')}
          <div {...fieldProps('abilityScoreMethod')} tabIndex={-1} className="wizard__method-options" role="group" aria-label="Método de definição dos valores">
            {abilityScoreMethods.map(({ id, name, description }) => (
              <button
                aria-pressed={method === id}
                className="wizard__method-option"
                disabled={hasAppliedBonuses}
                key={id}
                onClick={() => selectAbilityScoreMethod(id)}
                type="button"
              >
                <span aria-hidden="true" className="wizard__method-radio" />
                <strong>{name}</strong>
                <span>{description}</span>
              </button>
            ))}
          </div>
          {hasAppliedBonuses && <p className="wizard__method-hint">Reverta os bônus raciais para alterar o método ou os valores.</p>}
        </section>

        {method === 'point-buy' && (
          <p className="wizard__point-buy-balance" aria-live="polite">
            Pontos gastos: <strong>{pointBuySpent}</strong> de 27 · Restantes: <strong>{27 - pointBuySpent}</strong>
          </p>
        )}

        {feedback('abilities')}
        <div {...fieldProps('abilities')} tabIndex={-1} className="wizard__abilities" ref={abilitiesRef}>
          {abilityLabels.map(([key, label]) => {
            const value = character.abilities[key]
            const modifier = value === '' ? null : Math.floor((Number(value) - 10) / 2)
            const currentScore = value === '' ? null : Number(value) - (character.appliedRacialBonuses[key] ?? 0) - (classIncreases[key] ?? 0)
            const usedScores = new Set(abilityLabels
              .filter(([otherKey]) => otherKey !== key)
              .map(([otherKey]) => Number(character.abilities[otherKey]) - (character.appliedRacialBonuses[otherKey] ?? 0) - (classIncreases[otherKey] ?? 0))
              .filter(Number.isFinite))
            const pointsAvailable = 27 - abilityLabels.reduce((total, [otherKey]) => {
              if (otherKey === key) return total
              const score = Number(character.abilities[otherKey]) - (character.appliedRacialBonuses[otherKey] ?? 0) - (classIncreases[otherKey] ?? 0)
              return total + (character.abilities[otherKey] !== '' && Number.isInteger(score) ? pointBuyCosts[score] ?? 0 : 0)
            }, 0)
            return (
              <div className="wizard__ability" key={key}>
                <div className="wizard__field">
                  <span>{abilityShortLabels[key]}</span>
                  {method === 'manual-roll' ? (
                    <input
                      aria-label={label}
                      disabled={hasAppliedBonuses}
                      inputMode="numeric"
                      maxLength={2}
                      onChange={(event) => {
                        const score = digits(event.target.value, 2)
                        updateCharacter('abilities', {
                          ...character.abilities,
                          [key]: score && Number(score) > 18 ? '18' : score,
                        })
                      }}
                      pattern="[0-9]*"
                      ref={key === 'strength' ? firstAbilityInputRef : undefined}
                      type="text"
                      value={value}
                    />
                  ) : method ? (
                    <button
                      aria-expanded={abilityPopover === key}
                      aria-haspopup="dialog"
                      className="wizard__ability-value"
                      disabled={hasAppliedBonuses}
                      onClick={() => setAbilityPopover((open) => open === key ? null : key)}
                      type="button"
                    >
                      {value || '—'}
                    </button>
                  ) : (
                    <span className="wizard__ability-value wizard__ability-value--empty">—</span>
                  )}
                </div>
                <output className="wizard__modifier" aria-label={`Modificador de ${label}`} title={`Modificador de ${label}`}>
                  {modifier === null ? '—' : `${modifier >= 0 ? '+' : ''}${modifier}`}
                </output>
                {abilityPopover === key && method && method !== 'manual-roll' && (
                  <div
                    className="wizard__ability-popover"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setAbilityPopover(null)
                    }}
                    role="dialog"
                    aria-label={`Escolher valor para ${label}`}
                  >
                    {method === 'point-buy' && (
                      <p className="wizard__ability-popover-balance">
                        Pontos disponíveis: <strong>{pointsAvailable}</strong>
                      </p>
                    )}
                    <div className="wizard__score-options">
                      {(method === 'standard-array' ? standardArray : Object.keys(pointBuyCosts).map(Number)).map((score) => {
                        const cost = pointBuyCosts[score]
                        const disabled = method === 'standard-array'
                          ? score !== currentScore && usedScores.has(score)
                          : cost > pointsAvailable
                        return (
                          <button
                            aria-pressed={currentScore === score}
                            className="wizard__score-option"
                            disabled={disabled}
                            key={score}
                            onClick={() => assignAbilityScore(key, score)}
                            type="button"
                          >
                            <strong>{score}</strong>
                            {method === 'point-buy' && <span>{cost} {cost === 1 ? 'ponto' : 'pontos'}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {selectedRace && <hr className="wizard__ability-divider" />}

        {selectedRace && (
          <aside className="wizard__racial-bonus" aria-live="polite">
            <div>
              <p className="wizard__racial-bonus-eyebrow">Aumento de habilidade · {raceBonusLabel}</p>
              <p className="wizard__racial-bonus-description">
                {!raceIsConfigured ? (
                  'Escolha uma sub-raça para ver os aumentos.'
                ) : (
                  <>
                    {targets.map(([ability, bonus], index) => (
                      <span key={ability}>
                        {index > 0 && '; '}
                        <strong>{abilityLabels.find(([key]) => key === ability)?.[1]}</strong> aumenta em <strong>+{bonus}</strong>
                      </span>
                    ))}
                    {needsFlexibleChoices && (
                      <span>
                        {targets.length > 0 ? ' Escolha também ' : 'Escolha '}
                        {selectionCount === 2 ? 'duas outras habilidades' : 'três habilidades'}, cada uma aumenta em <strong>+1</strong>.
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            {selectionCount > 0 && (
              <div
                {...fieldProps('racialAbilityChoices')}
                tabIndex={-1}
                aria-label={`Selecione ${selectionCount} habilidades`}
                className="wizard__racial-allocation"
                role="group"
              >
                {requiredMark}{feedback('racialAbilityChoices')}
                {abilityLabels.map(([key, label]) => {
                  const selected = chosenAbilities.has(key)
                  const unavailable = raceName === 'meio-elfo' && key === 'charisma'
                  return (
                    <button
                      aria-pressed={selected}
                      className="wizard__racial-chip"
                      disabled={hasAppliedBonuses || unavailable || (!selected && chosenAbilities.size >= selectionCount)}
                      key={key}
                      onClick={() => toggleAbilityChoice(key)}
                      type="button"
                    >
                      <span aria-hidden="true" className="wizard__selection-dot wizard__selection-dot--checkbox" />
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
            <Button
              className={hasAppliedBonuses
                ? 'wizard__racial-bonus-action wizard__racial-bonus-action--warning'
                : 'wizard__racial-bonus-action wizard__racial-bonus-action--success'}
              disabled={!hasAppliedBonuses && !canApply}
              onClick={hasAppliedBonuses ? revertRacialBonuses : () => setRacialConfirmation('apply')}
              variant={hasAppliedBonuses ? 'secondary' : 'primary'}
            >
              {hasAppliedBonuses && (
                <span aria-hidden="true" className="material-symbols-rounded">edit</span>
              )}
              {hasAppliedBonuses ? 'Reverter aumento racial e editar' : 'Confirmar e aplicar aumento racial'}
            </Button>
          </aside>
        )}
      </div>
    )
  }

  function renderRaceChoiceStep() {
    if (loadError) return <p className="wizard__notice">{loadError}</p>
    if (races.length === 0) return <p className="wizard__notice">Carregando opções…</p>

    const selectedRace = races.find((race) => race.id === character.raceId)
    const configuration = selectedRace ? racialConfigurations[selectedRace.name] : undefined
    const selectedChoice = configuration?.choices?.find((choice) => choice.name === character.racialChoice)
    const isRaceConfigured = Boolean(selectedRace) && (!configuration?.choices || Boolean(selectedChoice))
    const hasAppliedBonuses = Object.values(character.appliedRacialBonuses).some((bonus) => bonus > 0)

    return (
      <div className="wizard__race-configurator">
        <div className="wizard__race-controls">
          <label className="wizard__field wizard__race-select">
            <span>Raça {requiredMark}</span>
            <select
              {...fieldProps('raceId')}
              required
              aria-label="Raça"
              onChange={(event) => {
                resetRacialBonuses('raceId', event.target.value)
              }}
              value={character.raceId}
            >
              <option value="">Selecione uma raça</option>
              {races.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.name}
                </option>
              ))}
            </select>
            {feedback('raceId')}
          </label>

          {selectedRace && configuration?.choices && (
            <fieldset {...fieldProps('racialChoice')} tabIndex={-1} className="wizard__racial-choice">
              <legend>{configuration.choiceLabel} {requiredMark}</legend>
              {feedback('racialChoice')}
              {configuration.choiceInput === 'select' ? (
                <select
                  aria-label={configuration.choiceLabel}
                  disabled={hasAppliedBonuses}
                  onChange={(event) => resetRacialBonuses('racialChoice', event.target.value)}
                  value={character.racialChoice}
                >
                  <option value="">Selecione uma cor</option>
                  {configuration.choices.map((choice) => (
                    <option key={choice.name} value={choice.name}>
                      {choice.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="wizard__choices">
                  {configuration.choices.map((choice) => (
                    <button
                      aria-pressed={character.racialChoice === choice.name}
                      className="wizard__choice"
                      disabled={hasAppliedBonuses}
                      key={choice.name}
                      onClick={() => resetRacialBonuses('racialChoice', choice.name)}
                      type="button"
                    >
                      {choice.name}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}
        </div>

        {selectedRace && (
          <>
            <figure className="wizard__selected-race-art">
              <img
                alt={`Ilustração de ${selectedRace.name}`}
                src={raceIllustrations[selectedRace.name] ?? '/images/races/dwarf.png'}
              />
            </figure>

            <div className="wizard__basic-grid wizard__racial-fields">
              <label className="wizard__field">
                <span>Idade</span>
                <input
                  disabled={!isRaceConfigured}
                  inputMode="numeric"
                  onChange={(event) => updateCharacter('age', formatAge(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key !== 'Backspace' && event.key !== 'Delete') return
                    event.preventDefault()
                    updateCharacter(
                      'age',
                      isEntireFieldSelected(event.currentTarget) ? '' : formatAge(digits(character.age, 3).slice(0, -1)),
                    )
                  }}
                  placeholder="Ex.: 34 anos"
                  value={character.age}
                />
              </label>
              <label className="wizard__field">
                <span>Altura</span>
                <input
                  disabled={!isRaceConfigured}
                  inputMode="numeric"
                  onChange={(event) => updateCharacter('height', formatHeight(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key !== 'Backspace' && event.key !== 'Delete') return
                    event.preventDefault()
                    updateCharacter(
                      'height',
                      isEntireFieldSelected(event.currentTarget) ? '' : formatHeight(digits(character.height, 3).slice(0, -1)),
                    )
                  }}
                  placeholder="Ex.: 1,78 m"
                  value={character.height}
                />
              </label>
              <label className="wizard__field">
                <span>Peso</span>
                <input
                  disabled={!isRaceConfigured}
                  inputMode="numeric"
                  onChange={(event) => updateCharacter('weight', formatWeight(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key !== 'Backspace' && event.key !== 'Delete') return
                    event.preventDefault()
                    updateCharacter(
                      'weight',
                      isEntireFieldSelected(event.currentTarget) ? '' : formatWeight(digits(character.weight, 3).slice(0, -1)),
                    )
                  }}
                  placeholder="Ex.: 75 kg"
                  value={character.weight}
                />
              </label>
              <label className="wizard__field wizard__field--wide">
                <span>Tendência</span>
                <select
                  disabled={!isRaceConfigured}
                  onChange={(event) => updateCharacter('alignment', event.target.value)}
                  value={character.alignment}
                >
                  <option value="">Selecione uma tendência</option>
                  {alignmentOptions.map((alignment) => (
                    <option key={alignment} value={alignment}>
                      {alignment}
                    </option>
                  ))}
                </select>
              </label>
              {isRaceConfigured && character.alignment && (
                <aside className="wizard__alignment-explanation">
                  <strong>{character.alignment}</strong>
                  <p>{alignmentDescriptions[character.alignment]}</p>
                </aside>
              )}
            </div>

            {configuration && (!configuration.choices || selectedChoice) && (
              <article className="wizard__racial-traits">
                <p className="wizard__paper-eyebrow">Traços raciais</p>
                <ul className="wizard__racial-details">
                  {configuration.details.map((detail) => (
                    <li key={detail}>{renderRacialText(detail)}</li>
                  ))}
                </ul>
                <ul className="wizard__racial-trait-list">
                  {[
                    ...configuration.traits.filter((trait) => !selectedChoice?.replaces?.includes(trait)),
                    ...(selectedChoice?.traits ?? []),
                  ].map((trait) => (
                    <li key={trait}>{renderRacialText(trait)}</li>
                  ))}
                </ul>
              </article>
            )}
          </>
        )}
      </div>
    )
  }

  function renderStepHeading() {
    return (
      <div>
        <h1 id="wizard-title">{steps[activeStep]}</h1>
        {activeStep === 0 && <p className="wizard__intro">Comece com a identidade do personagem.</p>}
      </div>
    )
  }

  function renderStepContent() {
    switch (activeStep) {
      case 0:
        return (
          <div className="wizard__identity-fields">
            <label className="wizard__portrait-upload">
              <span className="wizard__portrait-upload-label">Imagem de perfil</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label="Enviar imagem de perfil do personagem"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  openPortraitCropper(file)
                  event.currentTarget.value = ''
                }}
                type="file"
              />
              {character.portraitUrl
                ? <img alt="Prévia do retrato selecionado" src={character.portraitUrl} />
                : <span aria-hidden="true" className="material-symbols-rounded">add_a_photo</span>}
              {portraitUploading && <span className="wizard__portrait-upload-status">Enviando…</span>}
            </label>
            {portraitError && <p className="wizard__field-error" role="alert">{portraitError}</p>}
            <div className="wizard__name-level">
              <label className="wizard__field">
                <span>Nome do personagem {requiredMark}</span>
                <input
                  {...fieldProps('name')}
                  autoFocus
                  onChange={(event) => updateCharacter('name', event.target.value)}
                  placeholder="Ex.: Kael Dorn"
                  required
                  value={character.name}
                />
                {feedback('name')}
              </label>
              <label className="wizard__field">
                <span>Nível {requiredMark}</span>
                <select
                  {...fieldProps('level')}
                  required
                  onChange={(event) => {
                    const level = Number(event.target.value)
                    setCharacter((current) => resetClassAbilityScoreIncreases({ ...current, level, experiencePoints: String(experienceThresholds[level - 1]), maxHp: '' }))
                  }}
                  value={character.level}
                >
                  {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                {feedback('level')}
              </label>
              <label className="wizard__field">
                <span>Pontos de experiência (XP) {requiredMark}</span>
                <input
                  {...fieldProps('experiencePoints')}
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(event) => {
                    const experiencePoints = digits(event.target.value, 12)
                    const level = experiencePoints ? levelForExperience(Number(experiencePoints)) : 1
                    setCharacter((current) => {
                      const next = {
                      ...current,
                      experiencePoints,
                      level,
                      maxHp: level === current.level ? current.maxHp : '',
                      }
                      return level === current.level ? next : resetClassAbilityScoreIncreases(next)
                    })
                  }}
                  pattern="[0-9]*"
                  required
                  type="text"
                  value={character.experiencePoints}
                />
                {feedback('experiencePoints')}
              </label>
            </div>
          </div>
        )
      case 1:
        return renderRaceChoiceStep()
      case 2:
        return renderClassStep()
      case 3:
        return renderClassFeaturesStep()
      case 4:
        return renderEquipmentStep()
      case 5: {
        const abilityKey = spellcastingAbility === 'Carisma' ? 'charisma'
          : spellcastingAbility === 'Sabedoria' ? 'wisdom'
            : spellcastingAbility === 'Inteligência' ? 'intelligence'
              : ''
        const abilityModifier = abilityKey ? getAbilityModifier(abilityKey) : null
        const proficiencyBonus = 2 + Math.floor((character.level - 1) / 4)
        const spellSaveDc = abilityModifier === null ? null : 8 + abilityModifier + proficiencyBonus
        const spellAttackBonus = abilityModifier === null ? null : abilityModifier + proficiencyBonus
        const hasCantripSelection = cantripCount > 0 && availableCantrips.length > 0
        const panelSpellLevelLimit = hasLearnedSpellProgression && selectionPanelLevel > 0
          ? getSpellSlotsAtClassLevel(className, character.classSubclassId, selectionPanelLevel).length
          : maxSpellLevel
        const panelOptions = selectionPanelLevel === 0
          ? availableCantrips
          : Object.entries(availableLeveledSpells)
            .filter(([level]) => Number(level) <= panelSpellLevelLimit)
            .flatMap(([, spells]) => spells)
        const availablePanelSpellLevels = [...new Set(panelOptions.map((name) => spellLevelByName[name]).filter((level) => level !== undefined))]
          .sort((first, second) => first - second)
        const normalizedSpellSearch = normalizeTerm(spellListSearch.trim())
        const filteredPanelOptions = panelOptions.filter((name) =>
          (spellLevelFilter === null || spellLevelByName[name] === spellLevelFilter)
          && (!normalizedSpellSearch || normalizeTerm(name).includes(normalizedSpellSearch)))
        const panelCurrentSelection = selectionPanelLevel === 0
          ? selectionPanelSlot === null ? selectedCantrips : [selectedCantripSlots[selectionPanelSlot] ?? ''].filter(Boolean)
          : hasLearnedSpellProgression
            ? selectionPanelSlot === null ? selectedKnownSpellSlots.filter(Boolean) : [selectedKnownSpellSlots[selectionPanelSlot] ?? ''].filter(Boolean)
            : selectedPreparedSpells.map(({ name }) => name)
        const panelSelectionLimit = selectionPanelLevel === 0
          ? selectionPanelSlot === null ? cantripCount : 1
          : hasLearnedSpellProgression
            ? selectionPanelSlot === null ? currentKnownSpellCount : 1
            : spellcastingProgression.selectionLimit ?? Number.POSITIVE_INFINITY
        const panelOtherSelectionCount = selectionPanelLevel === 0 || hasLearnedSpellProgression
          ? 0
          : selectedLeveledSpellCount - panelCurrentSelection.length
        const panelSelectionTotal = panelOtherSelectionCount + cantripDraft.length
        const openSelectionPanel = (level: number, slotIndex?: number) => {
          setSelectionPanelLevel(level)
          setSelectionPanelSlot(slotIndex ?? null)
          setSpellLevelFilter(null)
          setSpellListSearch('')
          setCantripDraft(level === 0
            ? slotIndex === undefined ? selectedCantrips : [selectedCantripSlots[slotIndex] ?? ''].filter(Boolean)
            : hasLearnedSpellProgression
              ? slotIndex === undefined
                ? selectedKnownSpellSlots.filter(Boolean)
                : [selectedKnownSpellSlots[slotIndex] ?? ''].filter(Boolean)
              : selectedPreparedSpells.map(({ name }) => name))
          setCantripPanelOpen(true)
        }
        const togglePanelSelection = (name: string) => {
          if (selectionPanelSlot !== null || panelSelectionLimit === 1) {
            setCantripDraft([name])
            return
          }
          setCantripDraft((current) => current.includes(name)
            ? current.filter((spell) => spell !== name)
            : panelOtherSelectionCount + current.length < panelSelectionLimit ? [...current, name] : current)
        }
        const confirmSelection = () => {
          if (selectionPanelLevel === 0) {
            if (selectionPanelSlot === null) return
            const nextCantripSlots = [...selectedCantripSlots]
            nextCantripSlots[selectionPanelSlot] = cantripDraft[0] ?? ''
            updateCharacter('spells', JSON.stringify({
              cantrips: nextCantripSlots,
              ...(hasLearnedSpellProgression ? { knownSpells: selectedKnownSpellSlots } : { spells: selectedSpellsByLevel }),
            }))
          } else if (hasLearnedSpellProgression) {
            if (selectionPanelSlot === null) return
            const nextKnownSpells = [...selectedKnownSpellSlots]
            nextKnownSpells[selectionPanelSlot] = cantripDraft[0] ?? ''
            const wizardPreparedSpells = className === 'mago'
              ? nextKnownSpells.filter(Boolean).slice(0, Math.max(1, character.level + (getAbilityModifier('intelligence') ?? 0)))
              : undefined
            updateCharacter('spells', JSON.stringify({
              cantrips: selectedCantripSlots,
              knownSpells: nextKnownSpells,
              ...(wizardPreparedSpells ? { preparedSpells: wizardPreparedSpells } : {}),
            }))
          } else {
            const nextSpellsByLevel = groupSpellChoicesByLevel(cantripDraft, spellLevelByName)
            updateCharacter('spells', JSON.stringify({ cantrips: selectedCantripSlots, spells: nextSpellsByLevel }))
          }
          setCantripPanelOpen(false)
        }
        const spellSelectionLabel = spellcastingProgression.selectionKind === 'prepared'
          ? 'magias preparadas'
          : spellcastingProgression.selectionKind === 'spellbook' ? 'magias no grimório' : 'magias conhecidas'
        const spellSelectionDescription = className === 'paladino'
          ? `Prepare ${spellcastingProgression.selectionLimit} magias: modificador de Carisma (${getAbilityModifier('charisma') ?? '—'}) + metade do nível de paladino (${Math.floor(character.level / 2)}), arredondada para baixo (mínimo de uma).`
          : className === 'clerigo' || className === 'druida'
            ? `Prepare ${spellcastingProgression.selectionLimit} magias no total entre os níveis disponíveis.`
            : className === 'mago'
              ? `Seu grimório pode começar com ${spellcastingProgression.selectionLimit} magias conhecidas; o limite inicial considera seis magias no 1º nível e duas por nível adicional.`
              : `Escolha ${spellcastingProgression.selectionLimit} ${spellSelectionLabel} no total entre os níveis disponíveis.`
        const spellSlotSummary = spellcastingProgression.slots
          .map((count, index) => count > 0 ? `${index + 1}º nível: ${count}` : '')
          .filter(Boolean)
          .join(' · ')
        return <>
          <section className="wizard__section-card wizard__spell-info" aria-labelledby="wizard-title">
            <h1 id="wizard-title">Habilidade de Conjuração</h1>
            <div className="wizard__spell-stats">
              <div className="wizard__spell-stat">
                <strong>{spellcastingAbility ?? '—'}</strong>
                <span>Habilidade<br />de conjuração</span>
              </div>
              <div className="wizard__spell-stat">
                <strong>{spellSaveDc ?? '—'}</strong>
                <span>CD de resistência<br />de magia</span>
              </div>
              <div className="wizard__spell-stat">
                <strong>{spellAttackBonus === null ? '—' : `${spellAttackBonus >= 0 ? '+' : ''}${spellAttackBonus}`}</strong>
                <span>Bônus de ataque<br />de magia</span>
              </div>
            </div>
          </section>
          <section className="wizard__section-card wizard__cantrip-card" aria-labelledby="cantrip-selection-title">
            <div className="wizard__cantrip-heading">
              <h2 id="cantrip-selection-title">Truques conhecidos</h2>
              {hasCantripSelection && <span>{selectedCantrips.length} de {cantripCount} escolhidos</span>}
            </div>
            {hasCantripSelection ? <div {...fieldProps('cantrips')} tabIndex={-1} aria-label="Truques conhecidos" className="wizard__cantrip-selected wizard__spell-selection-slots" role="group">
              {selectedCantripSlots.map((name, index) => <button
                aria-label={name ? `Alterar truque ${name}` : 'Escolher truque'}
                className={name
                  ? 'wizard__cantrip-option wizard__cantrip-option--known wizard__known-spell-slot-button'
                  : 'wizard__known-spell-slot wizard__known-spell-slot--empty wizard__known-spell-slot-button'}
                key={`cantrip-${index}`}
                onClick={() => openSelectionPanel(0, index)}
                type="button"
              ><span className="wizard__spell-slot-label" title={name || undefined}>{name || 'Escolher truque'}</span></button>)}
            </div> : <p className="wizard__cantrip-empty">{cantripCount > 0 ? 'A lista de truques desta classe não está disponível.' : 'Esta classe não aprende truques por meio da progressão de classe.'}</p>}
            {feedback('cantrips')}
          </section>
          {canSelectLeveledSpells && <section className="wizard__section-card wizard__leveled-spell-card" aria-labelledby="known-spells-title">
            <div className="wizard__cantrip-heading">
              <h2 id="known-spells-title">{className === 'mago' ? 'Magias no grimório' : spellcastingProgression.selectionKind === 'prepared' ? 'Magias preparadas' : 'Magias conhecidas'}</h2>
              <span>{selectedLeveledSpellCount} de {spellcastingProgression.selectionLimit ?? currentKnownSpellCount} escolhidas</span>
            </div>
            <p className="wizard__spell-selection-rule">{spellSelectionDescription}</p>
            {spellSlotSummary && <p className="wizard__spell-selection-rule">Espaços de magia: {spellSlotSummary}</p>}
            {spellcastingProgression.pactSlotLevel > 1 && <p className="wizard__cantrip-empty">Magia de Pacto: os espaços são de {spellcastingProgression.pactSlotLevel}º nível e também podem conjurar magias de níveis inferiores.</p>}
            {feedback('spells')}
            {hasLearnedSpellProgression
              ? <div {...fieldProps('spells')} tabIndex={-1} aria-label={spellSelectionLabel} className="wizard__cantrip-selected wizard__spell-selection-slots" role="group">
                {selectedKnownSpellSlots.map((name, index) => {
                  const spellLabel = name && spellLevelByName[name] ? `${name} · ${spellLevelByName[name]}º nível` : name
                  return <button
                    aria-label={name ? `Alterar magia ${spellLabel}` : 'Escolher magia'}
                    className={name
                      ? 'wizard__cantrip-option wizard__cantrip-option--known wizard__known-spell-slot-button'
                      : 'wizard__known-spell-slot wizard__known-spell-slot--empty wizard__known-spell-slot-button'}
                    key={`known-spell-${index}`}
                    onClick={() => openSelectionPanel(character.level, index)}
                    type="button"
                  ><span className="wizard__spell-slot-label" title={spellLabel || undefined}>{spellLabel || 'Escolher magia'}</span></button>
                })}
              </div>
              : <>
                {selectedPreparedSpells.length
                  ? <div className="wizard__cantrip-selected">{selectedPreparedSpells.map(({ name, level }) => <span className="wizard__cantrip-option wizard__cantrip-option--known" key={`${level}-${name}`}>{name} · {level}º nível</span>)}</div>
                  : <p className="wizard__cantrip-empty">Nenhuma magia selecionada.</p>}
                <button className="wizard__cantrip-open" onClick={() => openSelectionPanel(maxSpellLevel)} type="button">
                  Selecionar magias <span aria-hidden="true" className="material-symbols-rounded">chevron_right</span>
                </button>
              </>}
          </section>}
          <Modal open={cantripPanelOpen} title="Selecionar magias" theme={theme} variant="drawer" showHeader={false} onClose={() => setCantripPanelOpen(false)}>
            <div className="wizard__cantrip-drawer-content">
              <header>
                <div>
                  <h2 id="cantrip-drawer-title">{selectionPanelLevel === 0
                    ? selectionPanelSlot === null ? 'Selecionar truques' : 'Escolha um truque'
                    : hasLearnedSpellProgression
                      ? selectionPanelSlot === null
                        ? `${spellSelectionLabel} — nível ${selectionPanelLevel} da classe`
                        : 'Escolha uma magia'
                      : 'Selecionar magias'}</h2>
                  <p>{selectionPanelLevel === 0
                    ? selectionPanelSlot === null
                      ? `Nível ${character.level} · Escolha ${cantripCount} truques (${cantripDraft.length}/${cantripCount})`
                      : `Nível ${character.level} · Truque ${selectionPanelSlot + 1} de ${cantripCount}`
                    : hasLearnedSpellProgression
                      ? `Nível de classe ${selectionPanelLevel} · ${spellSelectionLabel}: ${panelSelectionTotal}/${panelSelectionLimit}`
                      : `Nível ${character.level} · ${spellSelectionLabel}: ${panelSelectionTotal}/${spellcastingProgression.selectionLimit}`}</p>
                </div>
                <button aria-label="Fechar painel" className="wizard__cantrip-drawer-close" onClick={() => setCantripPanelOpen(false)} type="button">
                  <span aria-hidden="true" className="material-symbols-rounded">close</span>
                </button>
              </header>
              {selectionPanelLevel > 0 && availablePanelSpellLevels.length > 1 && <div aria-label="Filtrar magias por nível" className="wizard__spell-level-filters" role="group">
                <button aria-pressed={spellLevelFilter === null} className={spellLevelFilter === null ? 'wizard__spell-level-chip wizard__spell-level-chip--active' : 'wizard__spell-level-chip'} onClick={() => setSpellLevelFilter(null)} type="button">Todos</button>
                {availablePanelSpellLevels.map((level) => <button
                  aria-pressed={spellLevelFilter === level}
                  className={spellLevelFilter === level ? 'wizard__spell-level-chip wizard__spell-level-chip--active' : 'wizard__spell-level-chip'}
                  key={level}
                  onClick={() => setSpellLevelFilter(level)}
                  type="button"
                >{level}º nível</button>)}
              </div>}
              <label className="wizard__spell-search">
                <span aria-hidden="true" className="material-symbols-rounded">search</span>
                <input aria-label="Pesquisar magias" onChange={(event) => setSpellListSearch(event.target.value)} placeholder="Pesquisar magias" type="search" value={spellListSearch} />
              </label>
              <div
                aria-label={selectionPanelLevel === 0 ? selectionPanelSlot === null ? 'Truques disponíveis' : 'Escolha um truque' : selectionPanelSlot === null ? 'Magias disponíveis' : 'Escolha uma magia'}
                className="wizard__cantrip-drawer-options"
                role={selectionPanelSlot !== null || panelSelectionLimit === 1 ? 'radiogroup' : 'group'}
              >
                {filteredPanelOptions.length === 0
                  ? <p className="wizard__spell-search-empty">Nenhuma magia encontrada.</p>
                  : filteredPanelOptions.map((name) => {
                  const selected = cantripDraft.includes(name)
                  const spellDetails = getSpellDetails(name)
                  const singleSpellChoice = selectionPanelSlot !== null || panelSelectionLimit === 1
                  const alreadyInAnotherSlot = selectionPanelSlot !== null && (selectionPanelLevel === 0
                    ? selectedCantripSlots.some((spell, index) => index !== selectionPanelSlot && spell === name)
                    : hasLearnedSpellProgression && selectedKnownSpellSlots.some((spell, index) => index !== selectionPanelSlot && spell === name))
                  const spellLevel = selectionPanelLevel > 0
                    ? Object.entries(availableLeveledSpells).find(([, spells]) => spells.includes(name))?.[0]
                    : undefined
                  const exceedsProgressionLimit = selectionPanelSlot !== null && spellLevel !== undefined && !canSelectSpellAtSlot(
                    selectedKnownSpellSlots.map((spell) => spellLevelByName[spell] ?? 0),
                    selectionPanelSlot,
                    Number(spellLevel),
                    (level) => getMaximumSpellCountAtOrAboveLevel(className, character.classSubclassId, character.level, level),
                    panelSpellLevelLimit,
                  )
                  return <label
                    className="wizard__cantrip-drawer-option"
                    key={name}
                  >
                    <input
                      checked={selected}
                      disabled={alreadyInAnotherSlot || exceedsProgressionLimit || (!singleSpellChoice && !selected && panelSelectionTotal >= panelSelectionLimit)}
                      onChange={() => togglePanelSelection(name)}
                      name={singleSpellChoice ? 'spell-selection' : undefined}
                      type={singleSpellChoice ? 'radio' : 'checkbox'}
                    />
                    <span className="wizard__spell-option-details">
                      <strong>{name}{spellLevel ? ` · ${spellLevel}º nível` : ''}</strong>
                      {spellDetails && <small>Conjuração: {spellDetails.castingTime} · Alcance: {spellDetails.range}</small>}
                      {spellDetails && <small>Componentes: {spellDetails.components} · Duração: {spellDetails.duration}</small>}
                    </span>
                  </label>
                })}
              </div>
              <footer>
                <Button onClick={() => setCantripPanelOpen(false)} type="button" variant="secondary">Cancelar</Button>
                <Button onClick={confirmSelection} type="button">Confirmar seleção</Button>
              </footer>
            </div>
          </Modal>
        </>
      }
      case 6: {
        const background = getBackgroundRulesFor()
        const isBard = normalizeTerm(selectedName(classes, character.characterClassId)) === 'bardo'
        const isFighter = normalizeTerm(selectedName(classes, character.characterClassId)) === 'guerreiro'
        const isRogue = normalizeTerm(selectedName(classes, character.characterClassId)) === 'ladino'
        const isWizard = normalizeTerm(selectedName(classes, character.characterClassId)) === 'mago'
        const isSorcerer = normalizeTerm(selectedName(classes, character.characterClassId)) === 'feiticeiro'
        const bardFeatureSelections = Object.entries(character.classFeatureChoices)
          .filter(([key]) => key.startsWith(`${character.characterClassId}:${character.classSubclassId}:`))
        const bardAdditionalSkills = isBard
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':lore-additional-skills')).flatMap(([, choices]) => choices)
          : []
        const bardExpertiseSkills = isBard
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':bard-expertise')).flatMap(([, choices]) => choices)
          : []
        const rogueExpertiseIds = isRogue
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':rogue-expertise')).flatMap(([, choices]) => choices)
          : []
        const rogueExpertiseOptions = classFeatures.ladino.features.flatMap((feature) => feature.choices ?? [])
          .find((choice) => choice.id === 'rogue-expertise')?.options ?? []
        const rogueExpertiseNames = rogueExpertiseIds.map((id) => rogueExpertiseOptions.find((option) => option.id === id)?.name).filter((name): name is string => Boolean(name))
        const isCleric = normalizeTerm(selectedName(classes, character.characterClassId)) === 'clerigo'
        const clericKnowledgeSkills = isCleric && character.classSubclassId === 'dominio-do-conhecimento'
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':knowledge-skills')).flatMap(([, choices]) => choices)
          : []
        const clericNatureSkills = isCleric && character.classSubclassId === 'dominio-da-natureza'
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':nature-skill')).flatMap(([, choices]) => choices)
          : []
        const clericKnowledgeLanguages = isCleric && character.classSubclassId === 'dominio-do-conhecimento'
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':knowledge-languages')).flatMap(([, choices]) => choices)
          : []
        const sorcererMetamagics = isSorcerer
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':sorcerer-metamagic')).flatMap(([, choices]) => choices)
          : []
        const sorcererMetamagicNames = new Map(classFeatures.feiticeiro.features.flatMap((feature) =>
          feature.choices?.filter((choice) => choice.id === 'sorcerer-metamagic').flatMap((choice) => choice.options.map((option) => [option.id, option.name] as const)) ?? [],
        ))
        const battleMasterToolIds = isFighter && character.classSubclassId === 'mestre-de-batalha'
          ? bardFeatureSelections.filter(([key]) => key.endsWith(':battle-master-tool')).flatMap(([, choices]) => choices)
          : []
        const battleMasterToolOptions = classFeatures.guerreiro.subclasses.find((subclass) => subclass.id === 'mestre-de-batalha')?.features
          .flatMap((feature) => feature.choices ?? []).find((choice) => choice.id === 'battle-master-tool')?.options ?? []
        const battleMasterToolNames = battleMasterToolIds.map((id) => battleMasterToolOptions.find((option) => option.id === id)?.name).filter((name): name is string => Boolean(name))
        const clericDomainArmor = ['dominio-da-guerra', 'dominio-da-natureza', 'dominio-da-tempestade', 'dominio-da-vida'].includes(character.classSubclassId)
        const clericDomainMartial = ['dominio-da-guerra', 'dominio-da-tempestade'].includes(character.classSubclassId)
        const reviewLanguages = [
          ...getRaceLanguageRulesFor().fixed,
          ...classLanguages,
          ...character.raceLanguageChoices,
          ...character.backgroundLanguageChoices,
          ...clericKnowledgeLanguages,
        ]
        const reviewSkills = [...new Set([...(background?.skills ?? []), ...(character.backgroundSkillChoices ?? []), ...raceSkills, ...character.skillProficiencies, ...bardAdditionalSkills, ...clericKnowledgeSkills, ...clericNatureSkills])]
        const reviewInventory = readInventory(character.equipment, equipmentCatalog ?? undefined)
        const reviewTools = [
          ...(background?.tools ?? []),
          ...(classProficiencies[normalizeTerm(selectedName(classes, character.characterClassId))]?.tools ?? []),
          ...battleMasterToolNames,
          ...(isRogue && character.classSubclassId === 'assassino' ? ['Kit de disfarce', 'Kit de venenos'] : []),
          ...(character.bardInstrumentChoices ?? []),
          ...(character.toolProficiencyChoices ?? []),
          ...(background?.merchantAlternative && character.merchantAlternative === 'navigator-tools' ? ['Ferramentas de navegador'] : []),
        ]
        return (
          <dl className="wizard__review">
            <div><dt>Nome</dt><dd>{character.name || 'Não definido'}</dd></div>
            <div><dt>Nível</dt><dd>{character.level}</dd></div>
            <div><dt>XP</dt><dd>{Number(character.experiencePoints).toLocaleString('pt-BR')}</dd></div>
            <div><dt>PV máximos</dt><dd>{maxHp || 'Não definidos'}</dd></div>
            <div><dt>Bônus de proficiência</dt><dd>+{2 + Math.floor((character.level - 1) / 4)}</dd></div>
            <div><dt>Raça</dt><dd>{selectedName(races, character.raceId)}</dd></div>
            <div><dt>Classe</dt><dd>{selectedName(classes, character.characterClassId)}</dd></div>
            {character.classSubclassId && <div><dt>Subclasse</dt><dd>{classFeatures[normalizeTerm(selectedName(classes, character.characterClassId))]?.subclasses.find((subclass) => subclass.id === character.classSubclassId)?.name ?? 'Não definida'}</dd></div>}
            {normalizeTerm(selectedName(classes, character.characterClassId)) === 'barbaro' && <div><dt>Caminho Primitivo</dt><dd>{character.primalPath === 'berserker' ? 'Caminho do Furioso' : character.primalPath === 'totem-warrior' ? 'Caminho do Guerreiro Totêmico' : 'Não definido'}</dd></div>}
            <div><dt>Antecedente</dt><dd>{selectedName(backgrounds, character.backgroundId)}</dd></div>
            <div><dt>Testes de resistência</dt><dd>{classProficiencies[normalizeTerm(selectedName(classes, character.characterClassId))]?.saves.join(', ') ?? 'Não definidos'}</dd></div>
            <div><dt>Perícias</dt><dd>{reviewSkills.join(', ') || 'Não definidas'}</dd></div>
            {(isBard || clericKnowledgeSkills.length > 0) && <div><dt>Aptidão</dt><dd>{[...bardExpertiseSkills, ...clericKnowledgeSkills].join(', ') || 'Não definida'}</dd></div>}
            {isSorcerer && <>
              <div><dt>Proficiências com equipamentos</dt><dd>Sem armaduras; adagas, dardos, fundas, bordões e bestas leves</dd></div>
              {character.level >= 2 && <div><dt>Pontos de feitiçaria</dt><dd>{character.level}</dd></div>}
              {character.level >= 3 && <div><dt>Metamágica</dt><dd>{sorcererMetamagics.map((id) => sorcererMetamagicNames.get(id) ?? id).join(', ') || 'Não escolhida'}</dd></div>}
            </>}
            {isFighter && <div><dt>Proficiências com equipamentos</dt><dd>Todas as armaduras e escudos; armas simples e marciais</dd></div>}
            {isRogue && <>
              <div><dt>Proficiências com equipamentos</dt><dd>Armaduras leves; armas simples, bestas de mão, espadas longas, rapieiras e espadas curtas</dd></div>
              <div><dt>Especialização</dt><dd>{rogueExpertiseNames.join(', ') || 'Não escolhida'}</dd></div>
            </>}
            {isWizard && <div><dt>Proficiências com equipamentos</dt><dd>Sem armaduras; adagas, dardos, fundas, bordões e bestas leves</dd></div>}
            {isCleric && <div><dt>Proficiências com equipamentos</dt><dd>Armaduras leves, armaduras médias, escudos{clericDomainArmor ? ', armaduras pesadas' : ''}; armas simples{clericDomainMartial ? ', armas marciais' : ''}</dd></div>}
            {normalizeTerm(selectedName(classes, character.characterClassId)) === 'druida' && <div><dt>Proficiências com equipamentos</dt><dd>Armaduras leves, armaduras médias, escudos; clavas, adagas, dardos, azagaias, maças, bordões, cimitarras, foices, fundas e lanças</dd></div>}
            <div><dt>Idiomas</dt><dd>{[...new Set(reviewLanguages)].join(', ') || 'Não definidos'}</dd></div>
            <div><dt>Ferramentas</dt><dd>{[...new Set(reviewTools)].join(', ') || 'Não definidas'}</dd></div>
            <div><dt>Inventário</dt><dd>{reviewInventory.entries.map(entry => `${entry.quantity} × ${entry.name}`).join('; ') || 'Vazio'}</dd></div>
            <div><dt>Moedas</dt><dd>{reviewInventory.currencyCp} pc</dd></div>
            {reviewInventory.legacyNotes && <div><dt>Anotações do inventário</dt><dd>{reviewInventory.legacyNotes}</dd></div>}
          </dl>
        )
      }
      default:
        return null
    }
  }

  function renderClassFeaturesStep() {
    const selectedClass = classes.find((item) => item.id === character.characterClassId)
    const normalizedClassName = normalizeTerm(selectedClass?.name ?? '')
    const featureData = classFeatures[normalizedClassName]

    if (normalizedClassName !== 'barbaro') {
      return selectedClass && featureData
        ? renderOtherClassFeaturesStep(selectedClass, featureData)
        : <p className="wizard__notice">Selecione uma classe para ver suas características.</p>
    }

    const rageUses = character.level === 20
      ? 'Ilimitados'
      : [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6][character.level - 1]
    const rageDamage = character.level >= 16 ? 4 : character.level >= 9 ? 3 : 2
    const pathOptions: { id: Exclude<PrimalPath, ''>; name: string; description: string }[] = [
      { id: 'berserker', name: 'Caminho do Furioso', description: 'Concede Frenesi, Fúria Inconsciente, Presença Intimidante e Retaliação.' },
      { id: 'totem-warrior', name: 'Caminho do Guerreiro Totêmico', description: 'Concede magias rituais e escolhas de Totem Espiritual, Aspecto da Besta e Sintonia Totêmica.' },
    ]
    const selectedPathName = character.primalPath === 'berserker'
      ? 'Caminho do Furioso'
      : character.primalPath === 'totem-warrior' ? 'Caminho do Guerreiro Totêmico' : ''
    const selectedPathFeatures = character.primalPath ? barbarianPathFeatures[character.primalPath] : []
    const getLevelFeatures = (level: number) => {
      const pathFeaturesAtLevel = selectedPathFeatures.filter((feature) => feature.level === level)
      const classFeaturesAtLevel = barbarianFeatures.filter((feature) =>
        feature.level === level && !(pathFeaturesAtLevel.length > 0 && feature.name === 'Característica de Caminho Primitivo'),
      )
      return [
        ...classFeaturesAtLevel.map((feature) => ({ ...feature, isPathFeature: false as const, choice: undefined })),
        ...pathFeaturesAtLevel.map((feature) => ({ ...feature, isPathFeature: true as const })),
      ]
    }
    const getFeatureLabel = (feature: ReturnType<typeof getLevelFeatures>[number]) => {
      const selectedAnimal = feature.choice
        ? feature.choice.options.find((option) => option.id === character.primalTotemChoices[feature.choice!.key])?.name
        : undefined
      return `${feature.name}${selectedAnimal ? ` (${selectedAnimal})` : ''}${feature.isPathFeature ? ` · ${selectedPathName}` : ''}`
    }

    return (
      <section aria-label={`Características de classe: ${selectedClass?.name}`} className="wizard__class-features">
        <section className="wizard__section-card wizard__barbarian-progression" aria-label="Progressão do Bárbaro">
          {renderStepHeading()}
          <div className="wizard__barbarian-table-wrap" role="region" tabIndex={0}>
            <table className="wizard__barbarian-table">
              <thead>
                <tr>
                  <th scope="col">Nível</th>
                  <th scope="col">Bônus de proficiência</th>
                  <th scope="col">Características</th>
                  <th scope="col">Fúrias</th>
                  <th scope="col">Dano de Fúria</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
                  const rageCount = level === 20
                    ? 'Ilimitado'
                    : [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6][level - 1]
                  const features = getLevelFeatures(level)
                  return (
                    <tr aria-current={level === character.level ? 'true' : undefined} className={level === character.level ? 'wizard__barbarian-table-current' : undefined} key={level}>
                      <th scope="row">{level}º</th>
                      <td>+{2 + Math.floor((level - 1) / 4)}</td>
                      <td>
                        {features.map((feature, index) => {
                          const featureId = `barbarian-feature-${level}-${index}`
                          return (
                            <span key={featureId}>
                              {index > 0 && ', '}
                              <button
                                aria-controls={featureId}
                                className="wizard__barbarian-table-feature-link"
                                onClick={() => {
                                  const target = document.getElementById(featureId)
                                  if (target) scrollToClassFeature(target)
                                }}
                                type="button"
                              >
                                {getFeatureLabel(feature)}
                              </button>
                            </span>
                          )
                        })}
                      </td>
                      <td>{rageCount}</td>
                      <td>+{level >= 16 ? 4 : level >= 9 ? 3 : 2}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        <div className="wizard__class-feature-list">
          {Array.from({ length: showHigherClassLevels ? 20 : character.level }, (_, index) => index + 1).map((level) => {
            const isUnlocked = level <= character.level
            const levelFeatures = getLevelFeatures(level)

            return (
              <section aria-disabled={!isUnlocked} className="wizard__section-card wizard__class-level-row" key={level}>
                <header className="wizard__class-level-heading">
                  <h3>Nível {level}</h3>
                </header>
                <div className="wizard__class-level-features">
                  {levelFeatures.map((feature, index) => {
                    const choice = feature.choice
                    return (
                      <article className={`wizard__class-feature${feature.isPathFeature ? ' wizard__class-feature--path' : ''}${choice ? ' wizard__class-feature--choice' : ''}`} id={`barbarian-feature-${level}-${index}`} key={`${feature.isPathFeature ? 'path-' : ''}${feature.level}-${feature.name}`} tabIndex={-1}>
                        <div className="wizard__class-feature-heading">
                          <h4>
                            {feature.name}
                            {feature.isPathFeature && <span className="wizard__class-feature-path-reference"> · {selectedPathName}</span>}
                          </h4>
                        </div>
                        <p>{feature.description}</p>
                        {normalizeTerm(feature.name) === 'incremento no valor de habilidade' && (() => {
                          const key = classAbilityScoreIncreaseKey(character.characterClassId, feature.level)
                          const featKey = classAbilityScoreIncreaseFeatKey(key)
                          const selected = character.classFeatureChoices[key] ?? []
                          const mode = character.classFeatureChoices[classAbilityScoreIncreaseModeKey(key)]?.[0] ?? (selected.length ? 'ability' : '')
                          const selectedFeatId = character.classFeatureChoices[classAbilityScoreIncreaseFeatKey(key)]?.[0] ?? ''
                          const feat = feats.find((item) => item.id === selectedFeatId)
                          const featAbility = feat?.abilityBonus && 'ability' in feat.abilityBonus ? feat.abilityBonus.ability : ''
                          const confirmed = character.abilityScoreIncreases?.classId === character.characterClassId
                            && JSON.stringify(character.abilityScoreIncreases.selections[key]) === JSON.stringify(selected)
                          const amount = selected.length === 1 ? 2 : 1
                          const canConfirm = abilityScoresAreValid() && (selected.length === 2
                            ? selected.every((ability) => Boolean(character.abilities[ability]) && Number(character.abilities[ability]) < 20)
                            : selected.length === 1 && Boolean(character.abilities[selected[0]]) && Number(character.abilities[selected[0]]) <= 18)
                          return <div className="wizard__asi-choice">
                            <div className="wizard__asi-mode">
                              <strong>Escolha como usar este incremento</strong>
                              <div aria-label="Escolha como usar este incremento" className="wizard__asi-mode-options" role="radiogroup">
                                <button aria-pressed={mode === 'ability'} className="wizard__method-option wizard__asi-mode-option" disabled={!isUnlocked} onClick={() => selectClassAbilityIncreaseMode(key, 'ability')} type="button">
                                  <span aria-hidden="true" className="wizard__method-radio" /><strong>Incremento no valor de habilidade</strong>
                                </button>
                                <button aria-pressed={mode === 'feat'} className="wizard__method-option wizard__asi-mode-option" disabled={!isUnlocked} onClick={() => { selectClassAbilityIncreaseMode(key, 'feat'); openFeatSelection(feature.level, selectedFeatId) }} type="button">
                                  <span aria-hidden="true" className="wizard__method-radio" /><strong>Escolher um talento</strong>
                                </button>
                              </div>
                            </div>
                            {mode === 'ability' && <>
                              <div {...fieldProps(`classFeatureChoices.${key}`)} aria-label="Habilidades para incremento" className="wizard__skill-options" role="group">
                                {abilityLabels.map(([ability, label]) => {
                                  const isSelected = selected.includes(ability)
                                  const value = Number(character.abilities[ability])
                                  const disabled = !isSelected && (selected.length >= 2 || !character.abilities[ability] || !Number.isInteger(value) || value < 1 || value >= 20)
                                  return <button aria-pressed={isSelected} className="wizard__skill-option wizard__skill-option--detailed" disabled={!isUnlocked || disabled} key={ability} onClick={() => toggleClassAbilityIncrease(key, ability)} type="button">
                                    <span aria-hidden="true" className="wizard__selection-dot wizard__selection-dot--checkbox" /><span className="wizard__skill-ability">{label}</span><span>{isSelected && !confirmed ? `${value} → ${value + amount}` : character.abilities[ability] || '—'}</span>
                                  </button>
                                })}
                              </div>
                              <Button disabled={!isUnlocked || !canConfirm || confirmed} onClick={() => confirmClassAbilityIncrease(key)} type="button">{confirmed ? 'Incremento confirmado' : 'Confirmar incremento'}</Button>
                            </>}
                            {mode === 'feat' && <div className="wizard__asi-feat-selected">
                              {feat ? <><strong>{feat.name}</strong><span>{feat.description}</span></> : <span>Selecione um talento no painel para continuar.</span>}
                              {feat?.abilityBonus && ('chooseFrom' in feat.abilityBonus
                                ? <div className="wizard__feat-ability-choice" aria-label={`Escolha uma habilidade para ${feat.name}`}>
                                  <span>Escolha uma habilidade para receber +1:</span>
                                  <div className="wizard__skill-options" role="group">
                                    {feat.abilityBonus.chooseFrom.map((ability) => {
                                      const label = abilityLabels.find(([id]) => id === ability)?.[1] ?? ability
                                      const increase = character.featAbilityIncreases?.[featKey]
                                      const active = increase?.ability === ability
                                      return <button aria-pressed={active} className="wizard__skill-option" key={ability} onClick={() => selectFeatAbilityIncrease(key, ability)} type="button">
                                        <span aria-hidden="true" className="wizard__method-radio" />{label}{active ? ` · ${character.abilities[ability]}${increase.amount ? ' (+1 aplicado)' : ' (máximo 20)'}` : ''}
                                      </button>
                                    })}
                                  </div>
                                </div>
                                : <span>{abilityLabels.find(([id]) => id === featAbility)?.[1]}: {character.abilities[featAbility] || '—'}{character.featAbilityIncreases?.[featKey]?.amount ? ' (+1 aplicado)' : ' (máximo 20)'}</span>)}
                              <Button disabled={!isUnlocked} onClick={() => openFeatSelection(feature.level, selectedFeatId)} type="button" variant="secondary">{feat ? 'Alterar talento' : 'Selecionar talento'}</Button>
                            </div>}
                            {feedback(`classFeatureChoices.${key}`)}
                          </div>
                        })()}
                        {feature.name === 'Fúria' && (
                          <p className="wizard__class-feature-detail">No seu nível: {rageUses} usos por descanso longo · dano de fúria +{rageDamage}.</p>
                        )}
                        {feature.name === 'Caminho Primitivo' && (
                          <fieldset {...fieldProps('primalPath')} aria-label="Caminho Primitivo" aria-required={isUnlocked} className="wizard__class-path wizard__class-path--paths" disabled={!isUnlocked} tabIndex={-1}>
                            {feedback('primalPath')}
                            <div className="wizard__class-path-options">
                              {pathOptions.map((option) => (
                                <button
                                  aria-pressed={character.primalPath === option.id}
                                  className="wizard__class-path-option"
                                  key={option.id}
                                  onClick={() => setCharacter((current) => ({ ...current, primalPath: option.id }))}
                                  type="button"
                                >
                                  <span aria-hidden="true" className="wizard__method-radio" />
                                  <strong>{option.name}</strong>
                                  <span>{option.description}</span>
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}
                        {choice && (
                          <fieldset {...fieldProps(`primalTotemChoices.${choice.key}`)} aria-label={choice.prompt} className="wizard__class-path" disabled={!isUnlocked}>
                            {choice.key !== 'spiritualTotem' && <legend>{choice.prompt} {requiredMark}</legend>}
                            {feedback(`primalTotemChoices.${choice.key}`)}
                            <div className="wizard__class-path-options">
                              {choice.options.map((option) => (
                                <button
                                  aria-pressed={character.primalTotemChoices[choice.key] === option.id}
                                  className="wizard__class-path-option"
                                  key={option.id}
                                  onClick={() => setCharacter((current) => ({
                                    ...current,
                                    primalTotemChoices: { ...current.primalTotemChoices, [choice.key]: option.id },
                                  }))}
                                  type="button"
                                >
                                  <span aria-hidden="true" className="wizard__method-radio" />
                                  <strong>{option.name}</strong>
                                  <span>{option.description}</span>
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
          {!showHigherClassLevels && character.level < 20 && <Button className="wizard__higher-levels-trigger" variant="secondary" type="button" onClick={() => setShowHigherClassLevels(true)}>Ver habilidades acima do nível {character.level}</Button>}
        </div>
        <Modal open={featPanelOpen} title="Selecionar talento" theme={theme} variant="drawer" showHeader={false} onClose={() => setFeatPanelOpen(false)}>
          <div className="wizard__cantrip-drawer-content">
            <header><div><h2 id="feat-drawer-title">Selecionar talento</h2><p>Nível {featPanelLevel} · Escolha um talento que atenda aos pré-requisitos.</p></div>
              <button aria-label="Fechar painel" className="wizard__cantrip-drawer-close" onClick={() => setFeatPanelOpen(false)} type="button"><span aria-hidden="true" className="material-symbols-rounded">close</span></button></header>
            <div aria-label="Talentos disponíveis" className="wizard__cantrip-drawer-options" role="radiogroup">
              {feats.map((feat) => {
                const prerequisiteFailure = getFeatPrerequisiteFailure(feat, character.abilities, canCastFeats, featArmorProficiencies)
                const key = classAbilityScoreIncreaseKey(character.characterClassId, featPanelLevel)
                const repeated = Object.entries(character.classFeatureChoices).filter(([choiceKey]) => choiceKey.startsWith('ability-score-increase:') && choiceKey.endsWith(':feat') && choiceKey !== classAbilityScoreIncreaseFeatKey(key)).some(([, selected]) => selected[0] === feat.id)
                const failure = prerequisiteFailure || (repeated && !feat.repeatable ? 'Este talento só pode ser escolhido uma vez.' : '')
                return <label className="wizard__cantrip-drawer-option wizard__feat-option" key={feat.id} title={failure || undefined}>
                  <input checked={featDraft === feat.id} disabled={Boolean(failure)} name="feat-selection" onChange={() => setFeatDraft(feat.id)} type="radio" />
                  <span className="wizard__spell-option-details">
                    <span className="wizard__feat-heading"><strong>{feat.name}{feat.repeatable ? ' · Repetível' : ''}</strong><span className="wizard__feat-prerequisite">Pré-requisito: {feat.prerequisite}.</span></span>
                    <span className="wizard__feat-description">{feat.description}</span>
                  </span>
                </label>
              })}
            </div>
            <footer><Button onClick={() => setFeatPanelOpen(false)} type="button" variant="secondary">Cancelar</Button>
              <Button disabled={!featDraft || Boolean(feats.find((item) => item.id === featDraft && getFeatPrerequisiteFailure(item, character.abilities, canCastFeats, featArmorProficiencies)))} onClick={confirmFeatSelection} type="button">Confirmar talento</Button></footer>
          </div>
        </Modal>
      </section>
    )
  }

  function getEquipmentContext(): EquipmentContext {
    const background = getBackgroundRulesFor()
    const selectedToolChoice = character.toolProficiencyChoices[0]
    const equipment = [
      ...(background?.equipment ?? []),
    ].map((item) => item
      .replace('Instrumento musical do tipo escolhido', selectedToolChoice ?? 'Instrumento musical escolhido')
      .replace('Ferramentas de artesão do tipo escolhido', selectedToolChoice ?? 'ferramentas de artesão escolhidas'))
    return {
      className: classes.find(item => item.id === character.characterClassId)?.name ?? '',
      backgroundName: backgrounds.find(item => item.id === character.backgroundId)?.name ?? '',
      backgroundEquipment: equipment,
      backgroundEquipmentChoice: background?.equipmentChoice ? {
        ...background.equipmentChoice,
        selectedOptionId: character.backgroundEquipmentChoice || undefined,
      } : undefined,
      character,
      proficientWithWarhammer: raceName === 'anao' || ['dominio-da-tempestade', 'dominio-da-guerra'].includes(character.classSubclassId),
      proficientWithHeavyArmor: ['dominio-da-vida', 'dominio-da-natureza', 'dominio-da-tempestade', 'dominio-da-guerra'].includes(character.classSubclassId),
    }
  }

  function renderEquipmentStep() {
    const context = getEquipmentContext()
    return (
      <EquipmentEditor value={character.equipment} onChange={value => updateCharacter('equipment', value)} onRequestInitialEquipmentReset={(change) => {
        if (readInventory(character.equipment, equipmentCatalog ?? undefined).initialEquipmentConfirmed) setEquipmentResetAction(() => change)
        else change()
      }} context={context} heading={null} catalog={equipmentCatalog} loading={equipmentLoading} error={equipmentError} onRetry={retryEquipmentCatalog} theme={theme}>
        {feedback('equipment')}
      </EquipmentEditor>
    )
  }

  const racialBonusPreview = abilityLabels.flatMap(([key, label]) => {
    const bonus = getRacialAbilityBonuses()[key] ?? 0
    if (bonus <= 0) return []
    const before = Number(character.abilities[key])
    return [{ label, before, after: before + bonus, bonus }]
  })

  return (
    <main className="creation-page">
      <img aria-hidden="true" className="creation-mascot" src="/images/creation-mascot.png" alt="" />
      <AppSidebar theme={theme} onToggleTheme={onToggleTheme} onSelect={(section) => {
        void persistDraftNow().then(() => callbacks.current.onSidebarSelect(section)).catch(() => undefined)
      }} />

      {createPortal(<nav
        aria-label="Navegação das etapas"
        className="wizard__mobile-navigation"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMobileStepsOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setMobileStepsOpen(false)
        }}
      >
        <div
          aria-label={`Etapa ${displayedStepIndex + 1} de ${visibleSteps.length}`}
          aria-valuemax={visibleSteps.length}
          aria-valuemin={1}
          aria-valuenow={displayedStepIndex + 1}
          className="wizard__mobile-progress"
          role="progressbar"
        >
          <span style={{ width: `${((displayedStepIndex + 1) / visibleSteps.length) * 100}%` }} />
        </div>
        <div className="wizard__mobile-navigation-header">
          <button
            aria-label="Etapa anterior"
            className="wizard__mobile-navigation-arrow wizard__mobile-navigation-back"
            disabled={activeStep === 0 || completing || portraitUploading}
            onClick={() => void navigateTo(activeStep - 1)}
            type="button"
          >
            <span aria-hidden="true" className="material-symbols-rounded">chevron_left</span>
            <span>Voltar</span>
          </button>
          <div className="wizard__mobile-navigation-current">
            <button
              aria-controls="wizard-mobile-step-list"
              aria-expanded={mobileStepsOpen}
              className="wizard__mobile-navigation-title"
              onClick={() => setMobileStepsOpen((open) => !open)}
              type="button"
            >
              <span aria-hidden="true" className="wizard__mobile-navigation-step-number">{activeStep + 1}</span>
              {steps[activeStep]}
              <span aria-hidden="true" className="material-symbols-rounded">expand_more</span>
            </button>
            {mobileStepsOpen && <div aria-label="Etapas disponíveis" className="wizard__mobile-step-list" id="wizard-mobile-step-list" role="group">
              {visibleSteps.map(({ label: step, index }) => (
                <button
                  aria-current={index === activeStep ? 'step' : undefined}
                  className={index === activeStep
                    ? 'wizard__mobile-step wizard__mobile-step--active'
                    : stepIsComplete(index)
                      ? 'wizard__mobile-step wizard__mobile-step--completed'
                      : 'wizard__mobile-step'}
                  key={step}
                  onClick={() => {
                    setMobileStepsOpen(false)
                    void navigateTo(index)
                  }}
                  type="button"
                >
                  <span aria-hidden="true">{stepIsComplete(index) ? '✓' : index + 1}</span>
                  {step}
                </button>
              ))}
            </div>}
          </div>
          <button
            aria-label={isFinalStep ? 'Salvar personagem' : 'Continuar'}
            className="wizard__mobile-navigation-arrow wizard__mobile-navigation-next"
            disabled={completing || portraitUploading}
            onClick={() => void navigateTo(activeStep + 1)}
            type="button"
          >
            <span>{isFinalStep ? 'Salvar' : 'Continuar'}</span>
            <span aria-hidden="true" className="material-symbols-rounded">chevron_right</span>
          </button>
        </div>
      </nav>, document.body)}

      <div className="creation-shell">
        <aside className="wizard__steps" aria-label="Etapas de criação">
          {visibleSteps.map(({ label: step, index }) => (
            <button
              className={index === activeStep
                ? 'wizard__step wizard__step--active'
                : stepIsComplete(index)
                  ? 'wizard__step wizard__step--completed'
                  : 'wizard__step'}
              aria-current={index === activeStep ? 'step' : undefined}
              aria-label={step}
              key={step}
              onClick={() => void navigateTo(index)}
              type="button"
            >
              <span>{stepIsComplete(index) ? '✓' : index + 1}</span>
              {step}
            </button>
          ))}
        </aside>

        <div className="wizard-layout">
          {activeStep !== 0 && <aside className="wizard__character-summary" aria-label="Resumo do personagem">
            <div className="wizard__summary-identity">
              <span className="wizard__summary-portrait">
                {character.portraitUrl ? <img src={character.portraitUrl} alt="" /> : <span aria-hidden="true" className="material-symbols-rounded">person</span>}
              </span>
              <div className="wizard__summary-name">
                {character.name && <strong>{character.name}</strong>}
                <small>{[
                  `Nível ${character.level}`,
                  selectedName(races, character.raceId),
                  selectedName(backgrounds, character.backgroundId),
                  selectedName(classes, character.characterClassId),
                ].filter(Boolean).join(' · ')}</small>
              </div>
            </div>
            <div className="wizard__summary-abilities" aria-label="Valores de habilidade">
              {abilityLabels.filter(([key]) => character.abilities[key]).map(([key, label]) => <div className="wizard__summary-ability" key={key} aria-label={`${label}: ${character.abilities[key]}`}>
                <AbilityScoreSummaryFrame />
                <small>{abilityShortLabels[key]}</small><strong>{character.abilities[key]}</strong>
              </div>)}
            </div>
            <div className="wizard__summary-derived">
              {(() => { const dexterity = getAbilityModifier('dexterity'); return dexterity === null ? null : <div className="wizard__summary-armor-class"><ArmorClassSummaryFrame /><small>CA</small><strong>{10 + dexterity}</strong></div> })()}
              {maxHp && <div className="wizard__summary-hit-points"><HitPointsSummaryHeart /><small>PV</small><strong>{maxHp}</strong></div>}
            </div>
          </aside>}
          <section className={`wizard${activeStep === 2 || activeStep === 3 || activeStep === 4 || activeStep === 5 ? ' wizard--separate-cards' : ''}${activeStep === 5 ? ' wizard--spell-step' : ''}`} aria-label={activeStep === 4 ? 'Criação de personagem' : undefined} aria-labelledby={activeStep === 4 ? undefined : 'wizard-title'}>
            {activeStep !== 2 && activeStep !== 3 && activeStep !== 4 && activeStep !== 5 && renderStepHeading()}
            {renderStepContent()}
          </section>
          <footer className="wizard__actions">
            <div className="wizard__actions-inner">
              <Button disabled={activeStep === 0 || completing || portraitUploading} onClick={() => void navigateTo(activeStep - 1)} variant="secondary">
                Voltar
              </Button>
              <Button disabled={completing || portraitUploading} onClick={() => void navigateTo(activeStep + 1)}>
                {completing ? 'Salvando…' : isFinalStep ? 'Salvar personagem' : 'Continuar'}
              </Button>
            </div>
          </footer>

        </div>
      </div>
      <Modal open={Boolean(portraitCropSource)} title="Ajustar foto de perfil" theme={theme} variant="crop" showHeader={false} onClose={closePortraitCropper}>
        <div className="wizard__portrait-dialog">
        <h2 id="portrait-crop-title">Ajustar foto de perfil</h2>
        <p id="portrait-crop-description">Arraste a imagem para posicioná-la e use o controle de zoom para ajustar o recorte quadrado.</p>
        {portraitCropError && <p className="wizard__field-error" role="alert">{portraitCropError}</p>}
        {portraitCropSource && <Cropper
          alt="Imagem para recortar como foto de perfil"
          aspectRatio={1}
          autoCropArea={0.9}
          background={false}
          checkOrientation
          className="wizard__portrait-cropper"
          dragMode="move"
          guides
          onInitialized={() => setPortraitCropReady(true)}
          ref={portraitCropperRef}
          responsive
          src={portraitCropSource}
          style={{ height: 'min(52vh, 420px)', width: '100%' }}
          viewMode={1}
        />}
        <div className="wizard__portrait-crop-actions">
          <div className="wizard__portrait-crop-tools">
            <Button disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.rotate(-90)} size="small" variant="secondary">Girar −90°</Button>
            <Button disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.rotate(90)} size="small" variant="secondary">Girar +90°</Button>
            <Button aria-label="Reduzir zoom" disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.zoom(-0.1)} size="icon" variant="secondary">−</Button>
            <Button aria-label="Aumentar zoom" disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.zoom(0.1)} size="icon" variant="secondary">+</Button>
          </div>
          <div className="wizard__portrait-crop-buttons">
            <Button onClick={closePortraitCropper} variant="secondary">Cancelar</Button>
            <Button disabled={!portraitCropReady || portraitUploading} onClick={() => void confirmPortraitCrop()}>Usar recorte</Button>
          </div>
        </div>
        </div>
      </Modal>
      {racialConfirmation && <Modal
        footer={<>
          <Button autoFocus onClick={() => setRacialConfirmation(null)} variant="secondary">Cancelar</Button>
          <Button onClick={() => void confirmRacialBonuses()}>
            {racialConfirmation === 'continue' ? 'Aplicar aumento e continuar' : 'Confirmar aumento racial'}
          </Button>
        </>}
        onClose={() => setRacialConfirmation(null)}
        open={racialConfirmation !== null}
        theme={theme}
        title={racialConfirmation === 'continue' ? 'Aplicar bônus raciais e continuar?' : 'Confirmar bônus raciais'}
      >
        <div className="wizard__racial-confirmation">
          <p>
            {racialConfirmation === 'continue'
              ? 'Para avançar, estes aumentos raciais serão aplicados aos valores de habilidade:'
              : 'Os aumentos raciais serão somados aos valores atuais.'}
          </p>
          <ul>
            {racialBonusPreview.map(({ label, before, after, bonus }) => (
              <li key={label}>
                <strong>{label}</strong>
                <span>{before} → {after} (+{bonus})</span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>}
      {equipmentResetAction && <Modal
        footer={<>
          <Button autoFocus onClick={() => setEquipmentResetAction(null)} variant="secondary">Cancelar</Button>
          <Button onClick={confirmStartingEquipmentReset}>Alterar e reconfigurar</Button>
        </>}
        onClose={() => setEquipmentResetAction(null)}
        open={equipmentResetAction !== null}
        theme={theme}
        title="Reconfigurar equipamento inicial?"
      >
        <p>Essa alteração afeta o equipamento inicial. Você precisará configurá-lo novamente antes de continuar. Os itens adicionados manualmente ao inventário serão mantidos.</p>
      </Modal>}
    </main>
  )
}

export function CharacterCreationWizard(props: CharacterCreationWizardProps) {
  return (
    <CharacterCreationErrorBoundary>
      <CharacterCreationWizardContent {...props} />
    </CharacterCreationErrorBoundary>
  )
}
