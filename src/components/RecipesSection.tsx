import { useEffect, useState } from 'react'
import { logFood } from '../lib/food'
import { createRecipe, deleteRecipe, fetchRecipes, type IngredientInput } from '../lib/recipes'
import type { NutritionEstimate, RecipeWithIngredients } from '../lib/types'

interface Props {
  userId: string
  dateKey: string
  onLogged?: () => void
}

interface IngredientRow extends IngredientInput {
  key: number
}

let nextRowKey = 1
function emptyRow(): IngredientRow {
  return { key: nextRowKey++, name: '', quantity: null, unit: null }
}

export function RecipesSection({ userId, dateKey, onLogged }: Props) {
  const [recipes, setRecipes] = useState<RecipeWithIngredients[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loggedId, setLoggedId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [servings, setServings] = useState(1)
  const [instructions, setInstructions] = useState('')
  const [rows, setRows] = useState<IngredientRow[]>([emptyRow()])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecipes()
      .then(setRecipes)
      .catch((err: Error) => setError(err.message))
  }, [])

  function updateRow(key: number, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))
  }

  function resetForm() {
    setName('')
    setServings(1)
    setInstructions('')
    setRows([emptyRow()])
    setFormError(null)
    setShowForm(false)
  }

  async function handleSave() {
    const ingredients = rows.filter((r) => r.name.trim()).map(({ key: _key, ...rest }) => rest)
    if (!name.trim()) {
      setFormError('Give the recipe a name.')
      return
    }
    if (ingredients.length === 0) {
      setFormError('Add at least one ingredient.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const created = await createRecipe(userId, name.trim(), servings, instructions.trim(), ingredients)
      setRecipes((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)))
      resetForm()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(recipeId: string) {
    setError(null)
    try {
      await deleteRecipe(recipeId)
      setRecipes((prev) => prev?.filter((r) => r.id !== recipeId) ?? null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleLogToday(recipe: RecipeWithIngredients) {
    setError(null)
    const perServing = {
      calories: recipe.calories ?? 0,
      protein_g: recipe.protein_g ?? 0,
      carbs_g: recipe.carbs_g ?? 0,
      fat_g: recipe.fat_g ?? 0,
      sodium_mg: recipe.sodium_mg ?? 0,
    }
    const estimate: NutritionEstimate = {
      items: [{ name: recipe.name, ...perServing }],
      total: perServing,
      confidence: 'high',
      source_note: `Recipe: ${recipe.name}`,
    }
    try {
      await logFood(userId, dateKey, recipe.name, estimate)
      setLoggedId(recipe.id)
      onLogged?.()
      setTimeout(() => setLoggedId((id) => (id === recipe.id ? null : id)), 1500)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="recipes-section">
      {error && <p className="error-text">{error}</p>}

      {!showForm && (
        <button type="button" className="food-lookup-btn recipe-new-btn" onClick={() => setShowForm(true)}>
          + New Recipe
        </button>
      )}

      {showForm && (
        <div className="recipe-form">
          <input
            type="text"
            className="food-input"
            placeholder="Recipe name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="recipe-servings-label">
            Servings
            <input
              type="number"
              min="1"
              step="1"
              className="food-servings-input"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value) || 1)}
            />
          </label>

          <div className="recipe-ingredients-edit">
            {rows.map((row) => (
              <div key={row.key} className="recipe-ingredient-row">
                <input
                  type="text"
                  placeholder="Qty"
                  className="recipe-qty-input"
                  value={row.quantity ?? ''}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value || null })}
                />
                <input
                  type="text"
                  placeholder="Unit"
                  className="recipe-unit-input"
                  value={row.unit ?? ''}
                  onChange={(e) => updateRow(row.key, { unit: e.target.value || null })}
                />
                <input
                  type="text"
                  placeholder="Ingredient"
                  className="recipe-name-input"
                  value={row.name}
                  onChange={(e) => updateRow(row.key, { name: e.target.value })}
                />
                <button
                  type="button"
                  className="food-delete-btn"
                  onClick={() => removeRow(row.key)}
                  aria-label="Remove ingredient"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="recipe-add-row-btn"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              + Add ingredient
            </button>
          </div>

          <textarea
            className="recipe-instructions-input"
            placeholder="Instructions (optional)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
          />

          {formError && <p className="error-text">{formError}</p>}

          <div className="food-preview-actions">
            <button type="button" className="save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Estimating nutrition…' : 'Save Recipe'}
            </button>
            <button type="button" className="food-discard-btn" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {recipes === null && !error ? (
        <p className="muted">Loading recipes…</p>
      ) : (
        <div className="recipe-list">
          {recipes?.length === 0 && <p className="muted">No recipes yet.</p>}
          {recipes?.map((recipe) => (
            <div key={recipe.id} className="recipe-card">
              <div className="recipe-card-header">
                <span className="food-item-name">{recipe.name}</span>
                <button
                  type="button"
                  className="food-delete-btn"
                  onClick={() => handleDelete(recipe.id)}
                  aria-label="Delete recipe"
                >
                  ×
                </button>
              </div>

              <p className="muted recipe-macro-line">
                {Math.round(recipe.calories ?? 0)} cal/serving ·{' '}
                {Math.round(recipe.protein_g ?? 0)}g protein · {Math.round(recipe.carbs_g ?? 0)}g carbs ·{' '}
                {Math.round(recipe.fat_g ?? 0)}g fat · {Math.round(recipe.sodium_mg ?? 0)}mg sodium ·{' '}
                {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
              </p>

              {recipe.recipe_ingredients.length > 0 && (
                <ul className="food-items-list">
                  {recipe.recipe_ingredients
                    .slice()
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((ing) => (
                      <li key={ing.id}>
                        {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                      </li>
                    ))}
                </ul>
              )}

              {recipe.instructions && <p className="recipe-instructions-text">{recipe.instructions}</p>}

              <button type="button" className="recipe-log-btn" onClick={() => handleLogToday(recipe)}>
                {loggedId === recipe.id ? 'Logged ✓' : 'Log 1 serving to today'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
