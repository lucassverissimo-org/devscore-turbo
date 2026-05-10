import React from 'react'
import { LogIn, LogOut, UserPlus } from 'lucide-react'
import type { UserRole } from '../types'

type AuthMode = 'sign-in' | 'sign-up'

type AuthPanelProps = {
  userEmail: string
  userName: string
  role: UserRole | null
  canEditSprintPlanning: boolean
  isLoadingProfile: boolean
  message: string
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string, fullName: string) => Promise<void>
  onSignOut: () => Promise<void>
}

export default function AuthPanel({
  userEmail,
  userName,
  role,
  canEditSprintPlanning,
  isLoadingProfile,
  message,
  onSignIn,
  onSignUp,
  onSignOut,
}: AuthPanelProps) {
  const [mode, setMode] = React.useState<AuthMode>('sign-in')
  const [fullName, setFullName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      if (mode === 'sign-in') {
        await onSignIn(email, password)
      } else {
        await onSignUp(email, password, fullName)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (userEmail) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{userName || userEmail}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {isLoadingProfile
                ? 'Carregando perfil...'
                : `Perfil ${role ?? 'USER'} - ${canEditSprintPlanning ? 'edicao da Sprint liberada' : 'somente leitura na Sprint'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-gray-100 px-3 text-sm text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{message}</p>}
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30"
    >
      <div className="grid gap-2">
        {mode === 'sign-up' && (
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-600 dark:text-gray-300">Nome</span>
            <input
              type="text"
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              className="h-10 w-full rounded border bg-white p-2 dark:border-gray-600 dark:bg-gray-700"
              required
            />
          </label>
        )}
        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="h-10 w-full rounded border bg-white p-2 dark:border-gray-600 dark:bg-gray-700"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-300">Senha</span>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="h-10 w-full rounded border bg-white p-2 dark:border-gray-600 dark:bg-gray-700"
            minLength={6}
            required
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-blue-500 px-3 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === 'sign-in' ? <LogIn size={16} /> : <UserPlus size={16} />}
          {isSubmitting ? 'Aguarde' : mode === 'sign-in' ? 'Entrar' : 'Criar conta'}
        </button>
        <button
          type="button"
          onClick={() => setMode(current => (current === 'sign-in' ? 'sign-up' : 'sign-in'))}
          className="inline-flex h-10 items-center justify-center rounded bg-gray-100 px-3 text-sm text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          {mode === 'sign-in' ? 'Nova conta' : 'Ja tenho login'}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
        Login necessario para editar a guia Sprint. Novas contas entram como USER.
      </p>
      {message && <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{message}</p>}
    </form>
  )
}
