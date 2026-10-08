/// <reference types="vite/client" />

import type { SupabaseClient } from '@supabase/supabase-js'

export const appEnvironment =
  import.meta.env.VITE_APP_ENV || import.meta.env.MODE

// Legacy adapters remain disabled; the application operates without a database.
// Type-only import does not initialize the SDK or restore browser sessions.
export const supabase = null as SupabaseClient | null
