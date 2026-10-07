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

export interface RecipeIngredient {
  id: string
  recipe_id: string
  name: string
  // Free text, not numeric -- recipes legitimately use fractions ("1/3
  // cup") and imprecise amounts ("a pinch") that a number field can't
  // hold, and nothing in the app does math with this value.
  quantity: string | null
  unit: string | null
  notes: string | null
  order_index: number
}

export interface IngredientNutritionLine {
  input: string
  matched: boolean
  matched_food: string
  quantity_understood: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  sodium_mg: number
  note: string
}

export interface Recipe {
  id: string
  name: string
  instructions: string | null
  servings: number | null
  // Cached per-serving nutrition, computed once via Claude when the recipe
  // is created so logging it later is instant.
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  sodium_mg: number | null
  // Per-ingredient breakdown from the lookup that produced the totals above
  // (whole-recipe quantities, not per-serving) -- kept so a flagged/
  // unmatched ingredient is visible instead of silently folded into a
  // confident-looking total.
  nutrition_lines: IngredientNutritionLine[] | null
  created_by: string | null
  created_at: string
}

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[]
}
