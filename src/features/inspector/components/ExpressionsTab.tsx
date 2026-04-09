import type { InspectorData } from '../../../lib/vrmInspector'

type ExpressionsTabProps = {
  expressions: InspectorData['expressions']
  expressionValues: Record<string, number>
  onExpressionChange: (name: string, value: number) => void
}

export function ExpressionsTab({
  expressions,
  expressionValues,
  onExpressionChange,
}: ExpressionsTabProps) {
  if (!expressions.length) {
    return <p className="empty-state">Load a VRM to see expressions.</p>
  }

  return (
    <div className="expression-list">
      {expressions.map((expression) => {
        const value = expressionValues[expression.name] ?? 0
        return (
          <label key={expression.name} className="expression-row">
            <div className="expression-head">
              <div>
                <strong>{expression.name}</strong>
                <span>
                  binds {expression.binds}
                  {expression.isBinary ? ' / binary' : ''}
                </span>
              </div>
              <output>{value.toFixed(2)}</output>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={value}
              onChange={(event) =>
                onExpressionChange(expression.name, Number(event.target.value))
              }
            />
          </label>
        )
      })}
    </div>
  )
}
