import type { HudsonUser } from '../lib/types'

interface Props {
  users: HudsonUser[]
  currentUserId: string
  onChange: (userId: string) => void
}

export function UserSwitcher({ users, currentUserId, onChange }: Props) {
  return (
    <select
      className="user-switcher"
      value={currentUserId}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Current user"
    >
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  )
}
