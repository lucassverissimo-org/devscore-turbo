import { expect, it } from 'vitest'
import {
  createSprintDistribution,
  normalizeSprintDistribution,
} from '../src/lib/utils/sprintDistribution'
import {
  createEmptySprintPlanning,
  normalizeSprintPlanning,
} from '../src/lib/utils/sprintPlanning'
import { getPointValues } from '../src/lib/utils/getPointValues'
it('DevScore mantém pontuações e histórico ao normalizar distribuição', () => {
  const data = createSprintDistribution(
    [
      {
        id: 'dev',
        idTeam: undefined,
        name: 'Lucas',
        capacity: 40,
        points: 8,
        history: [
          { value: 8, timestamp: '2026-10-03T12:00:00Z', text: 'ABC-1' },
        ],
        customPoints: '',
      },
    ],
    'hrs'
  )
  expect(normalizeSprintDistribution(data)).toEqual(data)
  expect(data.devs[0].points).toBe(8)
  expect(data.devs[0].history[0].text).toBe('ABC-1')
})
it('DevScore mantém o planejamento vazio e as escalas de pontuação existentes', () => {
  const empty = createEmptySprintPlanning()
  expect(normalizeSprintPlanning(empty)).toEqual(empty)
  expect(getPointValues('pts')).toEqual([1, 2, 3, 5, 8, 13])
  expect(getPointValues('hrs')).toContain(40)
})

import { resolveToolPath } from '../src/lib/toolRouting'
it('preserva o retorno OAuth Jira legado na raiz e a home normal', () => {
  expect(resolveToolPath('/', '?jira=connected&jira_message=ok')).toBe(
    '/devscore'
  )
  expect(resolveToolPath('/', '')).toBe('/')
  expect(resolveToolPath('/timesheet/', '')).toBe('/timesheet')
})
