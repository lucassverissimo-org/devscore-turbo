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
  planning_updated_at: string | null
  created_at: string
  updated_at: string
}

type SprintDistributionRow = {
  id: string
  sprint_planning_id: string
  distribution_data: unknown
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

function normalizeRecord(
  row: SprintPlanningRow,
  distributionRow?: SprintDistributionRow | null,
): SprintPlanningRecord {
  const planningData = normalizeSprintPlanning(row.planning_data)
  const distributionData = normalizeSprintDistribution(distributionRow?.distribution_data)

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
    distributionUpdatedAt: distributionRow?.distribution_updated_at ?? null,
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

async function getPlanningRow(recordId: string): Promise<{
  row?: SprintPlanningRow
  error?: string
}> {
  if (!supabase) return { error: 'Supabase indisponivel.' }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', recordId)
    .maybeSingle()

  if (error || !data) {
    return { error: normalizeError(error) }
  }

  return { row: data as SprintPlanningRow }
}

async function getDistributionRow(recordId: string): Promise<{
  row?: SprintDistributionRow | null
  error?: string
}> {
  if (!supabase) return { error: 'Supabase indisponivel.' }

  const { data, error } = await supabase
    .from('sprint_distributions')
    .select('*')
    .eq('sprint_planning_id', recordId)
    .maybeSingle()

  if (error) {
    return { error: normalizeError(error) }
  }

  return { row: data as SprintDistributionRow | null }
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

  const planningRows = data as SprintPlanningRow[]
  if (!planningRows.length) return { records: [] }

  const planningIds = planningRows.map(row => row.id)
  const distributionResult = await supabase
    .from('sprint_distributions')
    .select('*')
    .in('sprint_planning_id', planningIds)

  if (distributionResult.error) {
    return { records: [], error: normalizeError(distributionResult.error) }
  }

  const distributionsByPlanningId = new Map(
    ((distributionResult.data ?? []) as SprintDistributionRow[]).map(row => [row.sprint_planning_id, row]),
  )

  return {
    records: planningRows.map(row => normalizeRecord(row, distributionsByPlanningId.get(row.id))),
  }
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
      planning_updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: normalizeError(error) }
  }

  const planningRow = data as SprintPlanningRow
  const distributionResult = await supabase
    .from('sprint_distributions')
    .upsert(
      {
        sprint_planning_id: planningRow.id,
        distribution_data: distribution,
        distribution_updated_at: now,
      },
      { onConflict: 'sprint_planning_id' },
    )
    .select('*')
    .single()

  if (distributionResult.error || !distributionResult.data) {
    return { error: normalizeError(distributionResult.error) }
  }

  return { record: normalizeRecord(planningRow, distributionResult.data as SprintDistributionRow) }
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

  const distributionResult = await getDistributionRow(recordId)
  if (distributionResult.error) {
    return { error: distributionResult.error }
  }

  return { record: normalizeRecord(rows[0], distributionResult.row) }
}

export async function updateSprintDistributionRecord(
  recordId: string,
  distribution: SprintDistributionData,
  expectedDistributionUpdatedAt: string | null,
): Promise<SaveResult> {
  if (!supabase) return getSupabaseUnavailableResult()

  const now = new Date().toISOString()
  let query = supabase
    .from('sprint_distributions')
    .update({
      distribution_data: distribution,
      distribution_updated_at: now,
    })
    .eq('sprint_planning_id', recordId)

  query = expectedDistributionUpdatedAt
    ? query.eq('distribution_updated_at', expectedDistributionUpdatedAt)
    : query.is('distribution_updated_at', null)

  const { data, error } = await query.select('*')

  if (error) {
    return { error: normalizeError(error) }
  }

  const rows = (data ?? []) as SprintDistributionRow[]
  if (!rows.length) {
    if (expectedDistributionUpdatedAt) {
      return { conflict: true }
    }

    const currentDistributionResult = await getDistributionRow(recordId)
    if (currentDistributionResult.error) {
      return { error: currentDistributionResult.error }
    }

    if (currentDistributionResult.row) {
      return { conflict: true }
    }

    const insertResult = await supabase
      .from('sprint_distributions')
      .insert({
        sprint_planning_id: recordId,
        distribution_data: distribution,
        distribution_updated_at: now,
      })
      .select('*')
      .single()

    if (insertResult.error || !insertResult.data) {
      return { error: normalizeError(insertResult.error) }
    }

    const planningResult = await getPlanningRow(recordId)
    if (planningResult.error || !planningResult.row) {
      return { error: planningResult.error ?? 'Nao foi possivel carregar a Sprint.' }
    }

    return {
      record: normalizeRecord(planningResult.row, insertResult.data as SprintDistributionRow),
    }
  }

  const planningResult = await getPlanningRow(recordId)
  if (planningResult.error || !planningResult.row) {
    return { error: planningResult.error ?? 'Nao foi possivel carregar a Sprint.' }
  }

  return { record: normalizeRecord(planningResult.row, rows[0]) }
}
