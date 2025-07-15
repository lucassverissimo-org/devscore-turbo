import React, { useState, useEffect } from 'react'
import { Sun, Moon, Cog, Save } from 'lucide-react'
import { useTheme } from './ThemeProvider.jsx'
import { createClient } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

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
  const { theme, setTheme } = useTheme()

  const [showSettings, setShowSettings] = useState(false)

  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [devs, setDevs] = useState([]) 
  const [newDev, setNewDev] = useState({ name: '', capacity: '' })
  const [customPointsMap, setCustomPointsMap] = useState({})
  const [globalCapacity, setGlobalCapacity] = useState('')

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase.from('Teams').select('*')
      if (error) {
        console.error('Erro ao buscar times:', error)
      } else {
        setTeams(data)
        if (data.length > 0) {
          setSelectedTeamId(data[0].id) // seleciona o primeiro por padrão
        }
      }
    }
    fetchTeams()
  }, [])

  useEffect(() => {
    const fetchDevs = async () => {
      if (!selectedTeamId) return

      const { data, error } = await supabase
        .from('Devs')
        .select('*')
        .eq('idTeam', selectedTeamId)
        .order("name",{ascending:true})

      if (error) {
        console.error('Erro ao buscar devs:', error)
      } else {
        const formattedDevs = data.map(dev => ({
          ...dev,
          capacity: dev.capacity || 14, // valor padrão caso não venha do Supabase
          points: 0,
          history: [],
          customPoints: '',
        }))
        setDevs(formattedDevs)
      }
      setSelectedTeam(teams.find(t => t.id == selectedTeamId))
    }

    fetchDevs()
  }, [selectedTeamId])

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

  const getPointValues = () => {
    const selectedTeam = teams.find(t => t.id == selectedTeamId)
    if (!selectedTeam) return []

    return selectedTeam.pointsType === 'hrs'
      ? [4, 8, 12, 16, 20, 24, 28, 32, 36, 40]
      : [1, 2, 3, 5, 8, 13]
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
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

        <h1 className="text-2xl font-bold flex items-center gap-2">
          <img
            src={theme === 'dark' ? '/DS_white.png' : '/DS_black.png' }
            alt="DevScore logo"
            width={120}
            height={120}
            className="inline-block"
          />
          Distribuição de Pontos
        </h1>

        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium">Time</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.pointsType})
                </option>
              ))}
            </select>
          </div>

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
          </div>
        </div>

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

        <div className="space-y-4">
          {devs.map((dev, idx) => {
            const percent = Math.floor((dev.points / dev.capacity) * 100)
            const color = getColor(percent)

            return (
              <div key={`${selectedTeamId}-${idx}`} className="p-4 bg-white dark:bg-gray-800 shadow rounded transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <strong>{dev.name}</strong>
                  <button onClick={() => removeDev(idx)} className="text-red-500 hover:underline text-sm">
                    Remover
                  </button>
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span>{dev.points} / {dev.capacity} {selectedTeam.pointsType} </span>
                  <input
                    type="number"
                    value={dev.capacity}
                    onChange={e => updateCapacity(idx, e.target.value)}
                    className="border p-1 rounded w-24 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-4 overflow-hidden mb-2">
                  <div className={`h-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                </div>

                <div className="flex gap-2 flex-wrap mb-2">
                  {getPointValues().map(val => (
                    <button
                      key={val}
                      onClick={() => addPoints(idx, val)}
                      className="bg-gray-200 dark:bg-gray-600 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      +{val}
                    </button>
                  ))}
                  <input
                    type="number"
                    placeholder="Personalizado"
                    className="border p-1 rounded w-36 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
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
                        setCustomPointsMap(prev => ({ ...prev, [idx]: '' }))
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
                        <span>{entry.value > 0 ? '+' : ''}{entry.value} {selectedTeam.pointsType}</span>
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
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Configurações</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Em breve você poderá configurar opções aqui.</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
