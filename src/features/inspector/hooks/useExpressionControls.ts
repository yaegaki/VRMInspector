import { useState, type RefObject } from 'react'
import type { InspectorData } from '../../../lib/vrmInspector'
import type { SceneController } from '../../viewer/types'

export function useExpressionControls(sceneRef: RefObject<SceneController | null>) {
  const [expressionValuesByModel, setExpressionValuesByModel] = useState<
    Record<string, Record<string, number>>
  >({})

  function handleExpressionChange(modelId: string, name: string, value: number) {
    sceneRef.current?.setExpression(name, value)
    setExpressionValuesByModel((current) => ({
      ...current,
      [modelId]: {
        ...(current[modelId] ?? {}),
        [name]: value,
      },
    }))
  }

  function resetExpressionValues(
    modelId: string,
    nextExpressions: InspectorData['expressions'],
  ) {
    setExpressionValuesByModel((current) => ({
      ...current,
      [modelId]: Object.fromEntries(
        nextExpressions.map((expression) => [expression.name, expression.currentWeight]),
      ),
    }))
  }

  return {
    expressionValuesByModel,
    resetExpressionValues,
    handleExpressionChange,
  }
}
