import { startTransition, useMemo, useRef, useState, type RefObject } from 'react'
import type {
  LoadedAnimationSource,
  LoadedAnimationState,
  LoadErrorState,
  SceneController,
} from '../types'
import { inspectVRM, type InspectorData } from '../../../lib/vrmInspector'

export type InspectorModel = {
  modelId: string
  inspector: InspectorData
}

type UseVrmLoaderOptions = {
  sceneRef: RefObject<SceneController | null>
}

export function useVrmLoader({ sceneRef }: UseVrmLoaderOptions) {
  const loadedAnimationSourceRef = useRef<LoadedAnimationSource | null>(null)
  const [models, setModels] = useState<InspectorModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null)
  const [loadedAnimation, setLoadedAnimation] = useState<LoadedAnimationState | null>(null)

  const inspector = useMemo(
    () => models.find((model) => model.modelId === selectedModelId)?.inspector ?? null,
    [models, selectedModelId],
  )

  async function loadVrmFile(file: File, options?: { append?: boolean }) {
    await loadVrmFiles([file], options)
  }

  async function loadVrmFiles(files: File[], options?: { append?: boolean }) {
    if (!sceneRef.current) {
      return
    }

    const vrmFiles = files.filter((file) => file.name.toLowerCase().endsWith('.vrm'))
    if (!vrmFiles.length) {
      return
    }

    const append = options?.append === true
    const loadStartedAt = performance.now()
    setIsLoading(true)
    setLoadError(null)

    try {
      const rememberedAnimationSource = loadedAnimationSourceRef.current
      const rememberedPlaybackState = sceneRef.current.getAnimationPlaybackState()
      const nextModels = append ? [...models] : []
      let lastLoadedModelId: string | null = null
      let hasLoadedAny = append
      const failedFileNames: string[] = []

      for (const [index, file] of vrmFiles.entries()) {
        const shouldAppend = append || hasLoadedAny

        try {
          console.info('[VRM load] start', {
            fileName: file.name,
            fileSizeBytes: file.size,
            append: shouldAppend,
            batchSize: vrmFiles.length,
            batchIndex: index,
          })

          const arrayBuffer = await file.arrayBuffer()
          console.info('[VRM load] file.arrayBuffer complete', {
            fileName: file.name,
            elapsedMs: roundDuration(performance.now() - loadStartedAt),
          })

          const result = shouldAppend
            ? await sceneRef.current.add(arrayBuffer, file.name)
            : await sceneRef.current.load(arrayBuffer, file.name)
          console.info('[VRM load] scene controller load complete', {
            fileName: file.name,
            elapsedMs: roundDuration(performance.now() - loadStartedAt),
          })

          const nextInspector = inspectVRM(result.vrm, file.name)
          console.info('[VRM load] inspectVRM complete', {
            fileName: file.name,
            elapsedMs: roundDuration(performance.now() - loadStartedAt),
          })

          if (shouldAppend) {
            nextModels.push({ modelId: result.modelId, inspector: nextInspector })
          } else {
            nextModels.splice(0, nextModels.length, {
              modelId: result.modelId,
              inspector: nextInspector,
            })
          }

          hasLoadedAny = true
          lastLoadedModelId = result.modelId
        } catch (error) {
          console.error(error)
          failedFileNames.push(file.name)
        }
      }

      if (!nextModels.length) {
        if (failedFileNames.length) {
          setLoadError({
            title: 'Failed to load VRM',
            message: `Could not load: ${failedFileNames.join(', ')}`,
          })
        }
        return
      }

      let nextLoadedAnimation: LoadedAnimationState | null = loadedAnimation
      let nextLoadError: LoadErrorState | null =
        failedFileNames.length > 0
          ? {
              title: 'Some VRMs failed to load',
              message: `Loaded available files. Failed: ${failedFileNames.join(', ')}`,
            }
          : null

      if (rememberedAnimationSource && nextModels.length) {
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
          nextLoadedAnimation = null
        }
      }

      console.info('[VRM load] state commit scheduled', {
        fileName: vrmFiles.map((file) => file.name).join(', '),
        elapsedMs: roundDuration(performance.now() - loadStartedAt),
      })

      startTransition(() => {
        setModels(nextModels)
        setSelectedModelId(lastLoadedModelId)
        if (lastLoadedModelId) {
          sceneRef.current?.selectModel(lastLoadedModelId)
        }
        setLoadedAnimation(nextLoadedAnimation)
        setLoadError(nextLoadError)
      })

      console.info('[VRM load] success', {
        fileName: vrmFiles.map((file) => file.name).join(', '),
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

      if (!models.length) {
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

  function selectModel(modelId: string) {
    setSelectedModelId(modelId)
    sceneRef.current?.selectModel(modelId)
  }

  function removeModel(modelId: string) {
    sceneRef.current?.removeModel(modelId)
    setModels((current) => {
      const nextModels = current.filter((model) => model.modelId !== modelId)
      const nextSelectedModelId =
        selectedModelId === modelId ? (nextModels[0]?.modelId ?? null) : selectedModelId
      setSelectedModelId(nextSelectedModelId)
      if (nextSelectedModelId) {
        sceneRef.current?.selectModel(nextSelectedModelId)
      }
      return nextModels
    })
  }

  function moveModel(modelId: string, toIndex: number) {
    sceneRef.current?.moveModel(modelId, toIndex)
    setModels((current) => {
      const index = current.findIndex((model) => model.modelId === modelId)
      const nextIndex = Math.max(0, Math.min(toIndex, current.length - 1))
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      if (index === nextIndex) {
        return current
      }

      const nextModels = [...current]
      const [movingModel] = nextModels.splice(index, 1)
      nextModels.splice(nextIndex, 0, movingModel)
      return nextModels
    })
  }

  return {
    models,
    selectedModelId,
    inspector,
    isLoading,
    loadError,
    loadedAnimation,
    loadVrmFile,
    loadVrmFiles,
    loadVrmaFile,
    clearAnimation,
    clearLoadError: () => setLoadError(null),
    setLoadedAnimation,
    selectModel,
    removeModel,
    moveModel,
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
