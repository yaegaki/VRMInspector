import { useCallback, useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { SceneController, BoneTransform, BoneTransformSpace } from '../../viewer/types'

export function useBoneEditor(sceneRef: RefObject<SceneController | null>) {
  const selectedBoneTransformRef = useRef<BoneTransform | null>(null)
  const [selectedBoneKey, setSelectedBoneKey] = useState<string | null>(null)
  const [selectedBoneTransform, setSelectedBoneTransform] = useState<BoneTransform | null>(
    null,
  )
  const [boneTransformSpace, setBoneTransformSpace] =
    useState<BoneTransformSpace>('local')

  const syncSelectedBoneTransform = useEffectEvent(() => {
    if (!selectedBoneKey) {
      return
    }

    const nextTransform = sceneRef.current?.getSelectedBoneTransform(boneTransformSpace) ?? null
    if (!nextTransform) {
      return
    }

    if (!areBoneTransformsEqual(selectedBoneTransformRef.current, nextTransform)) {
      selectedBoneTransformRef.current = nextTransform
      setSelectedBoneTransform(nextTransform)
    }
  })

  useEffect(() => {
    selectedBoneTransformRef.current = selectedBoneTransform
  }, [selectedBoneTransform])

  useEffect(() => {
    if (!selectedBoneKey) {
      return
    }

    let frameId = 0

    const tick = () => {
      syncSelectedBoneTransform()
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [boneTransformSpace, selectedBoneKey])

  const resetSelection = useCallback(() => {
    setSelectedBoneKey(null)
    setSelectedBoneTransform(null)
    selectedBoneTransformRef.current = null
  }, [])

  function applyBoneTransform(nextTransform: BoneTransform) {
    const appliedTransform = sceneRef.current?.setSelectedBoneTransform(
      nextTransform,
      boneTransformSpace,
    )
    if (appliedTransform) {
      selectedBoneTransformRef.current = appliedTransform
      setSelectedBoneTransform(appliedTransform)
    }
  }

  function handleSelectBone(boneKey: string) {
    const nextBoneKey = selectedBoneKey === boneKey ? null : boneKey
    setSelectedBoneKey(nextBoneKey)
    sceneRef.current?.selectBone(nextBoneKey)
    setSelectedBoneTransform(
      sceneRef.current?.getSelectedBoneTransform(boneTransformSpace) ?? null,
    )
  }

  function handleBoneTransformAxisChange(
    group: keyof BoneTransform,
    axis: 'x' | 'y' | 'z',
    value: string,
  ) {
    const numericValue = Number(value)
    if (!selectedBoneTransform || Number.isNaN(numericValue)) {
      return
    }

    const nextTransform: BoneTransform = {
      ...selectedBoneTransform,
      [group]: {
        ...selectedBoneTransform[group],
        [axis]: numericValue,
      },
    }

    applyBoneTransform(nextTransform)
  }

  function handleBoneTransformSpaceChange(space: BoneTransformSpace) {
    setBoneTransformSpace(space)
    setSelectedBoneTransform(sceneRef.current?.getSelectedBoneTransform(space) ?? null)
  }

  function handleBoneTransformReset() {
    const resetTransform = sceneRef.current?.resetSelectedBoneTransform(boneTransformSpace)
    if (resetTransform) {
      selectedBoneTransformRef.current = resetTransform
      setSelectedBoneTransform(resetTransform)
    }
  }

  function handleAllBoneTransformsReset() {
    const resetTransform = sceneRef.current?.resetAllBoneTransforms(boneTransformSpace)
    selectedBoneTransformRef.current = resetTransform ?? null
    setSelectedBoneTransform(resetTransform ?? null)
  }

  function handleBoneTransformDragStart(
    group: keyof BoneTransform,
    axis: 'x' | 'y' | 'z',
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    const currentTransform = selectedBoneTransformRef.current
    if (!currentTransform) {
      return
    }

    event.preventDefault()

    const startValue = currentTransform[group][axis]
    const sensitivity = group === 'position' ? 0.01 : 0.25

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const delta = (pointerEvent.clientX - event.clientX) * sensitivity
      const nextTransform: BoneTransform = {
        ...selectedBoneTransformRef.current!,
        [group]: {
          ...selectedBoneTransformRef.current![group],
          [axis]: roundTransformValue(startValue + delta),
        },
      }
      applyBoneTransform(nextTransform)
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return {
    selectedBoneKey,
    selectedBoneTransform,
    boneTransformSpace,
    resetSelection,
    handleSelectBone,
    handleBoneTransformAxisChange,
    handleBoneTransformSpaceChange,
    handleBoneTransformReset,
    handleAllBoneTransformsReset,
    handleBoneTransformDragStart,
  }
}

function roundTransformValue(value: number) {
  return Math.round(value * 100) / 100
}

function areBoneTransformsEqual(
  left: BoneTransform | null,
  right: BoneTransform | null,
) {
  if (!left || !right) {
    return left === right
  }

  return (
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.position.z === right.position.z &&
    left.rotation.x === right.rotation.x &&
    left.rotation.y === right.rotation.y &&
    left.rotation.z === right.rotation.z
  )
}
