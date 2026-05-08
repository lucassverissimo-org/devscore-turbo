import { Dev, PointsType, SprintDistributionData } from '../../types'
import { normalizeHistoryText } from './history'
import { isSprintMemberType } from './sprintPlanning'

export const SPRINT_DISTRIBUTION_STORAGE_KEY = 'devscore.sprintDistribution'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizePointsType(value: unknown): PointsType {
  return value === 'hrs' ? 'hrs' : 'pts'
}

function normalizeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function createEmptySprintDistribution(): SprintDistributionData {
  return {
    pointsType: 'hrs',
    devs: [],
  }
}

export function normalizeDistributionDevs(value: unknown): Dev[] {
  if (!Array.isArray(value)) return []

  return value.reduce<Dev[]>((acc, item) => {
    if (!isRecord(item) || typeof item.name !== 'string') {
      return acc
    }

    const history = Array.isArray(item.history)
      ? item.history.reduce<Dev['history']>((entries, historyItem) => {
          if (
            isRecord(historyItem) &&
            typeof historyItem.value === 'number' &&
            typeof historyItem.timestamp === 'string'
          ) {
            const text = normalizeHistoryText(historyItem.text)
            entries.push({
              value: historyItem.value,
              timestamp: historyItem.timestamp,
              ...(text ? { text } : {}),
            })
          }

          return entries
        }, [])
      : []

    const memberType = isSprintMemberType(item.memberType)
      ? item.memberType
      : isSprintMemberType(item.type)
        ? item.type
        : undefined

    acc.push({
      id: typeof item.id === 'string' ? item.id : undefined,
      idTeam: undefined,
      name: item.name,
      ...(memberType ? { memberType } : {}),
      capacity: normalizeNumber(item.capacity),
      points: normalizeNumber(item.points),
      history,
      customPoints: '',
    })

    return acc
  }, [])
}

export function normalizeSprintDistribution(value: unknown): SprintDistributionData {
  if (!isRecord(value)) return createEmptySprintDistribution()

  return {
    pointsType: normalizePointsType(value.pointsType),
    devs: normalizeDistributionDevs(value.devs),
  }
}

export function createSprintDistribution(devs: Dev[], pointsType: PointsType): SprintDistributionData {
  return normalizeSprintDistribution({ devs, pointsType })
}

export function loadStoredSprintDistribution(): SprintDistributionData {
  if (typeof window === 'undefined') return createEmptySprintDistribution()

  try {
    const stored = window.localStorage.getItem(SPRINT_DISTRIBUTION_STORAGE_KEY)
    return stored ? normalizeSprintDistribution(JSON.parse(stored)) : createEmptySprintDistribution()
  } catch {
    return createEmptySprintDistribution()
  }
}
