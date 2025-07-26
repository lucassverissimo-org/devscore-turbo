import React from 'react'

export default function Summary({ devs, selectedTeam }) {
  const totalCap = devs.reduce((sum, d) => sum + d.capacity, 0)
  const totalPoints = devs.reduce((sum, d) => sum + d.points, 0)

  return (
    <div className="mt-8 p-4 bg-white dark:bg-gray-800 shadow rounded space-y-2">
      <h2 className="text-lg font-semibold">Resumo</h2>
      <p><strong>Capacidade geral:</strong> {totalCap}</p>
      <p><strong>Pontos alocados:</strong> {totalPoints}</p>
      <p><strong>{selectedTeam?.pointsType || 'Pontos'} disponíveis:</strong> {totalCap - totalPoints}</p>
      <p><strong>Devs disponíveis:</strong> {devs.filter(d => d.points < d.capacity).map(d => d.name).join(', ') || 'Nenhum'}</p>
      <p><strong>Devs sobrecarregados:</strong> {devs.filter(d => d.points > d.capacity).map(d => d.name).join(', ') || 'Nenhum'}</p>
    </div>
  )
}
