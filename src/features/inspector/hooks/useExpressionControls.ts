import { useState, type RefObject } from 'react'
import type { InspectorData } from '../../../lib/vrmInspector'
import type { SceneController } from '../../viewer/types'

export function useExpressionControls(sceneRef: RefObject<SceneController | null>) {
  const [expressionValues, setExpressionValues] = useState<Record<string, number>>({})

  function handleExpressionChange(name: string, value: number) {
    sceneRef.current?.setExpression(name, value)
    setExpressionValues((current) => ({ ...current, [name]: value }))
  }

  function resetExpressionValues(nextExpressions: InspectorData['expressions']) {
    setExpressionValues(
      Object.fromEntries(
        nextExpressions.map((expression) => [expression.name, expression.currentWeight]),
      ),
    )
  }

  return {
    expressionValues,
    resetExpressionValues,
    handleExpressionChange,
  }
}
