import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { InspectorData } from '../../../lib/vrmInspector'
import type { BoneTransform, BoneTransformSpace } from '../../viewer/types'

type BonesTabProps = {
  bones: InspectorData['bones']
  selectedBoneKey: string | null
  selectedBoneTransform: BoneTransform | null
  boneTransformSpace: BoneTransformSpace
  onSelectBone: (boneKey: string) => void
  onBoneTransformSpaceChange: (space: BoneTransformSpace) => void
  onBoneTransformReset: () => void
  onAllBoneTransformsReset: () => void
  onBoneTransformAxisChange: (
    group: keyof BoneTransform,
    axis: 'x' | 'y' | 'z',
    value: string,
  ) => void
  onBoneTransformDragStart: (
    group: keyof BoneTransform,
    axis: 'x' | 'y' | 'z',
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => void
}

export function BonesTab({
  bones,
  selectedBoneKey,
  selectedBoneTransform,
  boneTransformSpace,
  onSelectBone,
  onBoneTransformSpaceChange,
  onBoneTransformReset,
  onAllBoneTransformsReset,
  onBoneTransformAxisChange,
  onBoneTransformDragStart,
}: BonesTabProps) {
  if (!bones.length) {
    return <p className="empty-state">Load a VRM to see bones.</p>
  }

  return (
    <>
      <div className="bone-transform-sticky">
        <div className="bone-transform-card">
          <div className="bone-transform-header">
            <strong>{selectedBoneKey ? 'Selected Bone' : 'Bone Transform'}</strong>
            <div className="bone-transform-header-actions">
              <div className="bone-transform-space-toggle">
                <button
                  type="button"
                  className={`bone-space-button${boneTransformSpace === 'local' ? ' is-active' : ''}`}
                  onClick={() => onBoneTransformSpaceChange('local')}
                >
                  Local
                </button>
                <button
                  type="button"
                  className={`bone-space-button${boneTransformSpace === 'world' ? ' is-active' : ''}`}
                  onClick={() => onBoneTransformSpaceChange('world')}
                >
                  World
                </button>
              </div>
              <button
                type="button"
                className="bone-reset-button"
                onClick={onBoneTransformReset}
                disabled={!selectedBoneTransform}
              >
                Reset
              </button>
            </div>
          </div>
          {selectedBoneTransform ? (
            <div className="bone-transform-list">
              <BoneTransformRow
                label="Position X"
                value={selectedBoneTransform.position.x}
                step="0.01"
                onPointerDown={(event) => onBoneTransformDragStart('position', 'x', event)}
                onChange={(value) => onBoneTransformAxisChange('position', 'x', value)}
              />
              <BoneTransformRow
                label="Position Y"
                value={selectedBoneTransform.position.y}
                step="0.01"
                onPointerDown={(event) => onBoneTransformDragStart('position', 'y', event)}
                onChange={(value) => onBoneTransformAxisChange('position', 'y', value)}
              />
              <BoneTransformRow
                label="Position Z"
                value={selectedBoneTransform.position.z}
                step="0.01"
                onPointerDown={(event) => onBoneTransformDragStart('position', 'z', event)}
                onChange={(value) => onBoneTransformAxisChange('position', 'z', value)}
              />
              <BoneTransformRow
                label="Rotation X"
                value={selectedBoneTransform.rotation.x}
                step="1"
                onPointerDown={(event) => onBoneTransformDragStart('rotation', 'x', event)}
                onChange={(value) => onBoneTransformAxisChange('rotation', 'x', value)}
              />
              <BoneTransformRow
                label="Rotation Y"
                value={selectedBoneTransform.rotation.y}
                step="1"
                onPointerDown={(event) => onBoneTransformDragStart('rotation', 'y', event)}
                onChange={(value) => onBoneTransformAxisChange('rotation', 'y', value)}
              />
              <BoneTransformRow
                label="Rotation Z"
                value={selectedBoneTransform.rotation.z}
                step="1"
                onPointerDown={(event) => onBoneTransformDragStart('rotation', 'z', event)}
                onChange={(value) => onBoneTransformAxisChange('rotation', 'z', value)}
              />
            </div>
          ) : (
            <p className="bone-transform-empty">Select a bone to edit its transform.</p>
          )}
        </div>
      </div>
      <div className="bone-global-actions">
        <span>All Bones</span>
        <button
          type="button"
          className="bone-reset-button"
          onClick={onAllBoneTransformsReset}
          disabled={!bones.length}
        >
          Reset All
        </button>
      </div>
      <div className="bone-tree-scroller">
        <BoneTree
          bones={bones}
          selectedBoneKey={selectedBoneKey}
          onSelectBone={onSelectBone}
        />
      </div>
    </>
  )
}

function BoneTransformRow({
  label,
  value,
  step,
  onPointerDown,
  onChange,
}: {
  label: string
  value: number
  step: string
  onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void
  onChange: (value: string) => void
}) {
  return (
    <div className="bone-transform-row">
      <span className="bone-transform-label" onPointerDown={onPointerDown}>
        {label}
      </span>
      <input
        className="bone-transform-input"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function BoneTree({
  bones,
  selectedBoneKey,
  onSelectBone,
}: {
  bones: InspectorData['bones']
  selectedBoneKey: string | null
  onSelectBone: (boneKey: string) => void
}) {
  return (
    <ul className="bone-tree">
      {bones.map((bone) => (
        <BoneTreeNode
          key={bone.key}
          bone={bone}
          selectedBoneKey={selectedBoneKey}
          onSelectBone={onSelectBone}
        />
      ))}
    </ul>
  )
}

function BoneTreeNode({
  bone,
  selectedBoneKey,
  onSelectBone,
}: {
  bone: InspectorData['bones'][number]
  selectedBoneKey: string | null
  onSelectBone: (boneKey: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true)
  const hasChildren = bone.children.length > 0
  const isSelected = selectedBoneKey === bone.key

  return (
    <li className="bone-tree-item">
      <div
        className={`bone-row bone-row-tree${isSelected ? ' is-selected' : ''}`}
        onClick={() => onSelectBone(bone.key)}
      >
        <button
          type="button"
          className={`bone-toggle${hasChildren ? '' : ' is-leaf'}`}
          onClick={(event) => {
            event.stopPropagation()
            if (hasChildren) {
              setIsOpen((current) => !current)
            }
          }}
          aria-label={hasChildren ? `Toggle ${bone.nodeName}` : undefined}
        >
          {hasChildren ? (
            <span
              className={`bone-toggle-icon${isOpen ? ' is-open' : ''}`}
              aria-hidden="true"
            />
          ) : (
            <span className="bone-toggle-spacer" aria-hidden="true" />
          )}
        </button>
        <strong>{bone.nodeName}</strong>
        {bone.humanoidName ? (
          <span className="bone-humanoid">{bone.humanoidName}</span>
        ) : null}
      </div>
      {hasChildren && isOpen ? (
        <ul className="bone-tree-children">
          {bone.children.map((child) => (
            <BoneTreeNode
              key={child.key}
              bone={child}
              selectedBoneKey={selectedBoneKey}
              onSelectBone={onSelectBone}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
