import { lookupNutrition } from './food'
import { supabase } from './supabase'
import type { NutritionTotals, RecipeWithIngredients } from './types'

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
  const estimate = await lookupNutrition({
    description: buildRecipeDescription(name, ingredients, servings),
  })
  const perServing = divideByServings(estimate.total, servings)

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      name,
      servings,
      instructions: instructions || null,
      created_by: userId,
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

function buildRecipeDescription(name: string, ingredients: IngredientInput[], servings: number): string {
  const ingredientList = ingredients
    .map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(' '))
    .join(', ')
  return `Recipe: ${name}. Ingredients: ${ingredientList}. Makes ${servings} serving${servings === 1 ? '' : 's'} total.`
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
