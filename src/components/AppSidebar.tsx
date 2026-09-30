import './AppSidebar.css'

export type SidebarSection =
  | 'characters'
  | 'tormenta20'
  | 'vampire'
  | 'daggerheart'
  | 'campaigns'
  | 'settings'
  | 'profile'

function SidebarIcon({ name }: { name: string }) {
  return <span aria-hidden="true" className="sidebar__icon material-symbols-rounded">{name}</span>
}

export function AppSidebar({ onSelect, theme, onToggleTheme }: {
  onSelect: (section: SidebarSection) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  return (
    <aside aria-label="Navegação principal" className="sidebar">
      <button
        aria-label="Início do Trama Sheet"
        className="sidebar__logo"
        data-tooltip="Início do Trama Sheet"
        onClick={() => onSelect('characters')}
        type="button"
      >
        <img alt="" src="/images/trama-mark.png" />
      </button>

      <div aria-hidden="true" className="sidebar__divider" />

      <nav aria-label="Sistemas e campanhas" className="sidebar__nav">
        <button
          aria-label="Personagens de D&D"
          aria-current="page"
          className="sidebar__item sidebar__item--active"
          data-tooltip="Personagens de D&D"
          onClick={() => onSelect('characters')}
          type="button"
        >
          <img alt="" className="sidebar__dnd-logo" src="/images/dungeons-dragons-full.png" />
        </button>
        <button
          aria-label="Tormenta20 — disponível em breve"
          className="sidebar__item sidebar__item--soon"
          data-name="Tormenta20"
          data-status="Disponível em breve"
          onClick={() => onSelect('tormenta20')}
          type="button"
        >
          <img alt="" className="sidebar__system-logo" src="/images/systems/tormenta20.png" />
        </button>
        <button
          aria-label="Vampiro: A Máscara — disponível em breve"
          className="sidebar__item sidebar__item--soon"
          data-name="Vampiro: A Máscara"
          data-status="Disponível em breve"
          onClick={() => onSelect('vampire')}
          type="button"
        >
          <img alt="" className="sidebar__system-logo" src="/images/systems/vampire.png" />
        </button>
        <button
          aria-label="Daggerheart — disponível em breve"
          className="sidebar__item sidebar__item--soon"
          data-name="Daggerheart"
          data-status="Disponível em breve"
          onClick={() => onSelect('daggerheart')}
          type="button"
        >
          <img alt="" className="sidebar__system-logo" src="/images/systems/daggerheart.png" />
        </button>
        <button
          aria-label="Campanhas"
          className="sidebar__item"
          data-tooltip="Campanhas"
          onClick={() => onSelect('campaigns')}
          type="button"
        >
          <SidebarIcon name="map" />
        </button>
      </nav>

      <div className="sidebar__spacer" />

      <button
        aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
        aria-pressed={theme === 'dark'}
        className="sidebar__theme-toggle"
        data-tooltip={`Modo ${theme === 'dark' ? 'escuro' : 'claro'}`}
        onClick={onToggleTheme}
        type="button"
      >
        <SidebarIcon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
      </button>
      <button
        aria-label="Configurações"
        className="sidebar__item"
        data-tooltip="Configurações"
        onClick={() => onSelect('settings')}
        type="button"
      >
        <SidebarIcon name="settings" />
      </button>
      <button
        aria-label="Perfil"
        className="sidebar__item sidebar__profile"
        data-tooltip="Perfil"
        onClick={() => onSelect('profile')}
        type="button"
      >
        <SidebarIcon name="person" />
      </button>
    </aside>
  )
}
