import React from 'react'

export default function TeamSelector({ teams, selectedTeamId, setSelectedTeamId }) {
  return (
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
  )
}
