import React from 'react'
import { Dev } from '../types'

interface GlobalCapacityProps {
  globalCapacity: string
  setGlobalCapacity: React.Dispatch<React.SetStateAction<string>>
  devs: Dev[]
  setDevs: React.Dispatch<React.SetStateAction<Dev[]>>
}

export default function GlobalCapacity({
  globalCapacity,
  setGlobalCapacity,
  devs,
  setDevs,
}: GlobalCapacityProps) {
  return (
    <div className="flex flex-col">
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Nova capacidade para todos"
          value={globalCapacity}
          onChange={(e) => setGlobalCapacity(e.target.value)}
          className="border p-2 rounded w-80 bg-white dark:bg-gray-800 dark:border-gray-700"
        />
        <button
          onClick={() => {
            const value = Number(globalCapacity)
            if (!isNaN(value) && value > 0) {
              const updated = devs.map(dev => ({ ...dev, capacity: value }))
              setDevs(updated)
              setGlobalCapacity('')
            }
          }}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
