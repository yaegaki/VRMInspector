import type { InspectorData } from '../../../lib/vrmInspector'

export function MaterialsTab({ materials }: { materials: InspectorData['materials'] }) {
  if (!materials.length) {
    return <p className="empty-state">No materials found in this VRM.</p>
  }

  return (
    <div className="detail-list">
      {materials.map((material) => (
        <article key={material.name} className="detail-card">
          <strong>{material.name}</strong>
          <span>{material.type}</span>
          <span>
            opacity {material.opacity.toFixed(2)} / {material.side}
          </span>
          <span>
            {material.transparent ? 'transparent' : 'opaque'}
            {material.color ? ` / ${material.color}` : ''}
          </span>
          <span>
            {material.textureSlots.length > 0
              ? material.textureSlots.join(', ')
              : 'texture slots: none'}
          </span>
        </article>
      ))}
    </div>
  )
}
