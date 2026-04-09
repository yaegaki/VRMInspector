import type { InspectorData } from '../../../lib/vrmInspector'

export function MetaTab({ inspector }: { inspector: InspectorData | null }) {
  if (!inspector) {
    return <p className="empty-state">Load a VRM to see metadata.</p>
  }

  return (
    <dl className="meta-list">
      {inspector.meta.map((item) => (
        <div key={item.label} className="meta-row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
