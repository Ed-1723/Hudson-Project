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

export interface NutritionTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sodium_mg: number
}

export interface NutritionItem extends NutritionTotals {
  name: string
}

export type NutritionConfidence = 'high' | 'medium' | 'low'

export interface NutritionEstimate {
  items: NutritionItem[]
  total: NutritionTotals
  confidence: NutritionConfidence
  source_note: string
}

export interface FoodData extends NutritionEstimate {
  date: string // YYYY-MM-DD, the calendar day this food belongs to
  description: string // what the user typed in
}

export type FoodEntry = EntryRow<FoodData>
