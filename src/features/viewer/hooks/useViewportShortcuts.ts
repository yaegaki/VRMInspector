import { useEffect, type RefObject } from 'react'
import type { CameraView, SceneController } from '../types'

export function useViewportShortcuts(
  sceneRef: RefObject<SceneController | null>,
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return
      }

      if (event.key === '5') {
        event.preventDefault()
        sceneRef.current?.resetCamera()
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        sceneRef.current?.focusSelectedModelFront()
        return
      }

      const isCtrl = event.ctrlKey || event.metaKey
      let nextView: CameraView | null = null

      if (event.key === '1') {
        nextView = isCtrl ? 'back' : 'front'
      } else if (event.key === '3') {
        nextView = isCtrl ? 'left' : 'right'
      } else if (event.key === '7') {
        nextView = isCtrl ? 'bottom' : 'top'
      }

      if (!nextView) {
        return
      }

      event.preventDefault()
      sceneRef.current?.setView(nextView)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [sceneRef])
}
