export function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? 'badge--success' : 'badge--muted'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function RoleBadge({ role }) {
  return (
    <span className={`badge ${role === 'admin' ? 'badge--primary' : 'badge--neutral'}`}>
      {role === 'admin' ? 'Admin' : 'Student'}
    </span>
  )
}
