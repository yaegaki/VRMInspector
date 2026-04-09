import * as THREE from 'three'

export function createHelperController({
  officialHelperRoot,
  springBoneHelperRoot,
  colliderHelperRoot,
}: {
  officialHelperRoot: THREE.Group
  springBoneHelperRoot: THREE.Group
  colliderHelperRoot: THREE.Group
}) {
  let helperObjects: THREE.Object3D[] = []

  const clearHelperRoots = () => {
    helperObjects.forEach((helper) => {
      const disposable = helper as THREE.Object3D & { dispose?: () => void }
      disposable.dispose?.()
    })
    helperObjects = []
    springBoneHelperRoot.clear()
    colliderHelperRoot.clear()
  }

  const setupSpringBoneHelpers = (
    springBoneHelpersVisible: boolean,
    colliderHelpersVisible: boolean,
  ) => {
    clearHelperRoots()

    const helperChildren: THREE.Object3D[] = []
    officialHelperRoot.traverse((object) => {
      if (object !== officialHelperRoot) {
        helperChildren.push(object)
      }
    })

    helperChildren.forEach((helper) => {
      prepareHelperObject(helper)

      if (isColliderHelper(helper)) {
        colliderHelperRoot.add(helper)
        helperObjects.push(helper)
        return
      }

      if (isSpringBoneHelper(helper)) {
        springBoneHelperRoot.add(helper)
        helperObjects.push(helper)
      }
    })

    applyHelperVisibility(springBoneHelperRoot, colliderHelperRoot, {
      springBoneHelpersVisible,
      colliderHelpersVisible,
    })
  }

  return {
    clearHelperRoots,
    setupSpringBoneHelpers,
    applyHelperVisibility: (options: {
      springBoneHelpersVisible: boolean
      colliderHelpersVisible: boolean
    }) => applyHelperVisibility(springBoneHelperRoot, colliderHelperRoot, options),
  }
}

function applyHelperVisibility(
  springBoneHelperRoot: THREE.Group,
  colliderHelperRoot: THREE.Group,
  options: {
    springBoneHelpersVisible: boolean
    colliderHelpersVisible: boolean
  },
) {
  springBoneHelperRoot.visible = options.springBoneHelpersVisible
  colliderHelperRoot.visible = options.colliderHelpersVisible
}

function isColliderHelper(
  object: THREE.Object3D,
): object is THREE.Object3D & { collider: unknown } {
  return 'collider' in object
}

function isSpringBoneHelper(
  object: THREE.Object3D,
): object is THREE.Object3D & { springBone: unknown } {
  return 'springBone' in object
}

function prepareHelperObject(helper: THREE.Object3D) {
  helper.renderOrder = 10000
  helper.frustumCulled = false
  helper.traverse((object) => {
    object.frustumCulled = false

    const maybeMaterial = object as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[]
    }

    if (!maybeMaterial.material) {
      return
    }

    const materials = Array.isArray(maybeMaterial.material)
      ? maybeMaterial.material
      : [maybeMaterial.material]

    materials.forEach((material) => {
      material.depthTest = false
      material.depthWrite = false
      material.transparent = true
    })
  })
}
