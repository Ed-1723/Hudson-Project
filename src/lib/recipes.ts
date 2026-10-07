import { lookupIngredientLines } from './food'
import { supabase } from './supabase'
import type { IngredientNutritionLine, NutritionTotals, RecipeWithIngredients } from './types'

export interface IngredientInput {
  name: string
  quantity: string | null
  unit: string | null
}

export async function fetchRecipes(): Promise<RecipeWithIngredients[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as RecipeWithIngredients[]
}

export async function createRecipe(
  userId: string,
  name: string,
  servings: number,
  instructions: string,
  ingredients: IngredientInput[],
): Promise<RecipeWithIngredients> {
  const lines = await lookupIngredientLines(ingredients.map(describeIngredient))
  const wholeRecipeTotal = sumLines(lines)
  const perServing = divideByServings(wholeRecipeTotal, servings)

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      name,
      servings,
      instructions: instructions || null,
      created_by: userId,
      nutrition_lines: lines,
      ...perServing,
    })
    .select('*')
    .single()

  if (recipeError) throw recipeError

  const ingredientRows = ingredients.map((ing, i) => ({
    recipe_id: recipe.id,
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    order_index: i,
  }))

  const { data: savedIngredients, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .insert(ingredientRows)
    .select('*')

  if (ingredientError) throw ingredientError

  return { ...recipe, recipe_ingredients: savedIngredients ?? [] } as RecipeWithIngredients
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  // recipe_ingredients has no cascade delete, so children go first.
  const { error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
  if (ingredientError) throw ingredientError

  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
  if (error) throw error
}

function describeIngredient(ing: IngredientInput): string {
  return [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')
}

// Only matched lines contribute real numbers; an unmatched line's fields
// are already 0 from the Edge Function, so summing everything is safe and
// keeps the total consistent with what's displayed per line.
function sumLines(lines: IngredientNutritionLine[]): NutritionTotals {
  return lines.reduce(
    (sum, line) => ({
      calories: sum.calories + line.calories,
      protein_g: sum.protein_g + line.protein_g,
      carbs_g: sum.carbs_g + line.carbs_g,
      fat_g: sum.fat_g + line.fat_g,
      sodium_mg: sum.sodium_mg + line.sodium_mg,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sodium_mg: 0 },
  )
}

function divideByServings(total: NutritionTotals, servings: number): NutritionTotals {
  const s = servings > 0 ? servings : 1
  return {
    calories: total.calories / s,
    protein_g: total.protein_g / s,
    carbs_g: total.carbs_g / s,
    fat_g: total.fat_g / s,
    sodium_mg: total.sodium_mg / s,
  }
}
