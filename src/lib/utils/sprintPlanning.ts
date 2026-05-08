import { SprintMemberType, SprintPlanningData, SprintTask } from '../../types'

export const SPRINT_PLANNING_STORAGE_KEY = 'devscore.sprintPlanning'

export const SPRINT_MEMBER_TYPES: SprintMemberType[] = ['dev', 'func', 'arq']

const POINT_FIELDS = ['arqPoints', 'funcPoints', 'devPoints'] as const

type PointField = (typeof POINT_FIELDS)[number]

type TypeTotal = {
  capacity: number
  points: number
  balance: number
  members: number
}

export type SprintSummary = {
  totalCapacity: number
  totalPoints: number
  balance: number
  categoryTotals: Record<PointField, number>
  typeTotals: Record<SprintMemberType, TypeTotal>
}

export function getSprintMemberTypeLabel(type: SprintMemberType): string {
  const labels: Record<SprintMemberType, string> = {
    dev: 'Dev',
    func: 'Func',
    arq: 'Arq',
  }

  return labels[type]
}

export function getSprintMemberTypeShortLabel(type: SprintMemberType): string {
  const labels: Record<SprintMemberType, string> = {
    dev: 'DEV',
    func: 'FUNC',
    arq: 'ARQ',
  }

  return labels[type]
}

export function getSprintMemberTypeBadgeClass(type: SprintMemberType): string {
  const classes: Record<SprintMemberType, string> = {
    dev: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
    func: 'border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-200',
    arq: 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950/60 dark:text-green-200',
  }

  return classes[type]
}

export function getSprintMemberTypeAccentClass(type: SprintMemberType): string {
  const classes: Record<SprintMemberType, string> = {
    dev: 'border-l-blue-500',
    func: 'border-l-orange-500',
    arq: 'border-l-green-600',
  }

  return classes[type]
}

export function isSprintMemberType(value: unknown): value is SprintMemberType {
  return SPRINT_MEMBER_TYPES.includes(value as SprintMemberType)
}

export function normalizeSprintMemberType(value: unknown): SprintMemberType {
  return isSprintMemberType(value) ? value : 'dev'
}

export function createEmptySprintPlanning(): SprintPlanningData {
  return {
    sprintName: '',
    startDate: '',
    endDate: '',
    members: [],
    tasks: [],
  }
}

export function loadStoredSprintPlanning(): SprintPlanningData {
  if (typeof window === 'undefined') return createEmptySprintPlanning()

  try {
    const stored = window.localStorage.getItem(SPRINT_PLANNING_STORAGE_KEY)
    return stored ? normalizeSprintPlanning(JSON.parse(stored)) : createEmptySprintPlanning()
  } catch {
    return createEmptySprintPlanning()
  }
}

export function getTaskTotal(task: SprintTask): number {
  return POINT_FIELDS.reduce((total, field) => total + task[field], 0)
}

function createEmptyTypeTotals(): Record<SprintMemberType, TypeTotal> {
  return {
    dev: { capacity: 0, points: 0, balance: 0, members: 0 },
    func: { capacity: 0, points: 0, balance: 0, members: 0 },
    arq: { capacity: 0, points: 0, balance: 0, members: 0 },
  }
}

export function getSprintSummary(planning: SprintPlanningData): SprintSummary {
  const activeTasks = planning.tasks.filter(task => task.active)
  const activeMembers = planning.members.filter(member => member.active)
  const categoryTotals = POINT_FIELDS.reduce<Record<PointField, number>>((totals, field) => {
    totals[field] = activeTasks.reduce((sum, task) => sum + task[field], 0)
    return totals
  }, {
    arqPoints: 0,
    funcPoints: 0,
    devPoints: 0,
  })

  const typeTotals = createEmptyTypeTotals()
  activeMembers.forEach(member => {
    typeTotals[member.type].capacity += member.capacity
    typeTotals[member.type].members += 1
  })
  typeTotals.arq.points = categoryTotals.arqPoints
  typeTotals.func.points = categoryTotals.funcPoints
  typeTotals.dev.points = categoryTotals.devPoints
  SPRINT_MEMBER_TYPES.forEach(type => {
    typeTotals[type].balance = typeTotals[type].capacity - typeTotals[type].points
  })

  const totalCapacity = activeMembers.reduce((sum, member) => sum + member.capacity, 0)
  const totalPoints = activeTasks.reduce((sum, task) => sum + getTaskTotal(task), 0)

  return {
    totalCapacity,
    totalPoints,
    balance: totalCapacity - totalPoints,
    categoryTotals,
    typeTotals,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function normalizeSprintPlanning(value: unknown): SprintPlanningData {
  if (!isRecord(value)) return createEmptySprintPlanning()

  const storedMembers = Array.isArray(value.members)
    ? value.members
    : Array.isArray(value.devs)
      ? value.devs
      : []
  const members = storedMembers.flatMap(member => {
    if (!isRecord(member) || typeof member.id !== 'string' || typeof member.name !== 'string') {
      return []
    }

    return [{
      id: member.id,
      active: typeof member.active === 'boolean' ? member.active : true,
      name: member.name,
      type: normalizeSprintMemberType(member.type),
      capacity: normalizeNumber(member.capacity),
      observation: typeof member.observation === 'string' ? member.observation : '',
      observationStartDate: typeof member.observationStartDate === 'string' ? member.observationStartDate : '',
      observationEndDate: typeof member.observationEndDate === 'string' ? member.observationEndDate : '',
    }]
  })
  const memberIds = new Set(members.map(member => member.id))

  return {
    sprintName: typeof value.sprintName === 'string' ? value.sprintName : '',
    startDate: typeof value.startDate === 'string' ? value.startDate : '',
    endDate: typeof value.endDate === 'string' ? value.endDate : '',
    members,
    tasks: Array.isArray(value.tasks)
      ? value.tasks.flatMap(task => {
          if (!isRecord(task) || typeof task.id !== 'string') {
            return []
          }

          const rawMemberId = typeof task.memberId === 'string'
            ? task.memberId
            : typeof task.devId === 'string'
              ? task.devId
              : ''
          const memberId = memberIds.has(rawMemberId) ? rawMemberId : undefined

          return [{
            id: task.id,
            active: typeof task.active === 'boolean' ? task.active : true,
            code: typeof task.code === 'string' ? task.code : '',
            description: typeof task.description === 'string' ? task.description : '',
            arqPoints: normalizeNumber(task.arqPoints),
            funcPoints: normalizeNumber(task.funcPoints),
            devPoints: normalizeNumber(task.devPoints),
            memberId,
          }]
        })
      : [],
  }
}
