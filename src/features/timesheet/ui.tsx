import React from 'react'
export const panelClass =
  'rounded-lg bg-white dark:bg-gray-800 shadow p-4 space-y-4'
export const inputClass =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100'
export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${variant === 'primary' ? 'bg-green-700 text-white hover:bg-green-800' : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'} ${className}`}
    >
      {children}
    </button>
  )
}
export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode
  error?: boolean
}) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`rounded border p-3 text-sm ${error ? 'border-red-400 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100' : 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'}`}
    >
      {children}
    </div>
  )
}
