import { useEffect, useState } from 'react'
import { deleteFoodEntry, fetchFoodForDate, logFood, lookupNutrition } from '../lib/food'
import type { FoodEntry, NutritionEstimate, NutritionTotals } from '../lib/types'

interface Props {
  userId: string
  dateKey: string
}

function sumTotals(entries: FoodEntry[]): NutritionTotals {
  return entries.reduce(
    (sum, e) => ({
      calories: sum.calories + e.data.total.calories,
      protein_g: sum.protein_g + e.data.total.protein_g,
      carbs_g: sum.carbs_g + e.data.total.carbs_g,
      fat_g: sum.fat_g + e.data.total.fat_g,
      sodium_mg: sum.sodium_mg + e.data.total.sodium_mg,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sodium_mg: 0 },
  )
}

export function FoodLog({ userId, dateKey }: Props) {
  const [entries, setEntries] = useState<FoodEntry[] | null>(null)
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState<NutritionEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setPending(null)
    setError(null)

    fetchFoodForDate(userId, dateKey)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [userId, dateKey])

  async function handleLookup() {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    setPending(null)
    try {
      const estimate = await lookupNutrition(description.trim())
      setPending(estimate)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!pending) return
    setError(null)
    try {
      const created = await logFood(userId, dateKey, description.trim(), pending)
      setEntries((prev) => [...(prev ?? []), created])
      setPending(null)
      setDescription('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleDelete(entryId: string) {
    setError(null)
    try {
      await deleteFoodEntry(entryId)
      setEntries((prev) => prev?.filter((e) => e.id !== entryId) ?? null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const dayTotal = entries ? sumTotals(entries) : null

  return (
    <div className="food-log">
      <div className="food-input-row">
        <input
          type="text"
          className="food-input"
          placeholder="What did you eat?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLookup()
          }}
        />
        <button type="button" className="food-lookup-btn" onClick={handleLookup} disabled={loading}>
          {loading ? '…' : 'Look up'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {pending && (
        <div className="food-preview">
          <NutritionBreakdown estimate={pending} />
          <div className="food-preview-actions">
            <button type="button" className="save-btn" onClick={handleAdd}>
              Add to log
            </button>
            <button type="button" className="food-discard-btn" onClick={() => setPending(null)}>
              Discard
            </button>
          </div>
        </div>
      )}

      {entries === null && !error ? (
        <p className="muted">Loading food log…</p>
      ) : (
        <>
          {dayTotal && entries && entries.length > 0 && (
            <div className="food-day-total">
              <strong>{Math.round(dayTotal.calories)} cal</strong>
              <span className="muted">
                {' '}
                · {Math.round(dayTotal.protein_g)}g protein · {Math.round(dayTotal.carbs_g)}g
                carbs · {Math.round(dayTotal.fat_g)}g fat · {Math.round(dayTotal.sodium_mg)}mg sodium
              </span>
            </div>
          )}

          <div className="food-list">
            {entries?.map((entry) => (
              <div key={entry.id} className="food-item-row">
                <div className="food-item-main">
                  <span className="food-item-name">{entry.data.description}</span>
                  <span className="muted">
                    {Math.round(entry.data.total.calories)} cal ·{' '}
                    <span className={`confidence-badge confidence-${entry.data.confidence}`}>
                      {entry.data.confidence}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="food-delete-btn"
                  onClick={() => handleDelete(entry.id)}
                  aria-label="Remove entry"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function NutritionBreakdown({ estimate }: { estimate: NutritionEstimate }) {
  return (
    <div>
      {estimate.items.length > 1 && (
        <ul className="food-items-list">
          {estimate.items.map((item, i) => (
            <li key={i}>
              {item.name} — {Math.round(item.calories)} cal
            </li>
          ))}
        </ul>
      )}
      <div className="food-preview-total">
        <strong>{Math.round(estimate.total.calories)} cal</strong>
        <span className="muted">
          {' '}
          · {Math.round(estimate.total.protein_g)}g protein ·{' '}
          {Math.round(estimate.total.carbs_g)}g carbs · {Math.round(estimate.total.fat_g)}g fat ·{' '}
          {Math.round(estimate.total.sodium_mg)}mg sodium
        </span>
      </div>
      <div className="food-preview-meta">
        <span className={`confidence-badge confidence-${estimate.confidence}`}>
          {estimate.confidence} confidence
        </span>
        <span className="muted food-source-note">{estimate.source_note}</span>
      </div>
    </div>
  )
}
