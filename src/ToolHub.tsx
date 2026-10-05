import React, { useEffect, useState } from 'react'
import App from './App'
import Timesheet from './features/timesheet/Timesheet'
import { useTheme } from './ThemeProvider'
import { resolveToolPath } from './lib/toolRouting'
const links = [
  ['/', 'Ferramentas'],
  ['/devscore', 'DevScore'],
  ['/timesheet', 'Jira Sprint Timesheet Helper'],
] as const
export default function ToolHub() {
  const [path, setPath] = useState(() => {
    const initialPath = resolveToolPath(
      window.location.pathname,
      window.location.search
    )
    if (initialPath === '/devscore' && window.location.pathname === '/')
      window.history.replaceState(
        null,
        '',
        initialPath + window.location.search + window.location.hash
      )
    return initialPath
  })
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    const onPop = () =>
      setPath(window.location.pathname.replace(/\/$/, '') || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return
    event.preventDefault()
    window.history.pushState(null, '', href)
    setPath(href)
    window.scrollTo(0, 0)
  }
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <nav
        aria-label="Navegação principal"
        className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
      >
        {links.map(([href, label]) => (
          <a
            key={href}
            href={href}
            aria-current={path === href ? 'page' : undefined}
            onClick={(event) => navigate(event, href)}
            className={`rounded px-3 py-2 text-sm font-semibold ${path === href ? 'bg-green-700 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {label}
          </a>
        ))}
        <button
          className="ml-auto rounded px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          Tema {theme === 'dark' ? 'claro' : 'escuro'}
        </button>
      </nav>
      {path === '/devscore' ? (
        <App />
      ) : (
        <main className="max-w-7xl mx-auto p-4 md:p-6">
          {path === '/timesheet' ? (
            <Timesheet />
          ) : path === '/' ? (
            <>
              <h1 className="text-3xl font-bold text-green-800 dark:text-green-100 mb-2">
                Dev Tools
              </h1>
              <p className="mb-6 text-gray-600 dark:text-gray-300">
                Ferramentas para planejamento e acompanhamento do trabalho do
                time.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {links.slice(1).map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={(event) => navigate(event, href)}
                    className="block rounded-lg p-6 bg-white dark:bg-gray-800 shadow hover:ring-2 hover:ring-green-600"
                  >
                    <h2 className="text-xl font-semibold mb-2">{label}</h2>
                    <p>
                      {href === '/devscore'
                        ? 'Ajuda na distribuição e planejamento de tasks entre o time.'
                        : 'Ajuda na análise da Sprint e preparação de apontamentos Jira.'}
                    </p>
                    <span className="inline-block mt-4 text-green-700 dark:text-green-300 font-semibold">
                      Abrir ferramenta →
                    </span>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl">Página não encontrada</h1>
              <a href="/" onClick={(event) => navigate(event, '/')}>
                Voltar às ferramentas
              </a>
            </>
          )}
        </main>
      )}
    </div>
  )
}
