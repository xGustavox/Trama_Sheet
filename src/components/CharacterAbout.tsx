import { useRef, useState } from 'react'
import Cropper, { type ReactCropperElement } from 'react-cropper'
import 'cropperjs/dist/cropper.css'
import type { CharacterDetails } from '../lib/characterData'
import { Button } from './Button'
import { FramedGlassPanel } from './FramedGlassPanel'
import { CharacterRichTextEditor } from './CharacterRichTextEditor'
import { Modal } from './Modal'
import { useToast } from './ToastContext'
import './CharacterAbout.css'

type AboutSection = 'profile' | 'personalityTraits' | 'ideals' | 'bonds' | 'flaws' | 'backstory' | 'notes'
type ProfileField = 'age' | 'weight' | 'height' | 'alignment' | 'eyeColor' | 'skin' | 'hair'
type AboutDraft = Partial<Record<ProfileField | Exclude<AboutSection, 'profile'>, string>>
type BackgroundOption = { path: string; url: string; name: string; file?: File }
const defaultBackground = '/images/backgrounds/forest-ranger.jpg'
const alignmentOptions = [
  'Leal e bom', 'Neutro e bom', 'Caótico e bom',
  'Leal e neutro', 'Neutro', 'Caótico e neutro',
  'Leal e mau', 'Neutro e mau', 'Caótico e mau',
]

const profileFields: { key: ProfileField; label: string }[] = [
  { key: 'age', label: 'Idade' },
  { key: 'weight', label: 'Peso' },
  { key: 'height', label: 'Altura' },
  { key: 'alignment', label: 'Tendência' },
  { key: 'eyeColor', label: 'Olhos' },
  { key: 'skin', label: 'Pele' },
  { key: 'hair', label: 'Cabelo' },
]

const textSections: { key: Exclude<AboutSection, 'profile' | 'backstory' | 'notes'>; title: string }[] = [
  { key: 'personalityTraits', title: 'Traços de personalidade' },
  { key: 'ideals', title: 'Ideais' },
  { key: 'bonds', title: 'Vínculos' },
  { key: 'flaws', title: 'Defeitos' },
]

const sectionTitles: Record<AboutSection, string> = {
  profile: 'Editar perfil',
  personalityTraits: 'Traços de personalidade',
  ideals: 'Ideais',
  bonds: 'Vínculos',
  flaws: 'Defeitos',
  backstory: 'Histórico do personagem (Background)',
  notes: 'Anotações',
}

function formatProfileValue(key: ProfileField, value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 3)
  if (key === 'age') return digits ? `${digits} anos` : ''
  if (key === 'weight') return digits ? `${digits} kg` : ''
  if (key === 'height') return digits.length < 2 ? digits : `${digits[0]},${digits.slice(1)} m`
  return value
}

function removeLastProfileDigit(key: ProfileField, value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 3).slice(0, -1)
  if (key === 'age') return digits ? `${digits} anos` : ''
  if (key === 'weight') return digits ? `${digits} kg` : ''
  if (key === 'height') return digits.length < 2 ? digits : `${digits[0]},${digits.slice(1)} m`
  return value
}

