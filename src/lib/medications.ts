import { supabase } from './supabase'
import type { MedicationData, MedicationEntry, MedicationSlot } from './types'

const ENTRY_TYPE = 'medication'

export async function fetchMedicationsForDate(
  userId: string,
  date: string,
): Promise<MedicationEntry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_type', ENTRY_TYPE)
    .eq('data->>date', date)

  if (error) throw error
  return (data ?? []) as MedicationEntry[]
}

export async function markTaken(
  userId: string,
  date: string,
  slot: MedicationSlot,
  takenAt: Date = new Date(),
): Promise<MedicationEntry> {
  const payload: MedicationData = { date, slot }

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: userId,
      entry_type: ENTRY_TYPE,
      data: payload,
      logged_at: takenAt.toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error
  return data as MedicationEntry
}

export async function markUntaken(entryId: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', entryId)
  if (error) throw error
}

// Backfills/corrects the actual time a dose was taken.
export async function updateTakenTime(
  entryId: string,
  takenAt: Date,
): Promise<MedicationEntry> {
  const { data, error } = await supabase
    .from('entries')
    .update({ logged_at: takenAt.toISOString() })
    .eq('id', entryId)
    .select('*')
    .single()

  if (error) throw error
  return data as MedicationEntry
}
