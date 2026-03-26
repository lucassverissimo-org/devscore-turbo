import React from 'react'
import { Dev, PointsType } from '../types'

interface SummaryProps {
  devs: Dev[]
  pointsType: PointsType
}

export default function Summary({ devs, pointsType }: SummaryProps) {
  const totalCap = devs.reduce((sum, d) => sum + d.capacity, 0)
  const totalPoints = devs.reduce((sum, d) => sum + d.points, 0)

  return (
    <div className="mt-8 p-4 bg-white dark:bg-gray-800 shadow rounded space-y-2">
      <h2 className="text-lg font-semibold">Resumo</h2>
      <p><strong>Capacidade geral:</strong> {totalCap}</p>
      <p><strong>Total alocado:</strong> {totalPoints} {pointsType}</p>
      <p>
        <strong>{pointsType} disponiveis:</strong>{' '}
        {totalCap - totalPoints}
      </p>
      <p>
        <strong>Devs disponiveis:</strong>{' '}
        {devs.filter(d => d.points < d.capacity).map(d => d.name).join(', ') || 'Nenhum'}
      </p>
      <p>
        <strong>Devs sobrecarregados:</strong>{' '}
        {devs.filter(d => d.points > d.capacity).map(d => d.name).join(', ') || 'Nenhum'}
      </p>
    </div>
  )
}
