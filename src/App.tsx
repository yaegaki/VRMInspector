import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import './App.css'
import { BonesTab } from './features/inspector/components/BonesTab'
import { ExpressionsTab } from './features/inspector/components/ExpressionsTab'
import { HelpTab } from './features/inspector/components/HelpTab'
import { MaterialsTab } from './features/inspector/components/MaterialsTab'
import { MetaTab } from './features/inspector/components/MetaTab'
import { OverviewTab } from './features/inspector/components/OverviewTab'
import { TexturesTab } from './features/inspector/components/TexturesTab'
import { useBoneEditor } from './features/inspector/hooks/useBoneEditor'
import { useExpressionControls } from './features/inspector/hooks/useExpressionControls'
import { useFileDropZone } from './features/viewer/hooks/useFileDropZone'
import { useVrmLoader } from './features/viewer/hooks/useVrmLoader'
import { useViewportShortcuts } from './features/viewer/hooks/useViewportShortcuts'
import type { DebugViewMode, SceneController } from './features/viewer/types'

type InspectorTab =
  | 'overview'
  | 'meta'
  | 'expressions'
  | 'textures'
  | 'materials'
  | 'bones'
  | 'help'

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'meta', label: 'Meta' },
  { id: 'expressions', label: 'Expressions' },
  { id: 'textures', label: 'Textures' },
  { id: 'materials', label: 'Materials' },
  { id: 'bones', label: 'Bones' },
  { id: 'help', label: 'Help' },
]

