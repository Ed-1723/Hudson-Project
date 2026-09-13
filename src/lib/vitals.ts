import { supabase } from './supabase'
import type { VitalsData, VitalsEntry } from './types'

const ENTRY_TYPE = 'vitals'

export function emptyVitals(date: string): VitalsData {
  return {
    date,
    steps: null,
    water_oz: null,
    weight_lbs: null,
    bp_sys: null,
    bp_dia: null,
    pulse: null,
  }
}

// Vitals are tracked one entry per user per calendar day. If an entry
// already exists for that day it's updated in place; otherwise a new
// entry row is created.
export async function fetchVitalsForDate(
  userId: string,
  date: string,
): Promise<VitalsEntry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_type', ENTRY_TYPE)
    .eq('data->>date', date)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as VitalsEntry | null
}

export async function saveVitals(
  userId: string,
  vitals: VitalsData,
): Promise<VitalsEntry> {
  const existing = await fetchVitalsForDate(userId, vitals.date)

  if (existing) {
    const { data, error } = await supabase
      .from('entries')
      .update({ data: vitals, logged_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return data as VitalsEntry
  }

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: userId,
      entry_type: ENTRY_TYPE,
      data: vitals,
      logged_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error
  return data as VitalsEntry
}
