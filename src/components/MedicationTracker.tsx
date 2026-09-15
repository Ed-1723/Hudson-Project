import { useEffect, useState } from 'react'
import { combineDateAndTime, isoToLocalTimeInput } from '../lib/dateUtils'
import {
  fetchMedicationsForDate,
  markTaken,
  markUntaken,
  updateTakenTime,
} from '../lib/medications'
import type { MedicationEntry, MedicationSlot } from '../lib/types'

interface Props {
  userId: string
  dateKey: string
}

const SLOTS: MedicationSlot[] = ['AM', 'PM', 'Bedtime']

export function MedicationTracker({ userId, dateKey }: Props) {
  const [entries, setEntries] = useState<MedicationEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<MedicationSlot | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)
    setEditingSlot(null)

    fetchMedicationsForDate(userId, dateKey)
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

  function entryFor(slot: MedicationSlot): MedicationEntry | null {
    return entries?.find((e) => e.data.slot === slot) ?? null
  }

  async function handleToggle(slot: MedicationSlot) {
    const existing = entryFor(slot)
    setError(null)
    try {
      if (existing) {
        await markUntaken(existing.id)
        setEntries((prev) => prev?.filter((e) => e.id !== existing.id) ?? null)
      } else {
        const created = await markTaken(userId, dateKey, slot)
        setEntries((prev) => [...(prev ?? []), created])
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleTimeChange(entry: MedicationEntry, timeStr: string) {
    setEditingSlot(null)
    if (!timeStr) return
    setError(null)
    try {
      const corrected = combineDateAndTime(dateKey, timeStr)
      const updated = await updateTakenTime(entry.id, corrected)
      setEntries((prev) => prev?.map((e) => (e.id === entry.id ? updated : e)) ?? null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (entries === null && !error) {
    return <p className="muted">Loading medications…</p>
  }

  return (
    <div className="med-tracker">
      {SLOTS.map((slot) => {
        const entry = entryFor(slot)
        const taken = !!entry

        return (
          <div key={slot} className={`med-row${taken ? ' taken' : ''}`}>
            <button
              type="button"
              className="med-toggle"
              aria-pressed={taken}
              onClick={() => handleToggle(slot)}
            >
              <span className="med-check">{taken ? '✓' : ''}</span>
              <span className="med-label">{slot}</span>
            </button>

            {entry &&
              (editingSlot === slot ? (
                <input
                  type="time"
                  className="med-time-input"
                  defaultValue={isoToLocalTimeInput(entry.logged_at)}
                  autoFocus
                  onBlur={(e) => handleTimeChange(entry, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="med-time"
                  onClick={() => setEditingSlot(slot)}
                  title="Tap to correct the time"
                >
                  {new Date(entry.logged_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </button>
              ))}
          </div>
        )
      })}

      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
