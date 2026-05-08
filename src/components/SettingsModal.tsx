import React from 'react'

interface SettingsModalProps {
  isSprintEnabled: boolean
  setIsSprintEnabled: (enabled: boolean) => void
  onClose: () => void
}

export default function SettingsModal({
  isSprintEnabled,
  setIsSprintEnabled,
  onClose,
}: SettingsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-96">
        <h2 className="text-lg font-bold mb-4">Configuracoes</h2>

        <label className="flex items-center justify-between gap-4 rounded border border-gray-200 p-3 dark:border-gray-700">
          <span className="text-sm font-medium">Guia Sprint</span>
          <input
            type="checkbox"
            checked={isSprintEnabled}
            onChange={event => setIsSprintEnabled(event.target.checked)}
            className="h-5 w-5"
          />
        </label>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
