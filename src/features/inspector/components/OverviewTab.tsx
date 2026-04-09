import type { InspectorData } from '../../../lib/vrmInspector'

export function OverviewTab({ inspector }: { inspector: InspectorData | null }) {
  if (!inspector) {
    return <p className="empty-state">Load a VRM to see the overview.</p>
  }

  return (
    <div className="stats-grid">
      {inspector.stats.map((item) => (
        <article key={item.label} className="stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </div>
  )
}
