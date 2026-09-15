// All dates in this app are plain YYYY-MM-DD strings representing a
// calendar day, independent of timezone — vitals are logged "for a day",
// not for an instant.

export function todayKey(): string {
  return toDateKey(new Date())
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return toDateKey(dt)
}

// HH:mm in local time, for populating an <input type="time">.
export function isoToLocalTimeInput(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// Combines a calendar-day key with an <input type="time"> value into a
// concrete local Date — used to correct a logged time while backfilling.
export function combineDateAndTime(dateKey: string, timeHHMM: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [h, min] = timeHHMM.split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

export function formatDateKeyLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
