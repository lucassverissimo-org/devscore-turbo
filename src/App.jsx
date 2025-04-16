import React, { useState } from 'react'

const colors = [
  { max: 20, color: 'bg-blue-500' },
  { max: 75, color: 'bg-yellow-400' },
  { max: 99, color: 'bg-orange-400' },
  { max: 100, color: 'bg-green-500'},
  { max: Infinity, color: 'bg-red-500' },
]

function getColor(percent) {
  return colors.find(c => percent <= c.max).color
}

export default function App() {
  const [devs, setDevs] = useState([
    { name: 'Lucas', capacity: 12, points: 0, history: [],customPoints: '' },
    { name: 'Samuel', capacity: 12, points: 0, history: [],customPoints: ''  },
    { name: 'Ivan', capacity: 12, points: 0, history: [],customPoints: ''  },
    { name: 'João Victor', capacity: 12, points: 0, history: [],customPoints: ''  },
  ])
  const [newDev, setNewDev] = useState({ name: '', capacity: '' })
  const [customPointsMap, setCustomPointsMap] = useState({})
  const [globalCapacity, setGlobalCapacity] = useState('')
  const addDev = () => {
    if (!newDev.name || !newDev.capacity) return
    setDevs([
      ...devs,
      {
        ...newDev,
        capacity: Number(newDev.capacity),
        points: 0,
        history: [],
        customPoints: '',
      },
    ])
    setNewDev({ name: '', capacity: '' })
  }

  const updateDev = (index, updatedDev) => {
    const updated = [...devs]
    updated[index] = { ...updated[index], ...updatedDev }
    setDevs(updated)
  }

  const addPoints = (index, value) => {
    const dev = devs[index]
    const updatedPoints = dev.points + value
    const updatedHistory = [
      ...dev.history,
      { value, timestamp: new Date().toISOString() },
    ]
    updateDev(index, { points: updatedPoints, history: updatedHistory })
  }

  const removeDev = (index) => {
    const updated = [...devs]
    updated.splice(index, 1)
    setDevs(updated)
  }

  const updateCapacity = (index, value) => {
    const newCapacity = Number(value)
    if (!isNaN(newCapacity)) {
      updateDev(index, { capacity: newCapacity })
    }
  }

  const removeHistoryItem = (devIndex, historyIndex) => {
    const dev = devs[devIndex]
    const removed = dev.history[historyIndex]
    const newPoints = dev.points - removed.value
    const newHistory = dev.history.filter((_, i) => i !== historyIndex)
    updateDev(devIndex, { points: newPoints, history: newHistory })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Distribuição de Pontos</h1>
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Nova capacidade para todos"
          value={globalCapacity}
          onChange={(e) => setGlobalCapacity(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <button
          onClick={() => {
            const value = Number(globalCapacity)
            if (!isNaN(value) && value > 0) {
              const updated = devs.map(dev => ({
                ...dev,
                capacity: value
              }))
              setDevs(updated)
              setGlobalCapacity('')
            }
          }}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Aplicar
        </button>
      </div>
      <div className="flex gap-4">
        <input
          placeholder="Nome"
          value={newDev.name}
          onChange={e => setNewDev({ ...newDev, name: e.target.value })}
          className="border p-2 rounded w-1/2"
        />
        <input
          type="number"
          placeholder="Capacidade"
          value={newDev.capacity}
          onChange={e => setNewDev({ ...newDev, capacity: e.target.value })}
          className="border p-2 rounded w-1/2"
        />
        <button onClick={addDev} className="bg-blue-500 text-white px-4 rounded">
          Adicionar
        </button>
      </div>

      <div className="space-y-4">
        {devs.map((dev, idx) => {
          const percent = Math.floor((dev.points / dev.capacity) * 100)
          const color = getColor(percent)

          return (
            <div key={idx} className="p-4 bg-white shadow rounded">
              <div className="flex justify-between items-center mb-2">
                <strong>{dev.name}</strong>
                <button onClick={() => removeDev(idx)} className="text-red-500 hover:underline text-sm">
                  Remover
                </button>
              </div>

              <div className="flex justify-between items-center mb-2">
                <span>{dev.points} / {dev.capacity} pts</span>
                <input
                  type="number"
                  value={dev.capacity}
                  onChange={e => updateCapacity(idx, e.target.value)}
                  className="border p-1 rounded w-24 text-sm"
                />
              </div>

              <div className="w-full bg-gray-200 rounded h-4 overflow-hidden mb-2">
                <div className={`h-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
              </div>

              <div className="flex gap-2 flex-wrap mb-2">
                {[1, 2, 3, 5, 8, 13].map(val => (
                  <React.Fragment key={val}>
                    <button
                      onClick={() => addPoints(idx, val)}
                      className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                    >
                      +{val}
                    </button>
                    
                  </React.Fragment>
                ))}
                <input
                    type="number"
                    placeholder="Personalizado"
                    className="border p-1 rounded w-36 text-sm"
                    onChange={(e) => {
                      const value = e.target.value
                      setCustomPointsMap(prev => ({ ...prev, [idx]: value }))
                    }}
                    value={customPointsMap[idx] || ''}
                  />
                  <button
                    onClick={() => {
                      const value = Number(customPointsMap[idx])
                      if (!isNaN(value) && value !== 0) {
                        addPoints(idx, value)
                        setCustomPointsMap(prev => ({ ...prev, [idx]: '' })) // limpa o campo
                      }
                    }}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 text-sm"
                  >
                    Adicionar
                  </button>
              </div>

              <details>
                <summary className="cursor-pointer text-sm text-blue-600">Ver histórico</summary>
                <ul className="mt-2 text-sm space-y-1">
                  {dev.history.map((entry, i) => (
                    <li key={i} className="flex justify-between items-center">
                      <span>{entry.value > 0 ? '+' : ''}{entry.value} pts</span>
                      <button
                        onClick={() => removeHistoryItem(idx, i)}
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
        })}
      </div>
    </div>
  )
}
