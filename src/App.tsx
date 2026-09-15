import { useEffect, useState } from 'react'
import { DateNav } from './components/DateNav'
import { FoodLog } from './components/FoodLog'
import { MedicationTracker } from './components/MedicationTracker'
import { UserSwitcher } from './components/UserSwitcher'
import { VitalsForm } from './components/VitalsForm'
import { todayKey } from './lib/dateUtils'
import { fetchUsers } from './lib/users'
import type { HudsonUser } from './lib/types'

const LAST_USER_KEY = 'hudson.currentUserId'

function App() {
  const [users, setUsers] = useState<HudsonUser[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [dateKey, setDateKey] = useState(todayKey())

  useEffect(() => {
    fetchUsers()
      .then((list) => {
        setUsers(list)
        const saved = localStorage.getItem(LAST_USER_KEY)
        const initial = list.find((u) => u.id === saved)?.id ?? list[0]?.id ?? ''
        setCurrentUserId(initial)
      })
      .catch((err: Error) => setLoadError(err.message))
  }, [])

  function handleUserChange(userId: string) {
    setCurrentUserId(userId)
    localStorage.setItem(LAST_USER_KEY, userId)
  }

  if (loadError) {
    return (
      <div className="app-shell">
        <p className="error-text">Couldn't connect to Hudson: {loadError}</p>
      </div>
    )
  }

  if (!users || !currentUserId) {
    return (
      <div className="app-shell">
        <p className="muted">Loading Hudson…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Hudson</h1>
        <UserSwitcher
          users={users}
          currentUserId={currentUserId}
          onChange={handleUserChange}
        />
      </header>

      <DateNav dateKey={dateKey} onChange={setDateKey} />

      <main>
        <h2 className="section-title">Medications</h2>
        <MedicationTracker userId={currentUserId} dateKey={dateKey} />

        <h2 className="section-title">Vitals</h2>
        <VitalsForm userId={currentUserId} dateKey={dateKey} />

        <h2 className="section-title">Food</h2>
        <FoodLog userId={currentUserId} dateKey={dateKey} />
      </main>
    </div>
  )
}

export default App
