import React from 'react'
import { Sun, Moon, Cog } from 'lucide-react'

type Theme = 'light' | 'dark'

interface HeaderProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  setShowSettings: (show: boolean) => void
}

export default function Header({ theme, setTheme, setShowSettings }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
      <h1 className="text-xl font-bold text-green-800 dark:text-green-100">
        Distribuição de Pontos
      </h1>

      <div className="flex gap-2">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          title="Abrir configurações"
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
