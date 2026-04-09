import { useEffect, useRef, useState, type RefObject } from 'react'

type DropZone = 'viewer' | 'panel'

type UseFileDropZoneOptions = {
  viewerRef: RefObject<HTMLDivElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  onDropFile: (file: File) => void
}

export function useFileDropZone({
  viewerRef,
  panelRef,
  onDropFile,
}: UseFileDropZoneOptions) {
  const dragDepthRef = useRef<Record<DropZone, number>>({
    viewer: 0,
    panel: 0,
  })
  const [activeDropZone, setActiveDropZone] = useState<DropZone | null>(null)

  useEffect(() => {
    const viewerZone = viewerRef.current
    const actionZone = panelRef.current
    if (!viewerZone || !actionZone) {
      return
    }

    const zones = [
      { element: viewerZone, zone: 'viewer' as const },
      { element: actionZone, zone: 'panel' as const },
    ]

    const hasDraggedFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const preventWindowDrop = (event: DragEvent) => {
      if (hasDraggedFiles(event)) {
        event.preventDefault()
      }
    }

    const handleDragEnter = (zone: DropZone) => (event: DragEvent) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current[zone] += 1
      setActiveDropZone(zone)
    }

    const handleDragOver = (zone: DropZone) => (event: DragEvent) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
      setActiveDropZone(zone)
    }

    const handleDragLeave = (zone: DropZone) => (event: DragEvent) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current[zone] = Math.max(0, dragDepthRef.current[zone] - 1)
      if (dragDepthRef.current[zone] === 0) {
        setActiveDropZone((current) => (current === zone ? null : current))
      }
    }

    const handleDrop = () => (event: DragEvent) => {
      if (!hasDraggedFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current.viewer = 0
      dragDepthRef.current.panel = 0
      setActiveDropZone(null)

      const files = Array.from(event.dataTransfer?.files ?? [])
      const vrmFile = files.find((candidate) =>
        candidate.name.toLowerCase().endsWith('.vrm'),
      )
      const vrmaFile = files.find((candidate) =>
        candidate.name.toLowerCase().endsWith('.vrma'),
      )

      if (vrmFile) {
        onDropFile(vrmFile)
        return
      }

      if (vrmaFile) {
        onDropFile(vrmaFile)
      }
    }

    window.addEventListener('dragover', preventWindowDrop)
    window.addEventListener('drop', preventWindowDrop)

    const listeners = zones.map(({ element, zone }) => ({
      element,
      dragEnter: handleDragEnter(zone),
      dragOver: handleDragOver(zone),
      dragLeave: handleDragLeave(zone),
      drop: handleDrop(),
    }))

    for (const listener of listeners) {
      listener.element.addEventListener('dragenter', listener.dragEnter)
      listener.element.addEventListener('dragover', listener.dragOver)
      listener.element.addEventListener('dragleave', listener.dragLeave)
      listener.element.addEventListener('drop', listener.drop)
    }

    return () => {
      window.removeEventListener('dragover', preventWindowDrop)
      window.removeEventListener('drop', preventWindowDrop)
      for (const listener of listeners) {
        listener.element.removeEventListener('dragenter', listener.dragEnter)
        listener.element.removeEventListener('dragover', listener.dragOver)
        listener.element.removeEventListener('dragleave', listener.dragLeave)
        listener.element.removeEventListener('drop', listener.drop)
      }
    }
  }, [onDropFile, panelRef, viewerRef])

  return { activeDropZone }
}
