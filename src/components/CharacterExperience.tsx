import { useState } from 'react'
import type { CharacterDetails, PrimalPath, PrimalTotemChoices } from '../lib/characterData'
import { classArmorProficiencies } from '../lib/classArmorProficiencies'
import { classHitDice, rebaseClassFeatureChoicesForSubclass, type ClassFeatureData } from '../lib/classFeatures'
import { experienceThresholds, hasConfirmedAbilityIncrease, hitPointGainForLevel, levelForExperience } from '../lib/experience'
import { feats, getFeatAbilityBonus, getFeatPrerequisiteFailure, type Feat } from '../lib/feats'
import { Button } from './Button'
import { Modal } from './Modal'
import './CharacterExperience.css'

const abilityOptions = [
  ['strength', 'Força'],
  ['dexterity', 'Destreza'],
  ['constitution', 'Constituição'],
  ['intelligence', 'Inteligência'],
  ['wisdom', 'Sabedoria'],
  ['charisma', 'Carisma'],
] as const

function formatExperience(value: number) {
  return Math.max(0, value).toLocaleString('pt-BR')
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function ExperienceBar({
  experiencePoints,
  level,
  onClick,
}: {
  experiencePoints: number
  level: number
  onClick: () => void
}) {
  const threshold = experienceThresholds[Math.min(level, experienceThresholds.length - 1)]
  const progress = level >= 20 ? 100 : Math.min(100, (experiencePoints / threshold) * 100)

  return <button aria-label={`Experiência: nível ${level}, ${formatExperience(experiencePoints)} de ${formatExperience(threshold)} XP. Abrir controles de experiência`} className="play-sheet__experience-bar" onClick={onClick} type="button">
    <span className="play-sheet__experience-labels">
      <span className="play-sheet__experience-current-level"><span className="play-sheet__experience-prefix-full">Level</span><span className="play-sheet__experience-prefix-mobile">Lv.</span> <strong>{level}</strong></span>
      <span className="play-sheet__experience-values"><span className="play-sheet__experience-total-full"><strong>{formatExperience(experiencePoints)}</strong> / <span>{formatExperience(threshold)}</span></span><span className="play-sheet__experience-total-mobile"><strong>{formatExperience(experiencePoints)} XP</strong></span></span>
      <span className="play-sheet__experience-next-level">{level >= 20 ? 'Max Level' : `Level ${level + 1}`}</span>
    </span>
    <span aria-label={`${Math.round(progress)}% até o próximo nível`} aria-valuemax={threshold} aria-valuemin={0} aria-valuenow={Math.min(experiencePoints, threshold)} className="play-sheet__experience-meter" role="progressbar">
      <span style={{ width: `${progress}%` }} />
    </span>
  </button>
}

export function ExperienceDialog({
  experiencePoints,
  theme = 'light',
  onCancel,
  onConfirm,
}: {
  experiencePoints: number
  theme?: 'light' | 'dark'
  onCancel: () => void
  onConfirm: (experiencePoints: number) => Promise<boolean>
}) {
  const [draftPoints, setDraftPoints] = useState(String(experiencePoints))
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const parsedDraftPoints = Number(draftPoints)
  const draftIsValid = draftPoints !== '' && Number.isSafeInteger(parsedDraftPoints) && parsedDraftPoints >= 0
  const currentPoints = draftIsValid ? parsedDraftPoints : 0
  const parsedAmount = Number(amount)
  const amountIsValid = amount !== '' && Number.isSafeInteger(parsedAmount) && parsedAmount > 0
  const currentLevel = levelForExperience(currentPoints)
  const nextLevelThreshold = experienceThresholds[currentLevel]

  function adjustExperience(direction: -1 | 1) {
    if (!draftIsValid || !amountIsValid) return
    setDraftPoints(String(Math.max(0, currentPoints + direction * parsedAmount)))
    setAmount('')
  }

  async function confirm() {
    if (!draftIsValid || saving) return
    setSaving(true)
    const saved = await onConfirm(currentPoints)
    setSaving(false)
    if (saved) onCancel()
  }

  return <Modal open title="Gerenciar pontos de experiência" theme={theme} onClose={() => { if (!saving) onCancel() }} footer={<div className="play-sheet__experience-footer"><Button disabled={saving} onClick={onCancel} variant="secondary">Cancelar</Button><Button disabled={!draftIsValid || saving} onClick={() => void confirm()}>{saving ? 'Salvando…' : 'Concluir'}</Button></div>}>
    <div className="play-sheet__experience-dialog">
      <div className="play-sheet__experience-summary">
        <input aria-label="Pontos de experiência atuais" autoFocus className="play-sheet__experience-total-input" inputMode="numeric" min="0" onChange={(event) => setDraftPoints(event.target.value)} step="1" type="number" value={draftPoints} />
        <p aria-live="polite" className="play-sheet__experience-current">{!draftIsValid ? 'Informe um valor inteiro de XP igual ou maior que zero.' : nextLevelThreshold === undefined ? 'Nível máximo alcançado.' : `Faltam ${formatExperience(nextLevelThreshold - currentPoints)} XP para o nível ${currentLevel + 1}.`}</p>
      </div>
      <div className="play-sheet__experience-controls">
        <button className="play-sheet__experience-remove" disabled={!amountIsValid || !draftIsValid || saving || currentPoints === 0} onClick={() => void adjustExperience(-1)} type="button">Remover</button>
        <input aria-label="Quantidade de XP para ajustar" inputMode="numeric" min="1" onChange={(event) => setAmount(event.target.value)} step="1" type="number" value={amount} />
        <button className="play-sheet__experience-add" disabled={!amountIsValid || !draftIsValid || saving} onClick={() => void adjustExperience(1)} type="button">Adicionar</button>
      </div>
    </div>
  </Modal>
}

export function LevelUpDrawer({
  character,
  classId,
  race,
  classData,
  targetExperience,
  targetLevel,
  theme = 'light',
  onCancel,
  onComplete,
  onConfirm,
}: {
  character: CharacterDetails
  classId: string
  race: string
  classData: ClassFeatureData | undefined
  targetExperience: number
  targetLevel: number
  theme?: 'light' | 'dark'
  onCancel: () => void
  onComplete: () => void
  onConfirm: (character: CharacterDetails, hitPointIncrease: number) => Promise<boolean>
}) {
  const [subclassId, setSubclassId] = useState(character.classSubclassId)
  const [primalPath, setPrimalPath] = useState<PrimalPath>(character.primalPath)
  const [primalTotemChoices, setPrimalTotemChoices] = useState<PrimalTotemChoices>(character.primalTotemChoices)
  const [choices, setChoices] = useState(character.classFeatureChoices)
  const [abilitySelections, setAbilitySelections] = useState<Record<number, string[]>>({})
  const [abilityIncreaseModes, setAbilityIncreaseModes] = useState<Record<number, 'ability' | 'feat'>>({})
  const [featSelections, setFeatSelections] = useState<Record<number, string>>({})
  const [featAbilitySelections, setFeatAbilitySelections] = useState<Record<number, string>>({})
  const [hitPointModes, setHitPointModes] = useState<Record<number, 'average' | 'rolled'>>({})
  const [hitPointRolls, setHitPointRolls] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const hitDieSize = classHitDice[classId] ?? 8
  const constitutionModifier = Math.floor((Number(character.abilities.constitution) - 10) / 2)
  const hitPointLevels = Array.from({ length: Math.max(0, targetLevel - character.level) }, (_, index) => character.level + index + 1)
  const subclass = classData?.subclasses.find((item) => item.id === subclassId)
  const subclassLevel = classData?.subclasses[0]?.selectionLevel
  const subclassRequired = Boolean(subclassLevel && targetLevel >= subclassLevel && !character.classSubclassId)
  const barbarianPathRequired = classId === 'barbaro' && targetLevel >= 3 && !character.primalPath
  const totemChoicesToMake = classId === 'barbaro' && primalPath === 'totem-warrior'
    ? ([
      { level: 3, key: 'spiritualTotem', label: 'Totem Espiritual' },
      { level: 6, key: 'beastAspect', label: 'Aspecto da Besta' },
      { level: 14, key: 'totemicAttunement', label: 'Sintonia Totêmica' },
    ] as const).filter(({ level }) => level > character.level && level <= targetLevel)
    : []
  const newlySelectedSubclass = Boolean(subclassId && !character.classSubclassId)
  const unlockedFeatures = [
    ...(classData?.features.filter((feature) => feature.level > character.level && feature.level <= targetLevel) ?? []),
    ...(subclass?.features.filter((feature) =>
      feature.level <= targetLevel && (feature.level > character.level || (newlySelectedSubclass && feature.level === subclassLevel)),
    ) ?? []),
  ]
  const choicesToMake = unlockedFeatures.flatMap((feature) => (feature.choices ?? []).map((choice) => ({ feature, choice })))
  const abilityIncreases = unlockedFeatures.filter((feature) =>
    feature.name.toLocaleLowerCase('pt-BR').includes('incremento no valor de habilidade') && !hasConfirmedAbilityIncrease(character, feature.level),
  )
  const selectedFeatIds = Object.entries(choices)
    .filter(([key]) => key.startsWith('ability-score-increase:') && key.endsWith(':feat'))
    .flatMap(([, selected]) => selected)
  const draftFeatIds = Object.values(featSelections).filter(Boolean)
  const canCastSpells = selectedFeatIds.includes('iniciado-em-magia') || draftFeatIds.includes('iniciado-em-magia')
    || (['bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'mago'].includes(classId) && targetLevel >= 1)
    || (['paladino', 'patrulheiro'].includes(classId) && targetLevel >= 2)
    || (classId === 'guerreiro' && subclassId === 'cavaleiro-arcano' && targetLevel >= 3)
    || (classId === 'ladino' && subclassId === 'trapaceiro-arcano' && targetLevel >= 3)
  const armorProficiencies = [
    ...(classArmorProficiencies[classId] ?? []),
    ...(classId === 'bardo' && subclassId === 'colegio-da-bravura' ? ['Armaduras médias'] : []),
    ...(classId === 'clerigo' && subclass?.features.some((feature) => feature.level <= targetLevel && feature.description.toLocaleLowerCase('pt-BR').includes('armaduras pesadas')) ? ['Armaduras pesadas'] : []),
    ...(normalizeText(race).includes('anao') ? ['Armaduras leves', 'Armaduras médias'] : []),
    ...[...selectedFeatIds, ...draftFeatIds].flatMap((id) => id === 'protecao-leve'
      ? ['Armaduras leves']
      : id === 'protecao-moderada' ? ['Armaduras médias'] : id === 'protecao-pesada' ? ['Armaduras pesadas'] : []),
  ]
  const getFeatFailure = (feat: Feat, level: number) => {
    const key = `ability-score-increase:${character.characterClassId}:${level}:feat`
    const alreadySelected = Object.entries(choices)
      .filter(([choiceKey]) => choiceKey.startsWith('ability-score-increase:') && choiceKey.endsWith(':feat') && choiceKey !== key)
      .some(([, selected]) => selected[0] === feat.id)
    const selectedAtAnotherLevel = Object.entries(featSelections)
      .some(([selectedLevel, selectedId]) => Number(selectedLevel) !== level && selectedId === feat.id)
    const prerequisiteFailure = getFeatPrerequisiteFailure(feat, character.abilities, canCastSpells, armorProficiencies)
    return prerequisiteFailure || ((alreadySelected || selectedAtAnotherLevel) && !feat.repeatable ? 'Este talento só pode ser escolhido uma vez.' : '')
  }
  const selectionsComplete = hitPointLevels.every((level) => hitPointModes[level] !== 'rolled' || (Number.isSafeInteger(Number(hitPointRolls[level])) && Number(hitPointRolls[level]) >= 1 && Number(hitPointRolls[level]) <= hitDieSize)) && (!subclassRequired || Boolean(subclassId)) && (!barbarianPathRequired || Boolean(primalPath)) && totemChoicesToMake.every(({ key }) => Boolean(primalTotemChoices[key])) && choicesToMake.every(({ feature, choice }) => {
    const key = `${character.characterClassId}:${subclassId}:${feature.level}:${feature.name}:${choice.id}`
    return (choices[key]?.length ?? 0) === choice.choose
  }) && abilityIncreases.every((feature) => {
    const mode = abilityIncreaseModes[feature.level]
    if (mode === 'feat') {
      const feat = feats.find((item) => item.id === featSelections[feature.level])
      if (!feat || getFeatFailure(feat, feature.level)) return false
      if (!feat.abilityBonus) return true
      return Boolean(getFeatAbilityBonus(feat, character.abilities, featAbilitySelections[feature.level]))
    }
    if (mode !== 'ability') return false
    const selection = abilitySelections[feature.level] ?? []
    return selection.length === 1
      ? Number(character.abilities[selection[0]]) <= 18
      : selection.length === 2 && selection.every((ability) => Number(character.abilities[ability]) < 20)
  })

  function updateSubclass(nextId: string) {
    setChoices((current) => classData
      ? rebaseClassFeatureChoicesForSubclass(current, character.characterClassId, subclassId, nextId, classData.features)
      : current)
    setSubclassId(nextId)
  }

  function toggleChoice(key: string, optionId: string, count: number) {
    setChoices((current) => {
      const selected = current[key] ?? []
      const next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : count === 1 ? [optionId] : selected.length < count ? [...selected, optionId] : selected
      return { ...current, [key]: next }
    })
  }

  function toggleAbilityIncrease(level: number, ability: string) {
    setAbilitySelections((current) => {
      const selected = current[level] ?? []
      return {
        ...current,
        [level]: selected.includes(ability)
          ? selected.filter((item) => item !== ability)
          : selected.length < 2 ? [...selected, ability] : selected,
      }
    })
  }

  async function confirm() {
    if (!selectionsComplete) return
    const nextChoices = { ...choices }
    const nextAbilities = { ...character.abilities }
    const confirmedIncreases = character.abilityScoreIncreases?.classId === character.characterClassId
      ? { ...character.abilityScoreIncreases.selections }
      : {}
    const featAbilityIncreases = { ...(character.featAbilityIncreases ?? {}) }
    for (const feature of abilityIncreases) {
      const key = `ability-score-increase:${character.characterClassId}:${feature.level}`
      const mode = abilityIncreaseModes[feature.level]
      const featKey = `${key}:feat`
      const previousFeatIncrease = featAbilityIncreases[featKey]
      if (previousFeatIncrease) {
        const previousScore = Number(nextAbilities[previousFeatIncrease.ability])
        if (previousFeatIncrease.amount && Number.isFinite(previousScore)) nextAbilities[previousFeatIncrease.ability] = String(previousScore - previousFeatIncrease.amount)
        delete featAbilityIncreases[featKey]
      }
      if (mode === 'feat') {
        const feat = feats.find((item) => item.id === featSelections[feature.level])
        if (!feat || getFeatFailure(feat, feature.level)) return
        const bonus = feat.abilityBonus
          ? getFeatAbilityBonus(feat, nextAbilities, featAbilitySelections[feature.level])
          : null
        if (feat.abilityBonus && !bonus) return
        if (bonus?.amount) nextAbilities[bonus.ability] = String(Number(nextAbilities[bonus.ability]) + bonus.amount)
        if (bonus) featAbilityIncreases[featKey] = bonus
        delete nextChoices[key]
        nextChoices[`${key}:mode`] = ['feat']
        nextChoices[featKey] = [feat.id]
        delete confirmedIncreases[key]
        continue
      }
      const selection = abilitySelections[feature.level] ?? []
      const amount = selection.length === 1 ? 2 : 1
      if ((selection.length !== 1 && selection.length !== 2) || selection.some((ability) => Number(nextAbilities[ability]) + amount > 20)) return
      for (const ability of selection) nextAbilities[ability] = String(Number(nextAbilities[ability]) + amount)
      nextChoices[key] = selection
      nextChoices[`${key}:mode`] = ['ability']
      delete nextChoices[featKey]
      confirmedIncreases[key] = selection
    }

    setSaving(true)
    const hitPointIncrease = hitPointLevels.reduce((total, level) => {
      const rolledResult = hitPointModes[level] === 'rolled' ? Number(hitPointRolls[level]) : undefined
      return total + hitPointGainForLevel(hitDieSize, constitutionModifier, rolledResult)
    }, 0)
    const saved = await onConfirm({
      ...character,
      classSubclassId: subclassId,
      primalPath,
      primalTotemChoices,
      classFeatureChoices: nextChoices,
      abilities: nextAbilities,
      featAbilityIncreases,
      abilityScoreIncreases: { classId: character.characterClassId, selections: confirmedIncreases },
      level: targetLevel,
      experiencePoints: String(targetExperience),
      maxHp: String((Number(character.maxHp) || 0) + hitPointIncrease),
    }, hitPointIncrease)
    setSaving(false)
    if (saved) onComplete()
  }

  return <Modal open title="Avanço de nível" theme={theme} onClose={() => { if (!saving) onCancel() }} variant="drawer" footer={<><Button className="play-sheet__level-up-cancel" disabled={saving} onClick={onCancel} variant="secondary">Cancelar</Button><Button disabled={!selectionsComplete || saving} onClick={() => void confirm()}>{saving ? 'Salvando…' : 'Concluir avanço'}</Button></>}>
    <div className="play-sheet__level-up-drawer">
      <p>Nível {character.level} → {targetLevel}. Revise e faça as escolhas liberadas para a classe.</p>
      <div className="play-sheet__level-up-content">
        {hitPointLevels.map((level) => {
          const mode = hitPointModes[level] ?? 'average'
          const rolledResult = mode === 'rolled' ? Number(hitPointRolls[level]) : undefined
          const rolledResultValid = mode !== 'rolled' || (Number.isSafeInteger(rolledResult) && rolledResult! >= 1 && rolledResult! <= hitDieSize)
          const gain = rolledResultValid ? hitPointGainForLevel(hitDieSize, constitutionModifier, rolledResult) : null
          return <fieldset className="play-sheet__level-up-choice" key={`hit-points-${level}`}>
            <legend>Pontos de vida — nível {level}</legend>
            <div className="play-sheet__level-up-options">
              <label><input checked={mode === 'average'} name={`hit-points-${level}`} onChange={() => setHitPointModes((current) => ({ ...current, [level]: 'average' }))} type="radio" /><span><strong>Usar valor padrão</strong><small>{Math.ceil((hitDieSize + 1) / 2)} + Constituição ({constitutionModifier >= 0 ? '+' : ''}{constitutionModifier}) = {Math.max(1, Math.ceil((hitDieSize + 1) / 2) + constitutionModifier)} PV</small></span></label>
              <label><input checked={mode === 'rolled'} name={`hit-points-${level}`} onChange={() => setHitPointModes((current) => ({ ...current, [level]: 'rolled' }))} type="radio" /><span><strong>Informar resultado do dado</strong><small>Role 1d{hitDieSize} fora da ficha e informe o resultado; Constituição será somada automaticamente.</small></span></label>
            </div>
            {mode === 'rolled' && <label className="play-sheet__level-up-hit-point-roll"><span>Resultado do dado (1–{hitDieSize})</span><input aria-label={`Resultado do dado de vida no nível ${level}`} inputMode="numeric" max={hitDieSize} min="1" onChange={(event) => setHitPointRolls((current) => ({ ...current, [level]: event.target.value }))} step="1" type="number" value={hitPointRolls[level] ?? ''} />{gain !== null && <small>Ganho neste nível: {gain} PV</small>}</label>}
          </fieldset>
        })}
        {subclassRequired && <fieldset className="play-sheet__level-up-choice">
          <legend>Escolha uma subclasse</legend>
          {classData?.subclasses.map((option) => <label key={option.id}><input checked={subclassId === option.id} name="level-up-subclass" onChange={() => updateSubclass(option.id)} type="radio" /><span>{option.name}</span></label>)}
        </fieldset>}
        {barbarianPathRequired && <fieldset className="play-sheet__level-up-choice">
          <legend>Escolha um Caminho Primitivo</legend>
          {(['berserker', 'totem-warrior'] as const).map((path) => <label key={path}><input checked={primalPath === path} name="barbarian-path" onChange={() => setPrimalPath(path)} type="radio" /><span>{path === 'berserker' ? 'Berserker' : 'Guerreiro Totêmico'}</span></label>)}
        </fieldset>}
        {totemChoicesToMake.map(({ level, key, label }) => <fieldset className="play-sheet__level-up-choice" key={key}>
          <legend>{label} — nível {level}</legend>
          {(['eagle', 'wolf', 'bear'] as const).map((animal) => <label key={animal}><input checked={primalTotemChoices[key] === animal} name={`totem-${key}`} onChange={() => setPrimalTotemChoices((current) => ({ ...current, [key]: animal }))} type="radio" /><span>{animal === 'eagle' ? 'Águia' : animal === 'wolf' ? 'Lobo' : 'Urso'}</span></label>)}
        </fieldset>)}
        {choicesToMake.map(({ feature, choice }) => {
          const key = `${character.characterClassId}:${subclassId}:${feature.level}:${feature.name}:${choice.id}`
          const selected = choices[key] ?? []
          const options = choice.options.filter((option) => option.level === undefined || option.level <= targetLevel)
          return <fieldset className="play-sheet__level-up-choice" key={key}>
            <legend>{feature.name}: {choice.name} <small>(escolha {choice.choose})</small></legend>
            {feature.description && <p>{feature.description}</p>}
            <div className="play-sheet__level-up-options">
              {options.map((option) => <label key={option.id}>
                <input checked={selected.includes(option.id)} disabled={!selected.includes(option.id) && selected.length >= choice.choose} onChange={() => toggleChoice(key, option.id, choice.choose)} type={choice.choose === 1 ? 'radio' : 'checkbox'} name={key} />
                <span><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}</span>
              </label>)}
            </div>
          </fieldset>
        })}
        {abilityIncreases.map((feature) => {
          const level = feature.level
          const mode = abilityIncreaseModes[level]
          const selectedFeat = feats.find((feat) => feat.id === featSelections[level])
          return <fieldset className="play-sheet__level-up-choice" key={`asi-${level}`}>
            <legend>Incremento no valor de habilidade — nível {level}</legend>
            <p>Escolha como usar este incremento: aumentar seus atributos ou receber um talento.</p>
            <div className="play-sheet__level-up-options">
              <label><input checked={mode === 'ability'} name={`asi-mode-${level}`} onChange={() => setAbilityIncreaseModes((current) => ({ ...current, [level]: 'ability' }))} type="radio" /><span><strong>Aumento no valor de habilidade</strong><small>+2 em uma habilidade ou +1 em duas.</small></span></label>
              <label><input checked={mode === 'feat'} name={`asi-mode-${level}`} onChange={() => setAbilityIncreaseModes((current) => ({ ...current, [level]: 'feat' }))} type="radio" /><span><strong>Escolher um talento</strong><small>Os pré-requisitos são verificados antes de concluir.</small></span></label>
            </div>
            {mode === 'ability' && <div className="play-sheet__level-up-options play-sheet__level-up-abilities">
              {abilityOptions.map(([key, label]) => {
                const selected = abilitySelections[level] ?? []
                const increment = selected.length === 1 ? 2 : 1
                const value = Number(character.abilities[key])
                const disabled = !selected.includes(key) && (selected.length >= 2 || !value || value + (selected.length === 1 ? 1 : 2) > 20)
                return <label key={key}>
                  <input checked={selected.includes(key)} disabled={disabled} onChange={() => toggleAbilityIncrease(level, key)} type="checkbox" />
                  <span><strong>{label}</strong><small>{value || '—'}{selected.includes(key) ? ` → ${value + increment}` : ''}</small></span>
                </label>
              })}
            </div>}
            {mode === 'feat' && <div className="play-sheet__level-up-feats">
              <p>Escolha um talento disponível para este personagem:</p>
              <div className="play-sheet__level-up-options">
                {feats.map((feat) => {
                  const failure = getFeatFailure(feat, level)
                  const selected = featSelections[level] === feat.id
                  return <label key={feat.id} title={failure || undefined}>
                    <input checked={selected} disabled={Boolean(failure) && !selected} name={`asi-feat-${level}`} onChange={() => setFeatSelections((current) => ({ ...current, [level]: feat.id }))} type="radio" />
                    <span><strong>{feat.name}{feat.repeatable ? ' · Repetível' : ''}</strong><small>{failure ? `Indisponível: ${failure}` : `Pré-requisito: ${feat.prerequisite}.`}</small><small>{feat.description}</small></span>
                  </label>
                })}
              </div>
              {selectedFeat?.abilityBonus && 'chooseFrom' in selectedFeat.abilityBonus && <fieldset className="play-sheet__level-up-choice">
                <legend>{selectedFeat.name}: escolha uma habilidade</legend>
                <div className="play-sheet__level-up-options play-sheet__level-up-abilities">
                  {selectedFeat.abilityBonus.chooseFrom.map((ability) => {
                    const label = abilityOptions.find(([key]) => key === ability)?.[1] ?? ability
                    const bonus = getFeatAbilityBonus(selectedFeat, character.abilities, ability)
                    const value = Number(character.abilities[ability])
                    return <label key={ability}><input checked={featAbilitySelections[level] === ability} name={`asi-feat-ability-${level}`} onChange={() => setFeatAbilitySelections((current) => ({ ...current, [level]: ability }))} type="radio" /><span><strong>{label}</strong><small>{value}{bonus?.amount ? ` → ${value + bonus.amount}` : ' (máximo 20)'}</small></span></label>
                  })}
                </div>
              </fieldset>}
            </div>}
          </fieldset>
        })}
        {!subclassRequired && choicesToMake.length === 0 && abilityIncreases.length === 0 && <p>Nenhuma escolha adicional é necessária neste avanço.</p>}
      </div>
    </div>
  </Modal>
}
