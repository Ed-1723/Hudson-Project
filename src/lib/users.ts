import { supabase } from './supabase'
import type { HudsonUser } from './types'

export async function fetchUsers(): Promise<HudsonUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}
