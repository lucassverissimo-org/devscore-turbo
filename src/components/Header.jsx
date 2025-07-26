import React from 'react'
import { Sun, Moon, Cog } from 'lucide-react'

export default function Header({ theme, setTheme, setShowSettings }) {
  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={() => setShowSettings(true)}
        className="p-2 rounded bg-gray-200 dark:bg-gray-700 text-black dark:text-white transition"
      >
        <Cog size={20} />
      </button>
      <button
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="p-2 rounded bg-gray-200 dark:bg-gray-700 text-black dark:text-white transition"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>
    </div>
  )
}
