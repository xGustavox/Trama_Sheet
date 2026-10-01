import type { CharacterDetails, CharacterDraft, CharacterRecord } from './characterData'
import { supabase } from './supabase'

const portraitBucket = 'character-portraits'

function requireClient() {
  if (!supabase) throw new Error('O Supabase não está configurado.')
  return supabase
}

export function serializeCharacter(character: CharacterDetails) {
  return { ...character, portraitUrl: '', sheetBackgroundUrl: '' }
}

export async function loadCharacters(userId: string): Promise<CharacterRecord[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('characters')
    .select('id, name, level, experience_points, max_hit_points, portrait_path, race_id, character_class_id, background_id, details, created_at, race:races(name), character_class:character_classes(name), background:backgrounds(name)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  const records = await Promise.all((data ?? []).map(async (row) => ({
    ...row,
    details: {
      ...row.details as CharacterDetails,
      sheetBackgroundUrl: row.details.sheetBackgroundPath
        ? row.details.sheetBackgroundPath.startsWith('/images/')
          ? row.details.sheetBackgroundPath
          : await createPortraitUrl(row.details.sheetBackgroundPath)
        : '',
    },
    race: firstRelation(row.race) as CharacterRecord['race'],
    character_class: firstRelation(row.character_class) as CharacterRecord['character_class'],
    background: firstRelation(row.background) as CharacterRecord['background'],
    portrait_url: row.portrait_path ? await createPortraitUrl(row.portrait_path) : '',
  })))
  return records as unknown as CharacterRecord[]
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value as T | null
}

export async function loadCharacterDraft(userId: string): Promise<CharacterDraft | null> {
  const client = requireClient()
  const { data, error } = await client
    .from('character_drafts')
    .select('id, details, furthest_step, last_step')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const character = data.details as CharacterDetails
  const portraitUrl = character.portraitPath ? await createPortraitUrl(character.portraitPath) : ''
  return {
    id: data.id,
    character: {
      ...character,
      portraitUrl,
      sheetBackgroundUrl: character.sheetBackgroundPath
        ? character.sheetBackgroundPath.startsWith('/images/')
          ? character.sheetBackgroundPath
          : await createPortraitUrl(character.sheetBackgroundPath)
        : '',
    },
    furthestStep: data.furthest_step,
    lastStep: data.last_step,
  }
}

export async function saveCharacterDraft(
  userId: string,
  draft: Omit<CharacterDraft, 'id'> & { id?: string },
): Promise<CharacterDraft> {
  const client = requireClient()
  const { data, error } = await client
    .from('character_drafts')
    .upsert({
      ...(draft.id ? { id: draft.id } : {}),
      user_id: userId,
      details: serializeCharacter(draft.character),
      furthest_step: draft.furthestStep,
      last_step: draft.lastStep,
    }, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (error) throw error
  return { ...draft, id: data.id }
}

export async function deleteCharacterDraft(userId: string) {
  const client = requireClient()
  const { error } = await client.from('character_drafts').delete().eq('user_id', userId)
  if (error) throw error
}

export async function createPortraitUrl(path: string) {
  const client = requireClient()
  const { data, error } = await client.storage.from(portraitBucket).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function uploadPortrait(userId: string, file: File) {
  const client = requireClient()
  const supportedTypes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const extension = supportedTypes[file.type]
  if (!extension) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.')

  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from(portraitBucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  try {
    return { path, url: await createPortraitUrl(path) }
  } catch (error) {
    await client.storage.from(portraitBucket).remove([path])
    throw error
  }
}

export async function uploadCharacterBackground(userId: string, file: File) {
  const client = requireClient()
  const supportedTypes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const extension = supportedTypes[file.type]
  if (!extension) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.')

  const path = `${userId}/background-${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from(portraitBucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
    metadata: { originalName: file.name },
  })
  if (error) throw error

  try {
    return { path, url: await createPortraitUrl(path) }
  } catch (error) {
    await client.storage.from(portraitBucket).remove([path])
    throw error
  }
}

export async function listCharacterBackgrounds(userId: string) {
  const client = requireClient()
  const { data, error } = await client.storage.from(portraitBucket).list(userId, {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw error

  return Promise.all((data ?? [])
    .filter((file) => file.id && file.name.startsWith('background-'))
    .map(async (file, index) => {
      const path = `${userId}/${file.name}`
      const originalName = file.metadata?.originalName
      return {
        path,
        url: await createPortraitUrl(path),
        name: typeof originalName === 'string' ? originalName : `Imagem enviada ${index + 1}`,
      }
    }))
}

export async function deletePortrait(path: string) {
  const client = requireClient()
  const { error } = await client.storage.from(portraitBucket).remove([path])
  if (error) throw error
}

export async function saveCharacter(
  userId: string,
  character: CharacterDetails,
  id: string,
) {
  const client = requireClient()
  const { error } = await client.from('characters').upsert({
    id,
    user_id: userId,
    name: character.name.trim(),
    level: character.level,
    experience_points: Number(character.experiencePoints) || 0,
    max_hit_points: character.maxHp ? Number(character.maxHp) : null,
    portrait_path: character.portraitPath || null,
    race_id: character.raceId || null,
    character_class_id: character.characterClassId || null,
    background_id: character.backgroundId || null,
    details: serializeCharacter(character),
  }, { onConflict: 'id' })

  if (error) throw error
}

export async function deleteCharacter(userId: string, id: string) {
  const client = requireClient()
  const { data, error } = await client
    .from('characters')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('portrait_path, details')
    .maybeSingle()

  if (error) throw error
  if (data?.portrait_path) await deletePortrait(data.portrait_path).catch(() => undefined)
}
