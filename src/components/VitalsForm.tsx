import { useEffect, useState } from 'react'
import { emptyVitals, fetchVitalsForDate, saveVitals } from '../lib/vitals'
import type { VitalsData } from '../lib/types'

interface Props {
  userId: string
  dateKey: string
}

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

interface FieldSpec {
  key: keyof Omit<VitalsData, 'date'>
  label: string
  unit: string
  step?: string
}

const FIELDS: FieldSpec[] = [
  { key: 'steps', label: 'Steps', unit: 'steps' },
  { key: 'water_oz', label: 'Water', unit: 'oz' },
  { key: 'weight_lbs', label: 'Weight', unit: 'lbs', step: '0.1' },
  { key: 'bp_sys', label: 'BP Systolic', unit: 'mmHg' },
  { key: 'bp_dia', label: 'BP Diastolic', unit: 'mmHg' },
  { key: 'pulse', label: 'Pulse', unit: 'bpm' },
]

const WATER_QUICK_ADD = [12, 32, 40]

export function VitalsForm({ userId, dateKey }: Props) {
  const [vitals, setVitals] = useState<VitalsData>(emptyVitals(dateKey))
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)

    fetchVitalsForDate(userId, dateKey)
      .then((entry) => {
        if (cancelled) return
        setVitals(entry ? entry.data : emptyVitals(dateKey))
        setStatus('idle')
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [userId, dateKey])

  function updateField(key: FieldSpec['key'], raw: string) {
    setVitals((prev) => ({
      ...prev,
      [key]: raw === '' ? null : Number(raw),
    }))
  }

  async function handleSave() {
    setStatus('saving')
    setError(null)
    try {
      await saveVitals(userId, vitals)
      setStatus('saved')
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  // Quick-add saves immediately - no need to also hit the main Save button
  // while topping off a water bottle mid-day.
  async function handleQuickWater(amount: number) {
    const updated: VitalsData = { ...vitals, water_oz: (vitals.water_oz ?? 0) + amount }
    setVitals(updated)
    setStatus('saving')
    setError(null)
    try {
      await saveVitals(userId, updated)
      setStatus('saved')
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  if (status === 'loading') {
    return <p className="muted">Loading vitals…</p>
  }

  return (
    <div className="vitals-form">
      <div className="vitals-grid">
        {FIELDS.map((field) => (
          <label key={field.key} className="vitals-field">
            <div className="vitals-field-header">
              <span className="vitals-field-label">{field.label}</span>
              {field.key === 'water_oz' && (
                <div className="water-quick-add">
                  {WATER_QUICK_ADD.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="water-quick-add-btn"
                      onClick={() => handleQuickWater(amount)}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="vitals-field-input">
              <input
                type="number"
                inputMode="decimal"
                step={field.step ?? '1'}
                value={vitals[field.key] ?? ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder="—"
              />
              <span className="vitals-field-unit">{field.unit}</span>
            </div>
          </label>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <button
        type="button"
        className="save-btn"
        onClick={handleSave}
        disabled={status === 'saving'}
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}
