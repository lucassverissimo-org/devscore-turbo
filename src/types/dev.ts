export type SprintMemberType = 'dev' | 'func' | 'arq'

export type HistoryItem = {
  value: number
  timestamp: string
  text?: string
}

export type Dev = {
  id?: string
  idTeam: number | undefined
  name: string
  memberType?: SprintMemberType
  capacity: number
  points: number
  history: HistoryItem[]
  customPoints: string
}
