import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const createSupabaseClient = (groupId: string) => url && key
  ? createClient(url, key, { global: { headers: { 'x-client-info': `flowari-group/${groupId}` } } })
  : null
