import { type CSSProperties, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AppSidebar, type SidebarSection } from './components/AppSidebar'
import { AuthScreen } from './components/AuthScreen'
import { Button } from './components/Button'
import { Modal } from './components/Modal'
import { CharacterCreationWizard } from './components/CharacterCreationWizard'
import { CharacterPlaySheet } from './components/CharacterPlaySheet'
import { useToast } from './components/ToastContext'
import type { CharacterDetails, CharacterDraft, CharacterRecord } from './lib/characterData'
import {
  deleteCharacter as deleteOwnedCharacter,
  deleteCharacterDraft,
  deletePortrait,
  listCharacterBackgrounds,
  loadCharacterDraft,
  loadCharacters,
  saveCharacter,
  saveCharacterDraft,
  uploadCharacterBackground,
  uploadPortrait,
} from './lib/characterRepository'
import { supabase } from './lib/supabase'
import './App.css'

type Character = {
  id: string
  name: string
  level: number
  race: string
  characterClass: string
  hp: number
  maxHp: number
  tempHp: number
  portrait: string
  landscape: string
  landscapePosition: string
  portraitPath: string
  details: CharacterDetails
  record: CharacterRecord
}

type IconName = 'auto_awesome' | 'arrow_forward' | 'edit' | 'delete' | 'close' | 'add'

const characterCreationRoute = '#/characters/new'
const characterPlayRoute = '#/characters/play'
const characterCreationStepCount = 6

function characterPlayRouteFromHash() {
  if (!window.location.hash.startsWith(characterPlayRoute)) return null
  return new URLSearchParams(window.location.hash.split('?')[1]).get('character')
}

function navigateToHash(hash: string) {
  window.location.hash = hash
}

function characterCreationRouteFromHash() {
  if (!window.location.hash.startsWith(characterCreationRoute)) return null

  const query = window.location.hash.split('?')[1]
  const params = new URLSearchParams(query)
  const step = Number(params.get('step'))

  return {
    step: !Number.isInteger(step) || step < 0 || step > characterCreationStepCount ? 0 : Math.min(step, characterCreationStepCount - 1),
    characterId: params.get('character'),
  }
}

function toCharacterCard(record: CharacterRecord): Character {
  const maxHp = record.max_hit_points ?? (Number(record.details.maxHp) || 0)
  return {
    id: record.id,
    name: record.name,
    level: record.level,
    race: record.race?.name ?? 'Raça não definida',
    characterClass: record.character_class?.name ?? 'Classe não definida',
    hp: record.details.playState?.currentHp ?? maxHp,
    maxHp,
    tempHp: record.details.playState?.temporaryHp ?? 0,
    portrait: record.portrait_url ?? '',
    landscape: record.details.sheetBackgroundUrl || '/images/backgrounds/forest-ranger.jpg',
    landscapePosition: '35% center',
    portraitPath: record.portrait_path ?? '',
    details: record.details,
    record,
  }
}

function Icon({ name }: { name: IconName }) {
  return (
    <span aria-hidden="true" className="icon material-symbols-rounded">
      {name}
    </span>
  )
}

