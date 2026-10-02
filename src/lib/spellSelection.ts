export function canSelectSpellAtSlot(
  selectedSpellLevels: number[],
  slotIndex: number,
  spellLevel: number,
  maxSpellCountAtOrAboveLevel: (level: number) => number | null,
  highestAvailableSpellLevel: number,
): boolean {
  if (slotIndex < 0 || slotIndex >= selectedSpellLevels.length) return false

  const candidateLevels = [...selectedSpellLevels]
  candidateLevels[slotIndex] = spellLevel

  for (let level = 2; level <= highestAvailableSpellLevel; level += 1) {
    const maximum = maxSpellCountAtOrAboveLevel(level)
    if (maximum === null) continue
    const selectedAtOrAboveLevel = candidateLevels.filter((selectedLevel) => selectedLevel >= level).length
    if (selectedAtOrAboveLevel > maximum) return false
  }

  return true
}

export function groupSpellChoicesByLevel(spellNames: string[], spellLevelByName: Record<string, number>): Record<number, string[]> {
  const grouped: Record<number, string[]> = {}
  for (const name of spellNames) {
    const level = spellLevelByName[name]
    if (level) grouped[level] = [...(grouped[level] ?? []), name]
  }
  return grouped
}

export function filterKnownSpellOptions<T extends { name: string }>(options: T[], knownSpellNames: string[]): T[] {
  const known = new Set(knownSpellNames.map((name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))
  return options.filter(({ name }) => !known.has(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))
}
