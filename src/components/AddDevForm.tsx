import React from 'react'
import { Save } from 'lucide-react'
type Dev = {
  name: string
  capacity: string
}

interface AddDevFormProps {
  newDev: Dev
  setNewDev: (dev: Dev) => void
  addDev: () => void
}

export default function AddDevForm({ newDev, setNewDev, addDev }: AddDevFormProps) {
  return (
    <div className="flex gap-4">
      <input
        placeholder="Novo Dev"
        value={newDev.name}
        onChange={e => setNewDev({ ...newDev, name: e.target.value })}
        className="border p-2 rounded w-1/2 bg-white dark:bg-gray-800 dark:border-gray-700"
      />
      <input
        type="number"
        placeholder="Capacidade"
        value={newDev.capacity}
        onChange={e => setNewDev({ ...newDev, capacity: e.target.value })}
        className="border p-2 rounded w-1/2 bg-white dark:bg-gray-800 dark:border-gray-700"
      />
      <button onClick={addDev} className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600">
        <Save size={20} />
      </button>
    </div>
  )
}
