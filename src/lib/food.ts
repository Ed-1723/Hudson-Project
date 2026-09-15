import { supabase } from './supabase'
import type { FoodData, FoodEntry, NutritionEstimate } from './types'

const ENTRY_TYPE = 'food'

// Calls the food-lookup Edge Function, which asks Claude (with web search)
// to estimate nutrition for a free-text description. The Anthropic key
// never reaches the browser - it lives only in the Edge Function's secrets.
export async function lookupNutrition(description: string): Promise<NutritionEstimate> {
  const { data, error } = await supabase.functions.invoke('food-lookup', {
    body: { description },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as NutritionEstimate
}

export async function fetchFoodForDate(userId: string, date: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_type', ENTRY_TYPE)
    .eq('data->>date', date)
    .order('logged_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as FoodEntry[]
}

export async function logFood(
  userId: string,
  date: string,
  description: string,
  estimate: NutritionEstimate,
): Promise<FoodEntry> {
  const payload: FoodData = { date, description, ...estimate }

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: userId,
      entry_type: ENTRY_TYPE,
      data: payload,
      logged_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error
  return data as FoodEntry
}

export async function deleteFoodEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', entryId)
  if (error) throw error
}
