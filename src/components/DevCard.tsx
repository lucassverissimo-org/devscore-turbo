import React from 'react'
import { getColor } from '../lib/utils/colors'
import { getPointValues } from '../lib/utils/getPointValues'
import { Dev, Team } from '../types'


interface DevCardProps {
  dev: Dev
  index: number
  selectedTeam: Team
  updateCapacity: (index: number, value: string) => void
  addPoints: (index: number, value: number) => void
  customPointsMap: Record<number, string>
  setCustomPointsMap: React.Dispatch<React.SetStateAction<Record<number, string>>>
  removeDev: (index: number) => void
  removeHistoryItem: (devIndex: number, histIndex: number) => void
}

export default function DevCard({
  dev,
  index,
  selectedTeam,
  updateCapacity,
  addPoints,
  customPointsMap,
  setCustomPointsMap,
  removeDev,
  removeHistoryItem,
}: DevCardProps) {
  const percent = Math.floor((dev.points / dev.capacity) * 100)
  const color = getColor(percent)

  return (
    <div className="p-4 bg-white dark:bg-gray-800 shadow rounded transition-colors">
      <div className="flex justify-between items-center mb-2">
        <strong>{dev.name}</strong>
        <button onClick={() => removeDev(index)} className="text-red-500 hover:underline text-sm">
          Remover
        </button>
      </div>

      <div className="flex justify-between items-center mb-2">
        <span>
          {dev.points} / {dev.capacity} {selectedTeam.pointsType}
        </span>
        <input
          type="number"
          value={dev.capacity}
          onChange={e => updateCapacity(index, e.target.value)}
          className="border p-1 rounded w-24 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
        />
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-4 overflow-hidden mb-2">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
      </div>

      <div className="flex gap-2 flex-wrap mb-2">
        {getPointValues(selectedTeam.pointsType).map(val => (
          <button
            key={val}
            onClick={() => addPoints(index, val)}
            className="bg-gray-200 dark:bg-gray-600 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            +{val}
          </button>
        ))}
        <input
          type="number"
          placeholder="Personalizado"
          className="border p-1 rounded w-36 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
          onChange={e => {
            const value = e.target.value
            setCustomPointsMap(prev => ({ ...prev, [index]: value }))
          }}
          value={customPointsMap[index] || ''}
        />
        <button
          onClick={() => {
            const value = Number(customPointsMap[index])
            if (!isNaN(value) && value !== 0) {
              addPoints(index, value)
              setCustomPointsMap(prev => ({ ...prev, [index]: '' }))
            }
          }}
          className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-sm"
        >
          ➕
        </button>
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400">Ver histórico</summary>
        <ul className="mt-2 text-sm space-y-1">
          {dev.history.map((entry, i) => (
            <li key={i} className="flex justify-between items-center">
              <span>
                {entry.value > 0 ? '+' : ''}
                {entry.value} {selectedTeam.pointsType}
              </span>
              <button
                onClick={() => removeHistoryItem(index, i)}
                className="text-xs text-red-500 hover:underline"
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}