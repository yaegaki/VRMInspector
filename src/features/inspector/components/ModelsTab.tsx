import { useState, type DragEvent } from 'react'
import type { InspectorModel } from '../../viewer/hooks/useVrmLoader'

type DropIndicator = {
  modelId: string
  position: 'before' | 'after'
} | null

type ModelsTabProps = {
  models: InspectorModel[]
  selectedModelId: string | null
  modelGap: number
  loadMode: 'add' | 'replace'
  onSelectModel: (modelId: string) => void
  onRemoveModel: (modelId: string) => void
  onMoveModel: (modelId: string, toIndex: number) => void
  onModelGapChange: (gap: number) => void
  onLoadModeChange: (mode: 'add' | 'replace') => void
}

export function ModelsTab({
  models,
  selectedModelId,
  modelGap,
  loadMode,
  onSelectModel,
  onRemoveModel,
  onMoveModel,
  onModelGapChange,
  onLoadModeChange,
}: ModelsTabProps) {
  const [draggingModelId, setDraggingModelId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null)

  if (!models.length) {
    return (
      <div className="detail-list">
        <article className="detail-card">
          <strong>Load Mode</strong>
          <div className="bone-transform-space-toggle">
            <button
              type="button"
              className={`bone-space-button${loadMode === 'replace' ? ' is-active' : ''}`}
              onClick={() => onLoadModeChange('replace')}
            >
              Replace
            </button>
            <button
              type="button"
              className={`bone-space-button${loadMode === 'add' ? ' is-active' : ''}`}
              onClick={() => onLoadModeChange('add')}
            >
              Add
            </button>
          </div>
        </article>
        <p className="empty-state">Load a VRM to see the model list.</p>
      </div>
    )
  }

  return (
    <div className="detail-list">
      <article className="detail-card">
        <strong>Load Mode</strong>
        <div className="bone-transform-space-toggle">
          <button
            type="button"
            className={`bone-space-button${loadMode === 'replace' ? ' is-active' : ''}`}
            onClick={() => onLoadModeChange('replace')}
          >
            Replace
          </button>
          <button
            type="button"
            className={`bone-space-button${loadMode === 'add' ? ' is-active' : ''}`}
            onClick={() => onLoadModeChange('add')}
          >
            Add
          </button>
        </div>
      </article>
      <article className="detail-card">
        <strong>Model Spacing</strong>
        <span>{modelGap.toFixed(2)}</span>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={modelGap}
          onChange={(event) => onModelGapChange(Number(event.target.value))}
        />
      </article>
      {models.map((model) => {
        const isSelected = model.modelId === selectedModelId
        const dropPosition =
          dropIndicator?.modelId === model.modelId ? dropIndicator.position : null
        return (
          <article
            key={model.modelId}
            className={`detail-card model-card${isSelected ? ' is-selected' : ''}${dropPosition === 'before' ? ' is-drop-before' : ''}${dropPosition === 'after' ? ' is-drop-after' : ''}${draggingModelId === model.modelId ? ' is-dragging' : ''}`}
            draggable
            onDragStart={(event) => handleDragStart(event, model.modelId, setDraggingModelId)}
            onDragOver={(event) => handleDragOver(event, model.modelId, setDropIndicator)}
            onDrop={(event) =>
              handleDrop(
                event,
                model.modelId,
                models,
                draggingModelId,
                onMoveModel,
                setDraggingModelId,
                setDropIndicator,
              )
            }
            onDragEnd={() => {
              setDraggingModelId(null)
              setDropIndicator(null)
            }}
          >
            <button
              type="button"
              className="model-card-button"
              onClick={() => onSelectModel(model.modelId)}
            >
              <strong>{model.inspector.fileName}</strong>
              <span>
                {model.inspector.meta.find((item) => item.label === 'Name')?.value ??
                  model.inspector.meta.find((item) => item.label === 'Title')?.value ??
                  'Unnamed model'}
              </span>
            </button>
            <div className="model-card-actions">
              <button
                type="button"
                className="bone-reset-button"
                onClick={() => onRemoveModel(model.modelId)}
              >
                Remove
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function handleDragStart(
  event: DragEvent<HTMLElement>,
  modelId: string,
  setDraggingModelId: (modelId: string) => void,
) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', modelId)
  setDraggingModelId(modelId)
}

function handleDragOver(
  event: DragEvent<HTMLElement>,
  modelId: string,
  setDropIndicator: (indicator: DropIndicator) => void,
) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  const rect = event.currentTarget.getBoundingClientRect()
  const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  setDropIndicator({ modelId, position })
}

function handleDrop(
  event: DragEvent<HTMLElement>,
  targetModelId: string,
  models: InspectorModel[],
  draggingModelId: string | null,
  onMoveModel: (modelId: string, toIndex: number) => void,
  setDraggingModelId: (modelId: string | null) => void,
  setDropIndicator: (indicator: DropIndicator) => void,
) {
  event.preventDefault()
  const sourceModelId = draggingModelId ?? event.dataTransfer.getData('text/plain')
  const targetIndex = models.findIndex((model) => model.modelId === targetModelId)
  const rect = event.currentTarget.getBoundingClientRect()
  const insertAfter = event.clientY >= rect.top + rect.height / 2

  if (sourceModelId && targetIndex >= 0) {
    const sourceIndex = models.findIndex((model) => model.modelId === sourceModelId)
    let nextIndex = targetIndex + (insertAfter ? 1 : 0)

    if (sourceIndex >= 0 && sourceIndex < nextIndex) {
      nextIndex -= 1
    }

    onMoveModel(sourceModelId, nextIndex)
  }

  setDraggingModelId(null)
  setDropIndicator(null)
}
