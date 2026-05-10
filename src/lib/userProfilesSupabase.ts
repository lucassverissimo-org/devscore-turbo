import type { User } from '@supabase/supabase-js'
import type { UserProfile, UserRole } from '../types'
import { supabase } from './supabase'

type UserProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const DEFAULT_USER_ROLE: UserRole = 'USER'
export const SPRINT_EDITOR_ROLES: UserRole[] = ['ADMIN', 'SCRUM']

function normalizeError(error: { message?: string } | null): string {
  return error?.message || 'Nao foi possivel concluir a operacao no Supabase.'
}

export function normalizeUserRole(value: unknown): UserRole {
  if (value === 'ADMIN' || value === 'SCRUM') return value
  return DEFAULT_USER_ROLE
}

export function canEditSprintPlanning(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SCRUM'
}

function getUserMetadataName(user?: User | null): string {
  return typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user?.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : ''
}

function normalizeProfile(row: UserProfileRow, user?: User | null): UserProfile {
  return {
    id: row.id,
    email: row.email ?? user?.email ?? '',
    fullName: row.full_name?.trim() || getUserMetadataName(user),
    role: normalizeUserRole(row.role),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

export async function getCurrentUserProfile(user: User | null): Promise<{
  profile: UserProfile | null
  error?: string
}> {
  if (!supabase || !user) return { profile: null }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,email,full_name,role,created_at,updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { profile: null, error: normalizeError(error) }
  }

  if (data) {
    return { profile: normalizeProfile(data as UserProfileRow, user) }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('user_profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      full_name: getUserMetadataName(user),
      role: DEFAULT_USER_ROLE,
    })
    .select('id,email,full_name,role,created_at,updated_at')
    .maybeSingle()

  if (insertError) {
    return {
      profile: {
        id: user.id,
        email: user.email ?? '',
        fullName: getUserMetadataName(user),
        role: DEFAULT_USER_ROLE,
      },
      error: normalizeError(insertError),
    }
  }

  return {
    profile: inserted
      ? normalizeProfile(inserted as UserProfileRow, user)
      : {
          id: user.id,
          email: user.email ?? '',
          fullName: getUserMetadataName(user),
          role: DEFAULT_USER_ROLE,
        },
  }
}
