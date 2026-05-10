import React from 'react'
import { Sun, Moon, Cog, UserCircle } from 'lucide-react'

type Theme = 'light' | 'dark'

interface HeaderProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  setShowSettings: (show: boolean) => void
  showAuthPanel: boolean
  setShowAuthPanel: (show: boolean) => void
  authDisplayName: string
  authRole: string
  authMenu: React.ReactNode
}

export default function Header({
  theme,
  setTheme,
  setShowSettings,
  showAuthPanel,
  setShowAuthPanel,
  authDisplayName,
  authRole,
  authMenu,
}: HeaderProps) {
  const authMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!showAuthPanel) return

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target

      if (target instanceof Node && authMenuRef.current?.contains(target)) {
        return
      }

      setShowAuthPanel(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('touchstart', closeOnOutsideClick)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('touchstart', closeOnOutsideClick)
    }
  }, [setShowAuthPanel, showAuthPanel])

  return (
    <header className="flex items-center justify-between mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
      <h1 className="text-xl font-bold text-green-800 dark:text-green-100">Dev-Tools</h1>

      <div className="flex items-center gap-2">
        <div ref={authMenuRef} className="relative flex items-center gap-2">
          {authDisplayName && (
            <div className="max-w-[96px] text-right leading-tight sm:max-w-[220px]">
              <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{authDisplayName}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{authRole}</p>
            </div>
          )}
          <button
            onClick={() => setShowAuthPanel(!showAuthPanel)}
            className={`p-2 rounded-md transition ${
              showAuthPanel
                ? 'bg-green-700 text-white hover:bg-green-800'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={showAuthPanel ? 'Fechar login' : 'Abrir login'}
            aria-pressed={showAuthPanel}
          >
            <UserCircle size={20} />
          </button>
          {showAuthPanel && (
            <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-md rounded-lg bg-white p-3 shadow-xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10 sm:w-96">
              {authMenu}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          title="Abrir configuracoes"
        >
          <Cog size={20} />
        </button>

        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          title="Alternar tema"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
    </header>
  )
}
