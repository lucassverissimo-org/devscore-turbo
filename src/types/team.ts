export const NO_TEAM_VALUE = 'none'

export type PointsType = 'pts' | 'hrs'
export type TeamSelection = number | typeof NO_TEAM_VALUE

export type Team = {
  id: number | undefined
  name: string
  pointsType: PointsType
}
