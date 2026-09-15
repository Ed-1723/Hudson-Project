export interface HudsonUser {
  id: string
  name: string
  created_at: string
}

export interface EntryRow<T = Record<string, unknown>> {
  id: string
  user_id: string
  entry_type: string
  scheduled_at: string | null
  logged_at: string
  data: T
  created_at: string
}

export interface VitalsData {
  date: string // YYYY-MM-DD, the calendar day these vitals belong to
  steps: number | null
  water_oz: number | null
  weight_lbs: number | null
  bp_sys: number | null
  bp_dia: number | null
  pulse: number | null
}

export type VitalsEntry = EntryRow<VitalsData>

export type VitalsField = Exclude<keyof VitalsData, 'date'>

export type MedicationSlot = 'AM' | 'PM' | 'Bedtime'

export interface MedicationData {
  date: string // YYYY-MM-DD, the calendar day this dose belongs to
  slot: MedicationSlot
}

export type MedicationEntry = EntryRow<MedicationData>
