export type HistoryItem = {
  value: number
  timestamp: string
}

export type Dev = {
  id?: string
  idTeam: number | undefined
  name: string
  capacity: number
  points: number
  history: HistoryItem[]
  customPoints: string
}
