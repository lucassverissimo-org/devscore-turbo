import { SprintDistributionData, SprintPlanningData, SprintPlanningRecord } from '../types'
import { supabase } from './supabase'
import { createEmptySprintDistribution, normalizeSprintDistribution } from './utils/sprintDistribution'
import { normalizeSprintPlanning } from './utils/sprintPlanning'

export const SPRINT_PROJECT = 'BRAVO'

const TABLE_NAME = 'sprint_plannings'

type SprintPlanningRow = {
  id: string
  project: string
  name: string
  start_date: string | null
  end_date: string | null
  planning_data: unknown
  distribution_data: unknown
  planning_updated_at: string | null
  distribution_updated_at: string | null
  created_at: string
  updated_at: string
}

type SaveResult =
  | { record: SprintPlanningRecord; conflict?: false; error?: undefined }
  | { record?: undefined; conflict: true; error?: undefined }
  | { record?: undefined; conflict?: false; error: string }

function getSupabaseUnavailableResult(): SaveResult {
  return { error: 'Supabase indisponivel.' }
}

function normalizeRecord(row: SprintPlanningRow): SprintPlanningRecord {
  const planningData = normalizeSprintPlanning(row.planning_data)
  const distributionData = normalizeSprintDistribution(row.distribution_data)

  return {
    id: row.id,
    project: row.project,
    name: row.name,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    planningData: {
      ...planningData,
      sprintName: row.name,
      startDate: row.start_date ?? '',
      endDate: row.end_date ?? '',
    },
    distributionData,
    planningUpdatedAt: row.planning_updated_at,
    distributionUpdatedAt: row.distribution_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeError(error: { message?: string } | null): string {
  return error?.message || 'Nao foi possivel concluir a operacao no Supabase.'
}

function normalizeDateForDb(value: string): string | null {
  return value || null
}

function getPlanningPayload(planning: SprintPlanningData) {
  const normalizedPlanning = {
    ...planning,
    sprintName: planning.sprintName.trim(),
  }

  return {
    name: normalizedPlanning.sprintName,
    start_date: normalizeDateForDb(normalizedPlanning.startDate),
    end_date: normalizeDateForDb(normalizedPlanning.endDate),
    planning_data: normalizedPlanning,
    planning_updated_at: new Date().toISOString(),
  }
}

export async function listSprintPlanningRecords(project = SPRINT_PROJECT): Promise<{
  records: SprintPlanningRecord[]
  error?: string
}> {
  if (!supabase) return { records: [], error: 'Supabase indisponivel.' }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('project', project)
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('name', { ascending: false })

  if (error || !data) {
    return { records: [], error: normalizeError(error) }
  }

  return { records: (data as SprintPlanningRow[]).map(normalizeRecord) }
}

export async function saveNewSprintPlanningRecord(
  planning: SprintPlanningData,
  distribution: SprintDistributionData = createEmptySprintDistribution(),
  project = SPRINT_PROJECT,
): Promise<SaveResult> {
  if (!supabase) return getSupabaseUnavailableResult()

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      project,
      ...getPlanningPayload(planning),
      distribution_data: distribution,
      distribution_updated_at: now,
      planning_updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: normalizeError(error) }
  }

  return { record: normalizeRecord(data as SprintPlanningRow) }
}

export async function updateSprintPlanningRecord(
  recordId: string,
  planning: SprintPlanningData,
  expectedPlanningUpdatedAt: string | null,
): Promise<SaveResult> {
  if (!supabase) return getSupabaseUnavailableResult()

  let query = supabase
    .from(TABLE_NAME)
    .update(getPlanningPayload(planning))
    .eq('id', recordId)

  query = expectedPlanningUpdatedAt
    ? query.eq('planning_updated_at', expectedPlanningUpdatedAt)
    : query.is('planning_updated_at', null)

  const { data, error } = await query.select('*')

  if (error) {
    return { error: normalizeError(error) }
  }

  const rows = (data ?? []) as SprintPlanningRow[]
  if (!rows.length) {
    return { conflict: true }
  }

  return { record: normalizeRecord(rows[0]) }
}

export async function updateSprintDistributionRecord(
  recordId: string,
  distribution: SprintDistributionData,
  expectedDistributionUpdatedAt: string | null,
): Promise<SaveResult> {
  if (!supabase) return getSupabaseUnavailableResult()

  let query = supabase
    .from(TABLE_NAME)
    .update({
      distribution_data: distribution,
      distribution_updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)

  query = expectedDistributionUpdatedAt
    ? query.eq('distribution_updated_at', expectedDistributionUpdatedAt)
    : query.is('distribution_updated_at', null)

  const { data, error } = await query.select('*')

  if (error) {
    return { error: normalizeError(error) }
  }

  const rows = (data ?? []) as SprintPlanningRow[]
  if (!rows.length) {
    return { conflict: true }
  }

  return { record: normalizeRecord(rows[0]) }
}
