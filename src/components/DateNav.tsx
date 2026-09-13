import { formatDateKeyLong, shiftDateKey, todayKey } from '../lib/dateUtils'

interface Props {
  dateKey: string
  onChange: (dateKey: string) => void
}

export function DateNav({ dateKey, onChange }: Props) {
  const isToday = dateKey === todayKey()

  return (
    <div className="date-nav">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(shiftDateKey(dateKey, -1))}
      >
        ←
      </button>

      <div className="date-nav-label">
        <input
          type="date"
          value={dateKey}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
        <span className="date-nav-long">{formatDateKeyLong(dateKey)}</span>
      </div>

      <button
        type="button"
        aria-label="Next day"
        disabled={isToday}
        onClick={() => onChange(shiftDateKey(dateKey, 1))}
      >
        →
      </button>

      {!isToday && (
        <button type="button" className="today-btn" onClick={() => onChange(todayKey())}>
          Today
        </button>
      )}
    </div>
  )
}
