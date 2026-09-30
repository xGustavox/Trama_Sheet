export function getSpellPreparationLimit(
  classId: string,
  level: number,
  wisdomModifier: number,
  charismaModifier: number,
): number | null {
  if (classId === 'clerigo' || classId === 'druida') {
    return level >= 1 && level <= 20 ? Math.max(1, level + wisdomModifier) : null
  }
  if (classId === 'paladino') {
    return level >= 2 && level <= 20 ? Math.max(1, Math.floor(level / 2) + charismaModifier) : null
  }
  return null
}
