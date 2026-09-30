import { useEffect, useState } from 'react'
import type { EquipmentCatalog } from './equipment'
import { clearEquipmentCatalogCache, loadEquipmentCatalog, loadEquipmentItems } from './equipmentRepository'

export function useEquipmentCatalog(includePacks = false, enabled = true) {
  const [result, setResult] = useState<{ key: string; catalog: EquipmentCatalog | null; error: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${includePacks}:${enabled}:${attempt}`

  useEffect(() => {
    if (!enabled) return
    let active = true
    const request = includePacks
      ? loadEquipmentCatalog()
      : loadEquipmentItems().then(items => ({ items, packs: [] }))
    request.then(data => {
      if (active) setResult({ key, catalog: data, error: false })
    }).catch(() => {
      if (active) setResult({ key, catalog: null, error: true })
    })
    return () => { active = false }
  }, [enabled, includePacks, key])

  const retry = () => {
    clearEquipmentCatalogCache()
    setAttempt(current => current + 1)
  }

  const current = result?.key === key ? result : null
  return { catalog: current?.catalog ?? null, loading: enabled && !current, error: current?.error ?? false, retry }
}
