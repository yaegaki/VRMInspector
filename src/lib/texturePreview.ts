export function createTexturePreviewUrl(image: unknown) {
  return createTextureDataUrl(image, 144)
}

export function createTextureDownloadUrl(image: unknown) {
  return createTextureDataUrl(image)
}

function createTextureDataUrl(image: unknown, maxSize?: number) {
  if (!isPreviewableImage(image)) {
    return null
  }

  const width = 'width' in image && typeof image.width === 'number' ? image.width : 0
  const height = 'height' in image && typeof image.height === 'number' ? image.height : 0
  if (!width || !height) {
    return null
  }

  const scale = maxSize ? Math.min(maxSize / width, maxSize / height, 1) : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

function isPreviewableImage(
  image: unknown,
): image is CanvasImageSource & { width: number; height: number } {
  if (typeof image !== 'object' || image === null) {
    return false
  }

  return (
    'width' in image &&
    typeof image.width === 'number' &&
    'height' in image &&
    typeof image.height === 'number'
  )
}
