import * as THREE from 'three'
import type { BoneTransform, BoneTransformSpace } from '../types'

export function createBoneController({
  boneMarker,
  getCurrentVrm,
  getInitialBoneTransforms,
}: {
  boneMarker: THREE.Group
  getCurrentVrm: () => { scene: THREE.Object3D } | null
  getInitialBoneTransforms: () => Map<string, BoneTransform>
}) {
  let selectedBone: THREE.Object3D | null = null

  return {
    clearSelection() {
      selectedBone = null
      boneMarker.visible = false
    },
    selectBone(boneKey: string | null) {
      const currentVRM = getCurrentVrm()
      if (!currentVRM || !boneKey) {
        selectedBone = null
        boneMarker.visible = false
        return
      }

      const bone = currentVRM.scene.getObjectByProperty('uuid', boneKey)
      if (bone) {
        selectedBone = bone
      } else {
        selectedBone = null
        boneMarker.visible = false
      }
    },
    getSelectedBoneTransform(space: BoneTransformSpace) {
      if (!selectedBone) {
        return null
      }

      selectedBone.updateWorldMatrix(true, false)
      return readBoneTransform(selectedBone, space)
    },
    setSelectedBoneTransform(transform: BoneTransform, space: BoneTransformSpace) {
      if (!selectedBone) {
        return null
      }

      writeBoneTransform(selectedBone, transform, space)
      return readBoneTransform(selectedBone, space)
    },
    resetSelectedBoneTransform(space: BoneTransformSpace) {
      if (!selectedBone) {
        return null
      }

      const initialTransform = getInitialBoneTransforms().get(selectedBone.uuid)
      if (!initialTransform) {
        return null
      }

      writeBoneTransform(selectedBone, initialTransform, 'local')
      return readBoneTransform(selectedBone, space)
    },
    resetAllBoneTransforms(space: BoneTransformSpace) {
      const currentVRM = getCurrentVrm()
      if (!currentVRM) {
        return null
      }

      currentVRM.scene.traverse((object) => {
        if (!(object as THREE.Bone).isBone) {
          return
        }

        const initialTransform = getInitialBoneTransforms().get(object.uuid)
        if (!initialTransform) {
          return
        }

        writeBoneTransform(object, initialTransform, 'local')
      })

      if (!selectedBone) {
        return null
      }

      return readBoneTransform(selectedBone, space)
    },
    updateBoneMarker() {
      if (!selectedBone) {
        return
      }

      const markerScale = new THREE.Vector3()
      selectedBone.updateWorldMatrix(true, false)
      selectedBone.matrixWorld.decompose(
        boneMarker.position,
        boneMarker.quaternion,
        markerScale,
      )
      boneMarker.visible = true
    },
  }
}

function readBoneTransform(
  bone: THREE.Object3D,
  space: BoneTransformSpace,
): BoneTransform {
  if (space === 'local') {
    return {
      position: {
        x: roundTransformValue(bone.position.x),
        y: roundTransformValue(bone.position.y),
        z: roundTransformValue(bone.position.z),
      },
      rotation: {
        x: roundTransformValue(THREE.MathUtils.radToDeg(bone.rotation.x)),
        y: roundTransformValue(THREE.MathUtils.radToDeg(bone.rotation.y)),
        z: roundTransformValue(THREE.MathUtils.radToDeg(bone.rotation.z)),
      },
    }
  }

  const worldPosition = new THREE.Vector3()
  const worldQuaternion = new THREE.Quaternion()
  const worldScale = new THREE.Vector3()
  bone.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale)
  const worldEuler = new THREE.Euler().setFromQuaternion(worldQuaternion, bone.rotation.order)

  return {
    position: {
      x: roundTransformValue(worldPosition.x),
      y: roundTransformValue(worldPosition.y),
      z: roundTransformValue(worldPosition.z),
    },
    rotation: {
      x: roundTransformValue(THREE.MathUtils.radToDeg(worldEuler.x)),
      y: roundTransformValue(THREE.MathUtils.radToDeg(worldEuler.y)),
      z: roundTransformValue(THREE.MathUtils.radToDeg(worldEuler.z)),
    },
  }
}

function writeBoneTransform(
  bone: THREE.Object3D,
  transform: BoneTransform,
  space: BoneTransformSpace,
) {
  if (space === 'local') {
    bone.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    )
    bone.rotation.set(
      THREE.MathUtils.degToRad(transform.rotation.x),
      THREE.MathUtils.degToRad(transform.rotation.y),
      THREE.MathUtils.degToRad(transform.rotation.z),
    )
    bone.updateMatrix()
    bone.updateWorldMatrix(true, false)
    return
  }

  const targetWorldPosition = new THREE.Vector3(
    transform.position.x,
    transform.position.y,
    transform.position.z,
  )
  const targetWorldQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(transform.rotation.x),
      THREE.MathUtils.degToRad(transform.rotation.y),
      THREE.MathUtils.degToRad(transform.rotation.z),
      bone.rotation.order,
    ),
  )

  const parent = bone.parent
  if (parent) {
    parent.updateWorldMatrix(true, false)
    const parentWorldPosition = new THREE.Vector3()
    const parentWorldQuaternion = new THREE.Quaternion()
    const parentWorldScale = new THREE.Vector3()
    parent.matrixWorld.decompose(
      parentWorldPosition,
      parentWorldQuaternion,
      parentWorldScale,
    )
    targetWorldPosition.sub(parentWorldPosition)
    targetWorldPosition.applyQuaternion(parentWorldQuaternion.clone().invert())
    targetWorldPosition.divide(parentWorldScale)
    bone.position.copy(targetWorldPosition)

    const localQuaternion = parentWorldQuaternion.clone().invert().multiply(
      targetWorldQuaternion,
    )
    bone.quaternion.copy(localQuaternion)
  } else {
    bone.position.copy(targetWorldPosition)
    bone.quaternion.copy(targetWorldQuaternion)
  }

  bone.updateMatrix()
  bone.updateWorldMatrix(true, false)
}

function roundTransformValue(value: number) {
  return Math.round(value * 100) / 100
}
