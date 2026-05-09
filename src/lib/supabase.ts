/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js'

export const appEnvironment = import.meta.env.VITE_APP_ENV || import.meta.env.MODE

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
