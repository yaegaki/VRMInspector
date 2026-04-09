import { startTransition, useRef, useState, type RefObject } from 'react'
import type {
  LoadedAnimationSource,
  LoadedAnimationState,
  LoadErrorState,
  SceneController,
} from '../types'
import { inspectVRM, type InspectorData } from '../../../lib/vrmInspector'

type UseVrmLoaderOptions = {
  sceneRef: RefObject<SceneController | null>
  onVrmLoaded: (inspector: InspectorData) => void
}

export function useVrmLoader({ sceneRef, onVrmLoaded }: UseVrmLoaderOptions) {
  const loadedAnimationSourceRef = useRef<LoadedAnimationSource | null>(null)
  const [inspector, setInspector] = useState<InspectorData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null)
  const [loadedAnimation, setLoadedAnimation] = useState<LoadedAnimationState | null>(null)

  async function loadVrmFile(file: File) {
    if (!sceneRef.current) {
      return
    }

    const loadStartedAt = performance.now()
    setIsLoading(true)
    setLoadError(null)

    try {
      const rememberedAnimationSource = loadedAnimationSourceRef.current
      const rememberedPlaybackState = sceneRef.current.getAnimationPlaybackState()
      console.info('[VRM load] start', {
        fileName: file.name,
        fileSizeBytes: file.size,
      })

      const arrayBuffer = await file.arrayBuffer()
      console.info('[VRM load] file.arrayBuffer complete', {
        fileName: file.name,
        elapsedMs: roundDuration(performance.now() - loadStartedAt),
      })

      const vrm = await sceneRef.current.load(arrayBuffer)
      console.info('[VRM load] scene controller load complete', {
        fileName: file.name,
        elapsedMs: roundDuration(performance.now() - loadStartedAt),
      })

      const nextInspector = inspectVRM(vrm, file.name)
      console.info('[VRM load] inspectVRM complete', {
        fileName: file.name,
        elapsedMs: roundDuration(performance.now() - loadStartedAt),
      })

      let nextLoadedAnimation: LoadedAnimationState | null = null
      let nextLoadError: LoadErrorState | null = null

      if (rememberedAnimationSource) {
        try {
          nextLoadedAnimation = await sceneRef.current.loadAnimation(
            rememberedAnimationSource.arrayBuffer.slice(0),
            rememberedAnimationSource.fileName,
            rememberedPlaybackState ?? undefined,
          )
        } catch (error) {
          console.error(error)
          sceneRef.current.clearAnimation()
          loadedAnimationSourceRef.current = null
          nextLoadError = getLoadErrorDetails(error, 'VRMA')
        }
      }

      console.info('[VRM load] state commit scheduled', {
        fileName: file.name,
        elapsedMs: roundDuration(performance.now() - loadStartedAt),
      })

      startTransition(() => {
        setInspector(nextInspector)
        setLoadedAnimation(nextLoadedAnimation)
        setLoadError(nextLoadError)
        onVrmLoaded(nextInspector)
      })

      console.info('[VRM load] success', {
        fileName: file.name,
        totalElapsedMs: roundDuration(performance.now() - loadStartedAt),
      })
    } catch (error) {
      console.error(error)
      setLoadError(getLoadErrorDetails(error, 'VRM'))
    } finally {
      setIsLoading(false)
    }
  }

  async function loadVrmaFile(file: File) {
    if (!sceneRef.current) {
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()

      if (!inspector) {
        loadedAnimationSourceRef.current = {
          fileName: file.name,
          arrayBuffer,
        }
        setLoadedAnimation({
          fileName: file.name,
          currentTime: 0,
          duration: null,
          isPlaying: false,
          status: 'pending',
        })
        return
      }

      const animationState = await sceneRef.current.loadAnimation(arrayBuffer, file.name)
      loadedAnimationSourceRef.current = {
        fileName: file.name,
        arrayBuffer,
      }
      setLoadedAnimation(animationState)
    } catch (error) {
      console.error(error)
      setLoadError(getLoadErrorDetails(error, 'VRMA'))
    } finally {
      setIsLoading(false)
    }
  }

  function clearAnimation() {
    sceneRef.current?.clearAnimation()
    loadedAnimationSourceRef.current = null
    setLoadedAnimation(null)
  }

  return {
    inspector,
    isLoading,
    loadError,
    loadedAnimation,
    loadVrmFile,
    loadVrmaFile,
    clearAnimation,
    clearLoadError: () => setLoadError(null),
    setLoadedAnimation,
  }
}

function getLoadErrorDetails(
  error: unknown,
  fileType: 'VRM' | 'VRMA',
): LoadErrorState {
  if (error instanceof Error && error.message) {
    return {
      title: `Failed to load ${fileType}`,
      message: error.message,
    }
  }

  return {
    title: `Failed to load ${fileType}`,
    message:
      fileType === 'VRM'
        ? 'The file is invalid or uses VRM data this app cannot handle. Try another .vrm file.'
        : 'The file is invalid or uses VRM animation data this app cannot handle. Try another .vrma file.',
  }
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100
}
