import type { Dev, SprintMemberType } from './dev'
import type { PointsType } from './team'

export type SprintMember = {
  id: string
  active: boolean
  name: string
  type: SprintMemberType
  capacity: number
  observation: string
  observationStartDate: string
  observationEndDate: string
}

export type SprintTask = {
  id: string
  active: boolean
  code: string
  description: string
  arqPoints: number
  funcPoints: number
  devPoints: number
  memberId?: string
}

export type SprintPlanningData = {
  sprintName: string
  startDate: string
  endDate: string
  members: SprintMember[]
  tasks: SprintTask[]
}

export type SprintDistributionData = {
  pointsType: PointsType
  devs: Dev[]
}

export type SprintPlanningRecord = {
  id: string
  project: string
  name: string
  startDate: string
  endDate: string
  planningData: SprintPlanningData
  distributionData: SprintDistributionData
  planningUpdatedAt: string | null
  distributionUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}