function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dropZoneRef = useRef<HTMLDivElement | null>(null)
  const actionDropZoneRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const animationInputRef = useRef<HTMLInputElement | null>(null)
  const sceneRef = useRef<SceneController | null>(null)
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview')
  const [debugViewMode, setDebugViewMode] = useState<DebugViewMode>('standard')
  const [showSpringBones, setShowSpringBones] = useState(false)
  const [showColliders, setShowColliders] = useState(false)

  const boneEditor = useBoneEditor(sceneRef)
  const expressionControls = useExpressionControls(sceneRef)
  const {
    inspector,
    isLoading,
    loadError,
    loadedAnimation,
    loadVrmFile,
    loadVrmaFile,
    clearAnimation,
    clearLoadError,
    setLoadedAnimation,
  } = useVrmLoader({
    sceneRef,
    onVrmLoaded(nextInspector) {
      boneEditor.resetSelection()
      expressionControls.resetExpressionValues(nextInspector.expressions)
    },
  })
  const expressionList = inspector?.expressions ?? []

  const syncAnimationPlaybackState = useEffectEvent(() => {
    const playbackState = sceneRef.current?.getAnimationPlaybackState()
    if (!playbackState) {
      return
    }

    setLoadedAnimation((current) => {
      if (!current || current.status !== 'ready') {
        return current
      }

      if (
        current.isPlaying === playbackState.isPlaying &&
        Math.abs(current.currentTime - playbackState.time) < 0.01
      ) {
        return current
      }

      return {
        ...current,
        currentTime: playbackState.time,
        isPlaying: playbackState.isPlaying,
      }
    })
  })

  function handleDroppedFile(file: File) {
    if (file.name.toLowerCase().endsWith('.vrm')) {
      void loadVrmFile(file)
      return
    }

    if (file.name.toLowerCase().endsWith('.vrma')) {
      void loadVrmaFile(file)
    }
  }

  const { activeDropZone } = useFileDropZone({
    viewerRef: dropZoneRef,
    panelRef: actionDropZoneRef,
    onDropFile: handleDroppedFile,
  })

  useViewportShortcuts(sceneRef)

  useEffect(() => {
    if (loadedAnimation?.status !== 'ready') {
      return
    }

    let frameId = 0

    const tick = () => {
      syncAnimationPlaybackState()
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [loadedAnimation?.status])

  useEffect(() => {
    if (!viewportRef.current) {
      return
    }

    let disposed = false
    let disposeScene: (() => void) | undefined

    void import('./features/viewer/scene/createSceneController').then(
      ({ createSceneController }) => {
        if (disposed || !viewportRef.current) {
          return
        }

        const sceneController = createSceneController(viewportRef.current)
        sceneRef.current = sceneController
        disposeScene = () => {
          sceneController.dispose()
          sceneRef.current = null
        }
      },
    )

    return () => {
      disposed = true
      disposeScene?.()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setDebugMode(debugViewMode)
  }, [debugViewMode])

  useEffect(() => {
    sceneRef.current?.setSpringBoneHelpersVisible(showSpringBones)
  }, [showSpringBones])

  useEffect(() => {
    sceneRef.current?.setColliderHelpersVisible(showColliders)
  }, [showColliders])

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    void loadVrmFile(file)
    event.target.value = ''
  }

  function handleAnimationSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    void loadVrmaFile(file)
    event.target.value = ''
  }

  function handleDebugViewModeChange(mode: DebugViewMode) {
    setDebugViewMode(mode)
  }

  function handleSpringBonesVisibleChange(checked: boolean) {
    setShowSpringBones(checked)
  }

  function handleCollidersVisibleChange(checked: boolean) {
    setShowColliders(checked)
  }

  function handleAnimationPlaybackToggle() {
    if (!loadedAnimation || loadedAnimation.status !== 'ready' || !sceneRef.current) {
      return
    }

    const isPlaying = sceneRef.current.setAnimationPlaying(!loadedAnimation.isPlaying)
    setLoadedAnimation((current) => (current ? { ...current, isPlaying } : current))
  }

  function handleAnimationRestart() {
    if (!sceneRef.current || loadedAnimation?.status !== 'ready') {
      return
    }

    const isPlaying = sceneRef.current.restartAnimation()
    setLoadedAnimation((current) => (current ? { ...current, isPlaying } : current))
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <div
          ref={dropZoneRef}
          className={`viewport-card${activeDropZone === 'viewer' ? ' is-dragging' : ''}`}
        >
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept=".vrm"
            onChange={handleFileSelection}
          />
          <input
            ref={animationInputRef}
            className="file-input"
            type="file"
            accept=".vrma"
            onChange={handleAnimationSelection}
          />
          <div
            ref={actionDropZoneRef}
            className={`actions actions-overlay${activeDropZone === 'panel' ? ' is-dragging' : ''}`}
          >
            <div className="button-row">
              <button
                className="primary-button"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Load VRM
              </button>
              <button
                className="secondary-button"
                onClick={() => animationInputRef.current?.click()}
                type="button"
                disabled={!inspector || isLoading}
              >
                Load VRMA
              </button>
              <label className="debug-select">
                <span>View</span>
                <select
                  value={debugViewMode}
                  onChange={(event) =>
                    handleDebugViewModeChange(event.target.value as DebugViewMode)
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="normal">Normal</option>
                  <option value="litShadeRate">Lit / Shade</option>
                  <option value="uv">UV</option>
                </select>
              </label>
              <label className="toggle-chip">
                <input
                  type="checkbox"
                  checked={showColliders}
                  onChange={(event) => handleCollidersVisibleChange(event.target.checked)}
                />
                <span>Colliders</span>
              </label>
              <label className="toggle-chip">
                <input
                  type="checkbox"
                  checked={showSpringBones}
                  onChange={(event) =>
                    handleSpringBonesVisibleChange(event.target.checked)
                  }
                />
                <span>Spring Bones</span>
              </label>
            </div>
            {loadedAnimation ? (
              <div className="animation-status">
                <div className="animation-status-info">
                  <strong>{loadedAnimation.fileName}</strong>
                  <span>
                    {loadedAnimation.status === 'pending'
                      ? 'Waiting for a VRM to be loaded'
                      : `${loadedAnimation.currentTime.toFixed(2)}s / ${loadedAnimation.duration?.toFixed(2) ?? '0.00'}s`}
                  </span>
                </div>
                <div className="animation-status-actions">
                  <button
                    className="secondary-button secondary-button-compact"
                    onClick={handleAnimationPlaybackToggle}
                    type="button"
                    disabled={loadedAnimation.status !== 'ready'}
                  >
                    {loadedAnimation.isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    className="secondary-button secondary-button-compact"
                    onClick={handleAnimationRestart}
                    type="button"
                    disabled={loadedAnimation.status !== 'ready'}
                  >
                    Restart
                  </button>
                  <button
                    className="secondary-button secondary-button-compact"
                    onClick={clearAnimation}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div ref={viewportRef} className="viewport" />
          <div className="viewport-overlay">
            <p>Left Drag: orbit</p>
            <p>Middle Drag: pan</p>
            <p>Right Drag: pan</p>
            <p>Wheel: zoom</p>
            <p>1/3/7: front/right/top</p>
            <p>Ctrl+1/3/7: back/left/bottom</p>
            <p>5: reset</p>
            {isLoading ? <p className="loading-pill">Loading...</p> : null}
          </div>
          {loadError ? (
            <div className="error-banner" role="alert" aria-live="polite">
              <div className="error-banner-body">
                <strong>{loadError.title}</strong>
                <p>{loadError.message}</p>
              </div>
              <button
                type="button"
                className="error-banner-close"
                onClick={clearLoadError}
                aria-label="Close error message"
              >
                Close
              </button>
            </div>
          ) : null}
        </div>

        <aside className="inspector">
          <div className="tab-bar-shell">
            <div className="tab-bar" role="tablist" aria-label="Inspector tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`tab-button${activeTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="inspector-body">
            {activeTab === 'overview' ? (
              <InfoSection title="Overview">
                <OverviewTab inspector={inspector} />
              </InfoSection>
            ) : null}

            {activeTab === 'meta' ? (
              <InfoSection title="Meta">
                <MetaTab inspector={inspector} />
              </InfoSection>
            ) : null}

            {activeTab === 'expressions' ? (
              <InfoSection title="Expressions">
                <ExpressionsTab
                  expressions={expressionList}
                  expressionValues={expressionControls.expressionValues}
                  onExpressionChange={expressionControls.handleExpressionChange}
                />
              </InfoSection>
            ) : null}

            {activeTab === 'textures' ? (
              <InfoSection title="Textures">
                <TexturesTab textures={inspector?.textures ?? []} />
              </InfoSection>
            ) : null}

            {activeTab === 'materials' ? (
              <InfoSection title="Materials">
                <MaterialsTab materials={inspector?.materials ?? []} />
              </InfoSection>
            ) : null}

            {activeTab === 'bones' ? (
              <InfoSection title="All Bones">
                <BonesTab
                  bones={inspector?.bones ?? []}
                  selectedBoneKey={boneEditor.selectedBoneKey}
                  selectedBoneTransform={boneEditor.selectedBoneTransform}
                  boneTransformSpace={boneEditor.boneTransformSpace}
                  onSelectBone={boneEditor.handleSelectBone}
                  onBoneTransformSpaceChange={boneEditor.handleBoneTransformSpaceChange}
                  onBoneTransformReset={boneEditor.handleBoneTransformReset}
                  onAllBoneTransformsReset={boneEditor.handleAllBoneTransformsReset}
                  onBoneTransformAxisChange={boneEditor.handleBoneTransformAxisChange}
                  onBoneTransformDragStart={boneEditor.handleBoneTransformDragStart}
                />
              </InfoSection>
            ) : null}

            {activeTab === 'help' ? (
              <InfoSection title="Help">
                <HelpTab />
              </InfoSection>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  )
}

function InfoSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="info-section">
      <div className="section-header">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default App
