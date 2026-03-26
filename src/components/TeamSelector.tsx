import React from 'react'
import { NO_TEAM_VALUE, PointsType, Team, TeamSelection } from '../types'

interface TeamSelectorProps {
  teams: Team[]
  selectedTeamId: TeamSelection
  setSelectedTeamId: (id: TeamSelection) => void
  localPointsType: PointsType
  setLocalPointsType: (type: PointsType) => void
}

export default function TeamSelector({
  teams,
  selectedTeamId,
  setSelectedTeamId,
  localPointsType,
  setLocalPointsType,
}: TeamSelectorProps) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-sm font-medium">Time</label>
      <select
        value={selectedTeamId}
        onChange={e =>
          setSelectedTeamId(e.target.value === NO_TEAM_VALUE ? NO_TEAM_VALUE : Number(e.target.value))
        }
        className="p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700"
      >
        <option value={NO_TEAM_VALUE}>Nenhum</option>
        {teams.map(team => (
          <option key={team.id} value={team.id}>
            {team.name} ({team.pointsType})
          </option>
        ))}
      </select>

      {selectedTeamId === NO_TEAM_VALUE && (
        <div className="mt-4 flex flex-col">
          <label className="mb-1 text-sm font-medium">Unidade</label>
          <select
            value={localPointsType}
            onChange={e => setLocalPointsType(e.target.value === 'hrs' ? 'hrs' : 'pts')}
            className="p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="pts">pts</option>
            <option value="hrs">hrs</option>
          </select>
        </div>
      )}
    </div>
  )
}