export function CharacterAbout({ character, background, backgroundImages, backgroundPreview, portrait, theme, frameColor, cornerSvg, onDarkModeChange, onFrameColorClick, onSave, onUploadPortrait, onSaveBackground, onLoadBackgrounds, onPreviewBackground, onUploadBackground, onDeleteBackground }: {
  character: CharacterDetails
  background: string
  backgroundImages: string[]
  backgroundPreview: string
  portrait: string
  theme: 'light' | 'dark'
  frameColor: string
  cornerSvg: string
  onDarkModeChange: (enabled: boolean) => void
  onFrameColorClick: () => void
  onSave: (changes: Partial<CharacterDetails>) => Promise<boolean>
  onUploadPortrait: (file: File) => Promise<{ path: string; url: string }>
  onSaveBackground: (changes: Partial<CharacterDetails>) => Promise<boolean>
  onLoadBackgrounds: () => Promise<{ path: string; url: string; name: string }[]>
  onPreviewBackground: (url: string) => void
  onUploadBackground: (file: File) => Promise<{ path: string; url: string }>
  onDeleteBackground: (path: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<AboutSection | null>(null)
  const [draft, setDraft] = useState<AboutDraft>({})
  const [saving, setSaving] = useState(false)
  const [backgroundSaving, setBackgroundSaving] = useState(false)
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false)
  const [backgroundLibraryLoading, setBackgroundLibraryLoading] = useState(false)
  const [backgroundLibrary, setBackgroundLibrary] = useState<BackgroundOption[]>([])
  const [stagedBackgrounds, setStagedBackgrounds] = useState<BackgroundOption[]>([])
  const [backgroundDraft, setBackgroundDraft] = useState<BackgroundOption | null>(null)
  const [backgroundToDelete, setBackgroundToDelete] = useState<BackgroundOption | null>(null)
  const [backgroundDeleting, setBackgroundDeleting] = useState(false)
  const backgroundOriginal = useRef({ path: character.sheetBackgroundPath || defaultBackground, url: backgroundPreview })
  const [portraitCropSource, setPortraitCropSource] = useState('')
  const [portraitCropReady, setPortraitCropReady] = useState(false)
  const [portraitDraftUrl, setPortraitDraftUrl] = useState('')
  const [portraitDraftFile, setPortraitDraftFile] = useState<File | null>(null)
  const [portraitUpload, setPortraitUpload] = useState<{ path: string; url: string } | null>(null)
  const [portraitError, setPortraitError] = useState('')
  const portraitCropperRef = useRef<ReactCropperElement>(null)
  const toast = useToast()

  function beginEdit(section: AboutSection) {
    setDraft(section === 'profile'
      ? Object.fromEntries(profileFields.map(({ key }) => [key, character[key] ?? ''])) as AboutDraft
      : { [section]: character[section] ?? '' })
    setEditing(section)
    if (section === 'profile') {
      setPortraitDraftUrl('')
      setPortraitDraftFile(null)
      setPortraitUpload(null)
      setPortraitError('')
    }
  }

  function cancelEdit() {
    if (saving) return
    closePortraitCropper()
    if (portraitDraftUrl) URL.revokeObjectURL(portraitDraftUrl)
    setEditing(null)
    setDraft({})
    setPortraitDraftUrl('')
    setPortraitDraftFile(null)
    setPortraitUpload(null)
  }

  async function saveEdit() {
    if (!editing || saving) return false
    let changes: Partial<CharacterDetails> = editing === 'profile'
      ? Object.fromEntries(profileFields.map(({ key }) => [key, draft[key] ?? '']))
      : { [editing]: draft[editing] ?? '' }
    let savedSuccessfully = false
    setSaving(true)
    try {
      if (editing === 'profile' && portraitDraftFile) {
        const uploaded = portraitUpload ?? await onUploadPortrait(portraitDraftFile)
        setPortraitUpload(uploaded)
        changes = { ...changes, portraitPath: uploaded.path, portraitUrl: uploaded.url }
      }
      const saved = await onSave(changes)
      if (saved) {
        savedSuccessfully = true
        closePortraitCropper()
        if (portraitDraftUrl) URL.revokeObjectURL(portraitDraftUrl)
        setPortraitDraftUrl('')
        setPortraitDraftFile(null)
        setPortraitUpload(null)
      }
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Não foi possível salvar os dados do perfil.')
    } finally {
      setSaving(false)
    }
    return savedSuccessfully
  }

  function openPortraitCropper(file?: File) {
    if (!file) return
    setPortraitError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPortraitError('Use uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPortraitError('A imagem deve ter no máximo 5 MB.')
      return
    }
    if (portraitDraftUrl) URL.revokeObjectURL(portraitDraftUrl)
    setPortraitDraftUrl('')
    setPortraitDraftFile(null)
    setPortraitUpload(null)
    closePortraitCropper()
    setPortraitCropReady(false)
    setPortraitCropSource(URL.createObjectURL(file))
  }

  function closePortraitCropper() {
    setPortraitCropSource((source) => {
      if (source) URL.revokeObjectURL(source)
      return ''
    })
    setPortraitCropReady(false)
  }

  async function applyPortraitCrop() {
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
      const file = new File([blob], 'retrato-personagem.jpg', { type: 'image/jpeg' })
      setPortraitDraftFile(file)
      setPortraitDraftUrl(URL.createObjectURL(file))
      closePortraitCropper()
    } catch {
      setPortraitError('Não foi possível processar o recorte. Ajuste a imagem e tente novamente.')
    }
  }

  function selectBackground(option: BackgroundOption) {
    setBackgroundDraft(option)
    onPreviewBackground(option.url)
  }

  async function openBackgroundPicker() {
    const path = character.sheetBackgroundPath || defaultBackground
    backgroundOriginal.current = { path, url: backgroundPreview }
    setBackgroundDraft({ path, url: backgroundPreview, name: backgroundName(path) })
    setBackgroundPickerOpen(true)
    setBackgroundLibraryLoading(true)
    try {
      const uploaded = await onLoadBackgrounds()
      setBackgroundLibrary(uploaded)
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : 'Não foi possível carregar suas imagens de fundo.')
    } finally {
      setBackgroundLibraryLoading(false)
    }
  }

  function cancelBackgroundPicker() {
    if (backgroundSaving) return
    stagedBackgrounds.forEach(({ url }) => URL.revokeObjectURL(url))
    setStagedBackgrounds([])
    setBackgroundDraft(null)
    onPreviewBackground(backgroundOriginal.current.url)
    setBackgroundPickerOpen(false)
  }

  function stageBackground(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Escolha uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5 MB.')
      return
    }
    const option: BackgroundOption = { path: `local:${crypto.randomUUID()}`, url: URL.createObjectURL(file), name: file.name, file }
    setStagedBackgrounds((current) => [...current, option])
    selectBackground(option)
  }

  async function confirmBackgroundPicker() {
    if (!backgroundDraft || backgroundSaving) return
    setBackgroundSaving(true)
    try {
      let selected = backgroundDraft
      if (selected.file) {
        const uploaded = await onUploadBackground(selected.file)
        selected = { ...uploaded, name: selected.name }
        onPreviewBackground(selected.url)
        setBackgroundLibrary((current) => [selected, ...current.filter((item) => item.path !== selected.path)])
        setStagedBackgrounds((current) => {
          const removed = current.filter((item) => item.file === backgroundDraft.file)
          removed.forEach(({ url }) => URL.revokeObjectURL(url))
          return current.filter((item) => item.file !== backgroundDraft.file)
        })
        setBackgroundDraft(selected)
      }

      const saved = await onSaveBackground({ sheetBackgroundPath: selected.path, sheetBackgroundUrl: selected.url })
      if (!saved) return
      onPreviewBackground(selected.url)
      stagedBackgrounds.forEach(({ url }) => URL.revokeObjectURL(url))
      setStagedBackgrounds([])
      setBackgroundPickerOpen(false)
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o plano de fundo da ficha.')
    } finally {
      setBackgroundSaving(false)
    }
  }

  async function confirmBackgroundRemoval() {
    if (!backgroundToDelete || backgroundDeleting) return
    setBackgroundDeleting(true)
    try {
      if (!backgroundToDelete.file) await onDeleteBackground(backgroundToDelete.path)

      setBackgroundLibrary((current) => current.filter(({ path }) => path !== backgroundToDelete.path))
      setStagedBackgrounds((current) => current.filter(({ path }) => path !== backgroundToDelete.path))
      if (backgroundToDelete.file) URL.revokeObjectURL(backgroundToDelete.url)
      if (backgroundDraft?.path === backgroundToDelete.path) {
        const original = { ...backgroundOriginal.current, name: backgroundName(backgroundOriginal.current.path) }
        setBackgroundDraft(original)
        onPreviewBackground(original.url)
      }
      toast.success(`Imagem "${backgroundToDelete.name}" removida da sua biblioteca.`)
      setBackgroundToDelete(null)
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir esta imagem. Tente novamente.')
    } finally {
      setBackgroundDeleting(false)
    }
  }

  function backgroundName(path: string) {
    const filename = decodeURIComponent(path.split('/').pop() ?? path)
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  }

  const builtInBackgrounds = backgroundImages.map((path) => ({ path, url: path, name: backgroundName(path) }))

  const editingTextSection = textSections.find(({ key }) => key === editing)?.key ?? null
  const editingRichTextSection = editing === 'backstory' || editing === 'notes' ? editing : null

  return <div className="character-about">
    <div className="character-about__top">
      <FramedGlassPanel className="character-about__profile-frame" contentClassName="character-about__profile-card" cornerSvg={cornerSvg} frameColor={frameColor}>
        <div aria-label="Perfil" className="character-about__portrait">{portrait ? <img alt="" src={portrait} /> : <span>Perfil</span>}</div>
        <dl className="character-about__facts">
          {profileFields.map(({ key, label }) => {
            const value = character[key]
            const displayValue = !value ? '—' : key === 'age' ? `${value} anos` : key === 'weight' ? `${value} kg` : value
            return <div key={key}><dt>{label}</dt><dd>{displayValue}</dd></div>
          })}
          <div><dt>Antecedente</dt><dd>{background || '—'}</dd></div>
        </dl>
        <Button className="character-about__profile-edit" onClick={() => beginEdit('profile')} size="small" variant="secondary">Editar</Button>
      </FramedGlassPanel>
      <FramedGlassPanel className="character-about__personality-frame" contentClassName="character-about__personality" cornerSvg={cornerSvg} frameColor={frameColor}>
        {textSections.map(({ key, title }) => <section className="character-about__personality-section" key={key}>
          <header className="character-about__card-heading"><h2>{title}</h2><Button onClick={() => beginEdit(key)} size="small" variant="secondary">Editar</Button></header>
          <p className="character-about__plain-value">{character[key] || '—'}</p>
        </section>)}
      </FramedGlassPanel>
    </div>

    <FramedGlassPanel className="character-about__rich-frame" contentClassName="character-about__rich-card" cornerSvg={cornerSvg} frameColor={frameColor}>
      <header className="character-about__card-heading"><h2>Histórico do personagem (Background)</h2><Button onClick={() => beginEdit('backstory')} size="small" variant="secondary">Editar</Button></header>
      <CharacterRichTextEditor emptyText="Adicione a história do personagem." value={character.backstory ?? ''} />
    </FramedGlassPanel>

    <FramedGlassPanel className="character-about__rich-frame" contentClassName="character-about__rich-card" cornerSvg={cornerSvg} frameColor={frameColor}>
      <header className="character-about__card-heading"><h2>Anotações</h2><Button onClick={() => beginEdit('notes')} size="small" variant="secondary">Editar</Button></header>
      <CharacterRichTextEditor emptyText="Adicione anotações para este personagem." value={character.notes ?? ''} />
    </FramedGlassPanel>

    <FramedGlassPanel className="character-about__customization-frame" contentClassName="character-about__customization-card" cornerSvg={cornerSvg} frameColor={frameColor}>
      <h2>Personalização da ficha</h2>
      <div className="character-about__customization-controls">
        <label className="character-about__dark-mode"><input checked={theme === 'dark'} onChange={(event) => onDarkModeChange(event.target.checked)} type="checkbox" />Modo escuro</label>
        <div className="character-about__frame-color-trigger">
          <span>Cor das molduras</span>
          <Button aria-label={`Cor atual das molduras: ${frameColor}`} className="character-about__frame-color-open" onClick={onFrameColorClick} variant="secondary"><span aria-hidden="true" className="character-about__frame-color-swatch" style={{ backgroundColor: frameColor }} />Alterar cor</Button>
        </div>
      </div>
      <div className="character-about__background-controls">
        <div className="character-about__background-select">
          <span>Plano de fundo da ficha</span>
          <Button disabled={backgroundSaving} onClick={() => void openBackgroundPicker()} variant="secondary">Trocar imagem</Button>
         </div>
        <button aria-label="Trocar imagem de fundo da ficha" className="character-about__background-preview-button" disabled={backgroundSaving} onClick={() => void openBackgroundPicker()} type="button">
           <img alt="" className="character-about__background-preview" src={backgroundPreview} />
         </button>
      </div>
    </FramedGlassPanel>

    {editing && <Modal open title={sectionTitles[editing]} theme={theme} onClose={cancelEdit} variant="drawer" footer={(requestClose) => <div className="character-about__drawer-footer"><Button disabled={saving} onClick={requestClose} variant="secondary">Cancelar</Button><Button disabled={saving || Boolean(portraitCropSource)} onClick={() => void saveEdit().then((saved) => { if (saved) requestClose() })}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button></div>}>
      <div className="character-about__drawer-form">
        {editing === 'profile' && profileFields.map(({ key, label }) => <label key={key}>
          <span>{label}</span>
          {key === 'alignment'
            ? <select onChange={(event) => setDraft((current) => ({ ...current, alignment: event.target.value }))} value={draft.alignment ?? ''}>
              <option value="">Selecione uma tendência</option>
              {draft.alignment && !alignmentOptions.includes(draft.alignment) && <option value={draft.alignment}>{draft.alignment}</option>}
              {alignmentOptions.map((alignment) => <option key={alignment} value={alignment}>{alignment}</option>)}
            </select>
            : <input
              autoFocus={key === 'age'}
              inputMode={key === 'age' || key === 'weight' || key === 'height' ? 'numeric' : undefined}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: key === 'age' || key === 'weight' || key === 'height' ? formatProfileValue(key, event.target.value) : event.target.value }))}
              onKeyDown={(event) => {
                if ((key !== 'age' && key !== 'weight' && key !== 'height') || (event.key !== 'Backspace' && event.key !== 'Delete')) return
                event.preventDefault()
                const input = event.currentTarget
                const shouldClear = input.selectionStart === 0 && input.selectionEnd === input.value.length
                setDraft((current) => ({ ...current, [key]: shouldClear ? '' : removeLastProfileDigit(key, current[key] ?? '') }))
              }}
              type="text"
              value={draft[key] ?? ''}
            />}
        </label>)}
        {editing === 'profile' && <section className="character-about__portrait-edit">
          <label className="character-about__portrait-upload">
            <span>Foto de perfil</span>
            <input accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => {
              const [file] = event.target.files ?? []
              openPortraitCropper(file)
              event.target.value = ''
            }} type="file" />
            <small>JPG, PNG ou WebP · até 5 MB</small>
          </label>
          <div aria-label="Prévia da foto de perfil" className="character-about__portrait-edit-preview">
            {(portraitDraftUrl || portrait) ? <img alt="Prévia da foto de perfil" src={portraitDraftUrl || portrait} /> : <span className="material-symbols-rounded">person</span>}
          </div>
          {portraitError && <p className="character-about__save-error" role="alert">{portraitError}</p>}
          {portraitCropSource && <div className="character-about__portrait-crop">
            <Cropper
              aspectRatio={1}
              autoCropArea={0.9}
              background={false}
              checkOrientation
              className="character-about__portrait-cropper"
              dragMode="move"
              guides
              onInitialized={() => setPortraitCropReady(true)}
              ref={portraitCropperRef}
              responsive
              src={portraitCropSource}
              viewMode={1}
            />
            <div className="character-about__portrait-crop-tools">
              <Button disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.rotate(-90)} size="small" variant="secondary">Girar −90°</Button>
              <Button disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.rotate(90)} size="small" variant="secondary">Girar +90°</Button>
              <Button aria-label="Reduzir zoom" disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.zoom(-0.1)} size="icon" variant="secondary">−</Button>
              <Button aria-label="Aumentar zoom" disabled={!portraitCropReady} onClick={() => portraitCropperRef.current?.cropper.zoom(0.1)} size="icon" variant="secondary">+</Button>
              <Button disabled={!portraitCropReady} onClick={() => void applyPortraitCrop()}>Aplicar recorte</Button>
              <Button onClick={closePortraitCropper} variant="secondary">Cancelar recorte</Button>
            </div>
          </div>}
        </section>}
        {editingTextSection && <label>
          <span>{sectionTitles[editingTextSection]}</span>
          <textarea autoFocus onChange={(event) => setDraft((current) => ({ ...current, [editingTextSection]: event.target.value }))} rows={4} value={draft[editingTextSection] ?? ''} />
        </label>}
        {editingRichTextSection && <CharacterRichTextEditor editable onChange={(value) => setDraft((current) => ({ ...current, [editingRichTextSection]: value }))} value={draft[editingRichTextSection] ?? ''} />}
      </div>
    </Modal>}
    {backgroundPickerOpen && <Modal open title="Plano de fundo da ficha" theme={theme} onClose={cancelBackgroundPicker} variant="drawer" footer={<div className="character-about__drawer-footer"><Button disabled={backgroundSaving} onClick={cancelBackgroundPicker} variant="secondary">Cancelar</Button><Button disabled={backgroundSaving || !backgroundDraft} onClick={() => void confirmBackgroundPicker()}>{backgroundSaving ? 'Salvando…' : 'Concluir'}</Button></div>}>
      <div className="character-about__background-picker">
        <label className="character-about__background-upload-card">
          <span aria-hidden="true" className="material-symbols-rounded">add_photo_alternate</span>
          <span><strong>Enviar uma imagem</strong><small>JPG, PNG ou WebP · até 5 MB</small></span>
          <input accept="image/jpeg,image/png,image/webp" disabled={backgroundSaving} onChange={(event) => {
            const [file] = event.target.files ?? []
            if (file) stageBackground(file)
            event.target.value = ''
          }} type="file" />
        </label>
        {backgroundLibraryLoading && <p className="character-about__background-loading">Carregando suas imagens…</p>}
        {(backgroundLibrary.length > 0 || stagedBackgrounds.length > 0) && <section className="character-about__background-group character-about__background-group--user">
          <h3>Suas imagens</h3>
          <div className="character-about__background-grid">
            {[...stagedBackgrounds, ...backgroundLibrary].map((option) => <div className="character-about__background-option-shell" key={option.path}>
              <button aria-pressed={backgroundDraft?.path === option.path} className={`character-about__background-option${backgroundDraft?.path === option.path ? ' character-about__background-option--selected' : ''}`} onClick={() => selectBackground(option)} type="button">
                <img alt="" loading="lazy" src={option.url} />
                <span>{option.name}</span>
                {backgroundDraft?.path === option.path && <span aria-hidden="true" className="material-symbols-rounded">check_circle</span>}
              </button>
              <button aria-label={`Excluir ${option.name}`} className="character-about__background-delete" disabled={backgroundDeleting} onClick={() => setBackgroundToDelete(option)} title={`Excluir ${option.name}`} type="button"><span aria-hidden="true" className="material-symbols-rounded">delete</span></button>
            </div>)}
          </div>
        </section>}
        <section className="character-about__background-group character-about__background-group--built-in">
          <h3>Fundos disponíveis</h3>
          <div className="character-about__background-grid">
            {builtInBackgrounds.map((option) => <button aria-pressed={backgroundDraft?.path === option.path} className={`character-about__background-option${backgroundDraft?.path === option.path ? ' character-about__background-option--selected' : ''}`} key={option.path} onClick={() => selectBackground(option)} type="button">
              <img alt="" loading="lazy" src={option.url} />
              <span>{option.name}</span>
              {backgroundDraft?.path === option.path && <span aria-hidden="true" className="material-symbols-rounded">check_circle</span>}
            </button>)}
          </div>
        </section>
      </div>
    </Modal>}
    {backgroundToDelete && <Modal open title="Excluir imagem?" theme={theme} onClose={() => { if (!backgroundDeleting) setBackgroundToDelete(null) }} footer={<><Button disabled={backgroundDeleting} onClick={() => void confirmBackgroundRemoval()} variant="danger">{backgroundDeleting ? 'Excluindo…' : 'Excluir imagem'}</Button><Button disabled={backgroundDeleting} onClick={() => setBackgroundToDelete(null)} variant="secondary">Cancelar</Button></>}>
      <p>A imagem “{backgroundToDelete.name}” será removida da sua biblioteca. Imagens usadas por personagens ou rascunhos não podem ser excluídas até que o fundo seja alterado.</p>
    </Modal>}
  </div>
}
