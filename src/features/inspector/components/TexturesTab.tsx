import { useState } from 'react'
import { createTextureDownloadUrl, createTexturePreviewUrl } from '../../../lib/texturePreview'
import type { InspectorData } from '../../../lib/vrmInspector'

type TexturesTabProps = {
  textures: InspectorData['textures']
}

export function TexturesTab({ textures }: TexturesTabProps) {
  if (!textures.length) {
    return <p className="empty-state">No textures found in this VRM.</p>
  }

  return (
    <div className="detail-list">
      {textures.map((texture) => (
        <TextureCard key={texture.id} texture={texture} />
      ))}
    </div>
  )
}

function TextureCard({ texture }: { texture: InspectorData['textures'][number] }) {
  const [previewUrl] = useState(() => createTexturePreviewUrl(texture.sourceImage))

  function handleDownload() {
    const downloadUrl = createTextureDownloadUrl(texture.sourceImage)
    if (!downloadUrl) {
      return
    }

    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = texture.downloadFileName
    link.click()
  }

  return (
    <article className="detail-card">
      {previewUrl ? (
        <div className="texture-preview-frame" aria-hidden="true">
          <img className="texture-preview" src={previewUrl} alt={texture.label} />
        </div>
      ) : null}
      <strong>{texture.label}</strong>
      {texture.textureNames.length > 1 ? (
        <span>{texture.textureNames.join(', ')}</span>
      ) : null}
      <span>{texture.image}</span>
      <span>{texture.colorSpace}</span>
      <span>flipY: {texture.flipY}</span>
      <span>mapping: {texture.mapping}</span>
      <span>{texture.slots.join(', ')}</span>
      <button
        type="button"
        className="secondary-button secondary-button-compact"
        onClick={handleDownload}
      >
        Download
      </button>
    </article>
  )
}
