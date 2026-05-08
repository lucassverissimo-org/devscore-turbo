export type SprintMemberType = 'dev' | 'func' | 'arq'

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