function CharacterCard({
  character,
  onContinue,
  onEdit,
  onDelete,
}: {
  character: Character
  onContinue: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <article
      className="character-card"
      style={{
        '--character-landscape': `url("${character.landscape}")`,
        '--character-landscape-position': character.landscapePosition,
      } as CSSProperties}
    >
      <div className="character-card__glass">
        <header className="character-card__header">
          <img
            alt={`Retrato de ${character.name}`}
            className="character-card__portrait"
            src={character.portrait || '/images/trama-mark-sidebar.png'}
          />
          <div className="character-card__identity">
            <h2>{character.name}</h2>
            <p className="character-card__meta">
              <span>Nível {character.level}</span>
              <span>{character.race}</span>
              <span>{character.characterClass}</span>
            </p>
          </div>
          <dl className="character-card__vitals">
            <div>
              <dt>HP</dt>
              <dd>{character.hp}</dd>
            </div>
            <div>
              <dt>MAX</dt>
              <dd>{character.maxHp}</dd>
            </div>
            <div>
              <dt>TEMP</dt>
              <dd>{character.tempHp}</dd>
            </div>
          </dl>
        </header>

        <div className="character-card__actions">
          <Button className="character-card__continue" onClick={onContinue} size="small">
            Abrir ficha
            <Icon name="arrow_forward" />
          </Button>
          <Button
            aria-label={`Editar ${character.name}`}
            onClick={onEdit}
            size="icon"
            title="Editar personagem"
            variant="secondary"
          >
            <Icon name="edit" />
          </Button>
          <Button
            aria-label={`Excluir ${character.name}`}
            onClick={onDelete}
            size="icon"
            title="Excluir personagem"
            variant="danger"
          >
            <Icon name="delete" />
          </Button>
        </div>
      </div>
    </article>
  )
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.localStorage.getItem('trama-theme') === 'dark' ? 'dark' : 'light',
  )
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authError, setAuthError] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [accountDraft, setAccountDraft] = useState<CharacterDraft | null>(null)
  const [accountDataReady, setAccountDataReady] = useState(false)
  const [accountDataError, setAccountDataError] = useState('')
  const [characterPendingDeletion, setCharacterPendingDeletion] = useState<Character | null>(null)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const toast = useToast()
  const [signOutError, setSignOutError] = useState('')
  const [draftPromptOpen, setDraftPromptOpen] = useState(false)
  const [draftResetError, setDraftResetError] = useState('')
  const authenticatedUserId = useRef<string | null>(null)
  const [characterCreationStep, setCharacterCreationStep] = useState(() => characterCreationRouteFromHash()?.step ?? null)
  const [editingCharacterId, setEditingCharacterId] = useState(() => characterCreationRouteFromHash()?.characterId ?? null)
  const [furthestCharacterCreationStep, setFurthestCharacterCreationStep] = useState(() => characterCreationRouteFromHash()?.step ?? 0)
  const [playingCharacterId, setPlayingCharacterId] = useState(() => characterPlayRouteFromHash())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('trama-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null
      if (nextUserId !== authenticatedUserId.current) {
        authenticatedUserId.current = nextUserId
        setAccountDataReady(false)
        setAccountDataError('')
        setCharacters([])
        setAccountDraft(null)
      }
      setSession(nextSession)
      setAuthReady(true)
      setAuthError('')
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError('Não foi possível restaurar sua sessão. Tente entrar novamente.')
      setSession(data.session)
      setAuthReady(true)
    }).catch(() => {
      if (!active) return
      setAuthError('Não foi possível restaurar sua sessão. Tente entrar novamente.')
      setAuthReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user.id) return
    let active = true

    void Promise.all([loadCharacters(session.user.id), loadCharacterDraft(session.user.id)])
      .then(([records, draft]) => {
        if (!active) return
        setCharacters(records.map(toCharacterCard))
        setAccountDraft(draft)
        setFurthestCharacterCreationStep(Math.min(
          characterCreationStepCount - 1,
          Math.max(characterCreationRouteFromHash()?.step ?? 0, draft?.furthestStep ?? 0),
        ))
        setAccountDataReady(true)
      })
      .catch(() => {
        if (!active) return
        setAccountDataError('Não foi possível carregar os dados da sua conta. Confirme se as atualizações do banco foram aplicadas.')
        setAccountDataReady(true)
      })

    return () => { active = false }
  }, [session?.user.id])

  useEffect(() => {
    function syncRoute() {
      const route = characterCreationRouteFromHash()
      const playRoute = characterPlayRouteFromHash()
      setCharacterCreationStep(route?.step ?? null)
      setEditingCharacterId(route?.characterId ?? null)
      setPlayingCharacterId(playRoute)
      if (route) {
        setFurthestCharacterCreationStep((current) => Math.max(current, route.step))
      }
    }

    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  async function refreshAccountData() {
    if (!session?.user.id) return
    const [records, draft] = await Promise.all([
      loadCharacters(session.user.id),
      loadCharacterDraft(session.user.id),
    ])
    setCharacters(records.map(toCharacterCard))
    setAccountDraft(draft)
    setAccountDataError('')
    setAccountDataReady(true)
  }

  function openCharacterCreation() {
    if (accountDraft) {
      setDraftResetError('')
      setDraftPromptOpen(true)
      return
    }
    setEditingCharacterId(null)
    setFurthestCharacterCreationStep(0)
    navigateToHash(`${characterCreationRoute}?step=0`)
  }

  function resumeCharacterCreation() {
    if (!accountDraft) return
    const step = Math.min(characterCreationStepCount - 1, accountDraft.lastStep)
    setEditingCharacterId(null)
    setFurthestCharacterCreationStep(Math.min(characterCreationStepCount - 1, accountDraft.furthestStep))
    setDraftPromptOpen(false)
    navigateToHash(`${characterCreationRoute}?step=${step}`)
  }

  async function restartCharacterCreation() {
    if (!session?.user.id) return
    try {
      await deleteCharacterDraft(session.user.id)
      if (accountDraft?.character.portraitPath) {
        await deletePortrait(accountDraft.character.portraitPath).catch(() => undefined)
      }
    } catch {
      setDraftResetError('Não foi possível descartar o rascunho. Tente novamente ou retome a criação.')
      return
    }
    setEditingCharacterId(null)
    setAccountDraft(null)
    setDraftPromptOpen(false)
    setFurthestCharacterCreationStep(0)
    navigateToHash(`${characterCreationRoute}?step=0`)
  }

  function closeCharacterCreation() {
    navigateToHash('')
  }

  function returnToCharacters() {
    if (editingCharacterId) {
      void refreshAccountData().catch(() => {
        setAccountDataError('Não foi possível atualizar a lista de personagens.')
      }).finally(closeCharacterCreation)
      return
    }
    closeCharacterCreation()
  }

  function openCharacterEditor(character: Character) {
    if (!session?.user.id) return
    setEditingCharacterId(character.id)
    navigateToHash(`${characterCreationRoute}?step=0&character=${encodeURIComponent(character.id)}`)
  }

  function openCharacterPlay(character: Character) {
    setPlayingCharacterId(character.id)
    navigateToHash(`${characterPlayRoute}?character=${encodeURIComponent(character.id)}`)
  }

  async function savePlayedCharacter(id: string, details: CharacterDetails) {
    if (!session?.user.id) throw new Error('Sua sessão expirou.')
    const previousPortrait = characters.find((character) => character.id === id)?.portraitPath
    await saveCharacter(session.user.id, details, id)
    if (previousPortrait && previousPortrait !== details.portraitPath) {
      await deletePortrait(previousPortrait).catch(() => undefined)
    }
    const records = await loadCharacters(session.user.id)
    setCharacters(records.map(toCharacterCard))
  }

  async function removeCharacter(character: Character) {
    if (!session?.user.id) return
    try {
      await deleteOwnedCharacter(session.user.id, character.id)
      setCharacters((current) => current.filter(({ id }) => id !== character.id))
      setCharacterPendingDeletion(null)
      toast.success(`${character.name} foi excluído da sua conta.`)
    } catch {
      toast.error(`Não foi possível excluir ${character.name} da sua conta. Tente novamente.`)
    }
  }

  async function persistCharacterDraft(draft: Omit<CharacterDraft, 'id'> & { id?: string }) {
    if (!session?.user.id) throw new Error('Sua sessão expirou.')
    if (editingCharacterId) {
      await saveCharacter(session.user.id, draft.character, editingCharacterId)
      return { ...draft, id: editingCharacterId }
    }
    const savedDraft = await saveCharacterDraft(session.user.id, draft)
    setAccountDraft(savedDraft)
    return savedDraft
  }

  async function finishCharacterCreation(character: CharacterDetails, id: string) {
    if (!session?.user.id) throw new Error('Sua sessão expirou.')
    const previousPortrait = editingCharacterId
      ? characters.find((item) => item.id === editingCharacterId)?.portraitPath
      : undefined
    await saveCharacter(session.user.id, character, editingCharacterId ?? id)
    let draftCleanupFailed = false
    if (!editingCharacterId) {
      try {
        await deleteCharacterDraft(session.user.id)
        setAccountDraft(null)
      } catch {
        draftCleanupFailed = true
      }
    }
    if (previousPortrait && previousPortrait !== character.portraitPath) {
      await deletePortrait(previousPortrait).catch(() => undefined)
    }
    const records = await loadCharacters(session.user.id)
    setCharacters(records.map(toCharacterCard))
    setAccountDataError('')
    setAccountDataReady(true)
    if (draftCleanupFailed) toast.error(`A ficha de ${character.name} foi salva, mas não foi possível remover o rascunho concluído.`)
    navigateToHash('')
  }

  function selectSidebarSection(section: SidebarSection) {
    if (section === 'characters') {
      returnToCharacters()
      return
    }

    if (section === 'profile') {
      setSignOutError('')
      setAccountDialogOpen(true)
      return
    }

    const labels = {
      campaigns: 'Campanhas',
      tormenta20: 'Tormenta20',
      vampire: 'Vampiro: A Máscara',
      daggerheart: 'Daggerheart',
      settings: 'Configurações',
    }
    toast.info(`${labels[section]} estarão disponíveis em breve.`)
  }

  async function signOut() {
    if (!supabase || signingOut) return
    setSigningOut(true)
    setSignOutError('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setSignOutError('Não foi possível sair da conta. Tente novamente.')
        return
      }
      setAccountDialogOpen(false)
    } catch {
      setSignOutError('Não foi possível sair da conta. Tente novamente.')
    } finally {
      setSigningOut(false)
    }
  }

  function renderAccountDialog() {
    if (!accountDialogOpen) return null
    return (
      <Modal
        footer={(
          <Button disabled={signingOut} onClick={signOut} variant="secondary">
            {signingOut ? 'Saindo…' : 'Sair da conta'}
          </Button>
        )}
        onClose={() => setAccountDialogOpen(false)}
        open={accountDialogOpen}
        theme={theme}
        title="Sua conta"
      >
        <p>{session?.user.email}</p>
        {signOutError && <p className="account-dialog__error" role="alert">{signOutError}</p>}
      </Modal>
    )
  }

  if (!authReady) {
    return <main className="auth-loading" role="status">Verificando sua sessão…</main>
  }

  if (!session) {
    return <AuthScreen client={supabase} initialError={authError} />
  }

  if (!accountDataReady) {
    return <main className="auth-loading" role="status">Carregando os dados da sua conta…</main>
  }

  if (accountDataError) {
    return (
      <main className="account-data-error">
        <p role="alert">{accountDataError}</p>
        <Button onClick={() => {
          setAccountDataReady(false)
          void refreshAccountData().catch(() => setAccountDataReady(true))
        }}>Tentar novamente</Button>
      </main>
    )
  }

  if (playingCharacterId) {
    const playingCharacter = characters.find((item) => item.id === playingCharacterId)
    if (!playingCharacter) {
      return <main className="account-data-error"><p role="alert">Esse personagem não está disponível nesta conta.</p><Button onClick={() => navigateToHash('')}>Voltar à lista</Button></main>
    }
    return <CharacterPlaySheet
      character={playingCharacter.details}
      characterClass={playingCharacter.characterClass}
      race={playingCharacter.race}
      background={playingCharacter.record.background?.name ?? 'Antecedente não definido'}
      portrait={playingCharacter.portrait}
      landscape={playingCharacter.landscape}
      onBack={() => {
        setPlayingCharacterId(null)
        navigateToHash('')
      }}
      onSave={(details) => savePlayedCharacter(playingCharacter.id, details)}
      onUploadPortrait={(file) => {
        if (!session?.user.id) throw new Error('Sua sessão expirou.')
        return uploadPortrait(session.user.id, file)
      }}
      onUploadBackground={(file) => {
        if (!session?.user.id) throw new Error('Sua sessão expirou.')
        return uploadCharacterBackground(session.user.id, file)
      }}
      onLoadBackgrounds={() => {
        if (!session?.user.id) throw new Error('Sua sessão expirou.')
        return listCharacterBackgrounds(session.user.id)
      }}
    />
  }

  if (characterCreationStep !== null) {
    const editingCharacter = editingCharacterId
      ? characters.find((item) => item.id === editingCharacterId)
      : undefined

    if (editingCharacterId && !editingCharacter) {
      return (
        <main className="account-data-error">
          <p role="alert">Esse personagem não está disponível nesta conta.</p>
          <Button onClick={closeCharacterCreation}>Voltar à lista</Button>
        </main>
      )
    }

    return (
      <>
        {renderAccountDialog()}
        <CharacterCreationWizard
          characterId={editingCharacterId}
          initialCharacterData={editingCharacter ? {
            ...editingCharacter.details,
            portraitPath: editingCharacter.portraitPath,
            portraitUrl: editingCharacter.portrait,
          } : undefined}
          initialDraft={editingCharacterId ? null : accountDraft}
          initialStep={characterCreationStep}
          lastReachedStep={furthestCharacterCreationStep}
          onComplete={finishCharacterCreation}
          onClose={returnToCharacters}
          onDeletePortrait={deletePortrait}
          onPersistDraft={persistCharacterDraft}
          onSidebarSelect={selectSidebarSection}
          theme={theme}
          onToggleTheme={toggleTheme}
          onStepChange={(step) => {
            setFurthestCharacterCreationStep((current) => Math.max(current, step))
            const editQuery = editingCharacterId ? `&character=${encodeURIComponent(editingCharacterId)}` : ''
            navigateToHash(`${characterCreationRoute}?step=${step}${editQuery}`)
          }}
          onUploadPortrait={(file) => uploadPortrait(session.user.id, file)}
        />
      </>
    )
  }

  return (
    <main className="home-page">
      {characterPendingDeletion && <Modal
        open={characterPendingDeletion !== null}
        title="Excluir personagem?"
        theme={theme}
        onClose={() => setCharacterPendingDeletion(null)}
        footer={<>
          <Button onClick={() => setCharacterPendingDeletion(null)} variant="secondary">Cancelar</Button>
          <Button onClick={() => characterPendingDeletion && void removeCharacter(characterPendingDeletion)} variant="danger">Excluir personagem</Button>
        </>}
      >
        <p>Excluir {characterPendingDeletion?.name}? Esta ação não pode ser desfeita.</p>
      </Modal>}
      {renderAccountDialog()}
      {draftPromptOpen && <Modal
        footer={<>
          <Button variant="ghost" onClick={() => setDraftPromptOpen(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={restartCharacterCreation}>Começar do zero</Button>
          <Button autoFocus onClick={resumeCharacterCreation}>Retomar criação</Button>
        </>}
        onClose={() => setDraftPromptOpen(false)}
        open={draftPromptOpen}
        theme={theme}
        title="Retomar criação?"
      >
        <p>Você já tem um personagem em criação. Deseja retomar de onde parou ou começar do zero?</p>
        <p className="draft-dialog__warning">Começar do zero descarta o rascunho atual.</p>
        {draftResetError && <p role="alert">{draftResetError}</p>}
      </Modal>}
      <img
        alt=""
        aria-hidden="true"
        className="home-page__art home-page__art--left"
        src="/images/character-list-art-left.png"
      />
      <img
        alt=""
        aria-hidden="true"
        className="home-page__art home-page__art--right"
        src="/images/character-list-art-right.png"
      />
      <AppSidebar onSelect={selectSidebarSection} theme={theme} onToggleTheme={toggleTheme} />
      <div className="home-shell">
        <section aria-labelledby="welcome-title" className="welcome-row">
          <h1 id="welcome-title">Bem-vindo de volta, <em>{session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'aventureiro'}</em></h1>
          <Button
            onClick={openCharacterCreation}
            size="small"
          >
            Criar personagem
          </Button>
        </section>

        {characters.length > 0 && <section aria-label="Personagens" className="character-grid">
          {characters.map((character) => (
            <CharacterCard
              character={character}
              key={character.id}
              onContinue={() => openCharacterPlay(character)}
              onEdit={() => openCharacterEditor(character)}
              onDelete={() => setCharacterPendingDeletion(character)}
            />
          ))}
        </section>}

        {characters.length === 0 && (
          <section aria-label="Lista de personagens vazia" className="empty-state">
            <img
              alt="Aventureiro carregando pergaminhos e livros"
              className="empty-state__art"
              src="/images/character-list-empty.png"
            />
            <p>Você ainda não tem personagens. Crie uma ficha para começar.</p>
          </section>
        )}

      </div>
    </main>
  )
}

export default App
