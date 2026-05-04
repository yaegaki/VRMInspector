import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRMUtils } from '@pixiv/three-vrm'
import {
  MToonMaterialDebugMode,
  type MToonMaterial,
} from '@pixiv/three-vrm-materials-mtoon'
import type {
  CameraView,
  DebugViewMode,
  SceneController,
} from '../types'
import { createBoneController } from './boneController'
import {
  loadVrmaIntoScene,
  loadVrmIntoScene,
  type LoadedSceneModel,
} from './loaders'

type SceneModelEntry = LoadedSceneModel & {
  container: THREE.Group
  animationClip: THREE.AnimationClip | null
  animationAction: THREE.AnimationAction | null
}

export function createSceneController(container: HTMLDivElement): SceneController {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#101418')
  scene.fog = new THREE.Fog('#101418', 10, 30)

  const camera = new THREE.PerspectiveCamera(
    35,
    container.clientWidth / container.clientHeight,
    0.1,
    200,
  )
  camera.position.set(0, 1.4, 3.8)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.target.set(0, 1.1, 0)
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
  controls.update()

  const initialCameraPosition = new THREE.Vector3().copy(camera.position)
  const initialTarget = new THREE.Vector3().copy(controls.target)

  scene.add(new THREE.HemisphereLight('#fff6d6', '#1f2937', 1.6))

  const keyLight = new THREE.DirectionalLight('#ffffff', 1.8)
  keyLight.position.set(2.5, 4, 3)
  scene.add(keyLight)

  const rimLight = new THREE.DirectionalLight('#7dd3fc', 0.6)
  rimLight.position.set(-3, 2, -2)
  scene.add(rimLight)

  scene.add(new THREE.GridHelper(12, 24, '#425466', '#1f2937'))

  const boneMarker = new THREE.Group()
  const boneMarkerAxes = new THREE.AxesHelper(0.18)
  const axesMaterials = Array.isArray(boneMarkerAxes.material)
    ? boneMarkerAxes.material
    : [boneMarkerAxes.material]
  axesMaterials.forEach((material) => {
    material.depthTest = false
    material.depthWrite = false
  })
  boneMarker.renderOrder = 999
  boneMarker.add(boneMarkerAxes)
  boneMarker.visible = false
  scene.add(boneMarker)

  const modelRootMarker = new THREE.Group()
  const modelRootAxes = new THREE.AxesHelper(0.28)
  const modelRootMaterials = Array.isArray(modelRootAxes.material)
    ? modelRootAxes.material
    : [modelRootAxes.material]
  modelRootMaterials.forEach((material) => {
    material.depthTest = false
    material.depthWrite = false
  })
  modelRootMarker.renderOrder = 998
  modelRootMarker.add(modelRootAxes)
  modelRootMarker.visible = false
  scene.add(modelRootMarker)

  const viewOffset = new THREE.Vector3()
  const timer = new THREE.Timer()
  let models: SceneModelEntry[] = []
  let selectedModelId: string | null = null
  let currentDebugMode: DebugViewMode = 'standard'
  let springBoneHelpersVisible = false
  let colliderHelpersVisible = false
  let modelGap = 0.2
  let modelRootAxisVisible = false
  let disposed = false

  const boneController = createBoneController({
    boneMarker,
    getCurrentVrm: () => getSelectedModel()?.vrm ?? null,
    getInitialBoneTransforms: () => getSelectedModel()?.initialBoneTransforms ?? new Map(),
  })

  function getSelectedModel() {
    return models.find((model) => model.modelId === selectedModelId) ?? models[0] ?? null
  }

  function clearCurrentAnimation(modelId: string) {
    const model = models.find((entry) => entry.modelId === modelId)
    if (!model) {
      return
    }

    if (model.animationAction) {
      model.animationAction.stop()
      model.animationAction = null
    }

    if (model.animationClip) {
      model.animationMixer.uncacheClip(model.animationClip)
      model.animationClip = null
    }
  }

  function clearAllAnimations() {
    models.forEach((model) => clearCurrentAnimation(model.modelId))
  }

  function applyDebugMode(mode: DebugViewMode) {
    currentDebugMode = mode

    const nextMode =
      mode === 'standard'
        ? MToonMaterialDebugMode.None
        : mode === 'normal'
          ? MToonMaterialDebugMode.Normal
          : mode === 'litShadeRate'
            ? MToonMaterialDebugMode.LitShadeRate
            : MToonMaterialDebugMode.UV

    models.forEach((model) => {
      model.vrm.scene.traverse((object) => {
        if (!(object as THREE.Mesh).isMesh) {
          return
        }

        const mesh = object as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

        for (const material of materials) {
          if (isMToonMaterial(material)) {
            material.debugMode = nextMode
            material.needsUpdate = true
          }
        }
      })
    })
  }

  function applyHelperVisibility() {
    models.forEach((model) => {
      model.helperRoot.visible = springBoneHelpersVisible || colliderHelpersVisible
      model.helperRoot.traverse((object) => {
        if (object === model.helperRoot) {
          return
        }

        object.frustumCulled = false
        const helperVisible = getHelperVisibility(object)
        object.visible = helperVisible

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
    })
  }

  function getHelperVisibility(object: THREE.Object3D) {
    if ('collider' in object) {
      return colliderHelpersVisible
    }

    if ('springBone' in object) {
      return springBoneHelpersVisible
    }

    return springBoneHelpersVisible || colliderHelpersVisible
  }

  function setCameraView(view: CameraView) {
    const distance = camera.position.distanceTo(controls.target)
    viewOffset.set(0, 0, 0)

    if (view === 'front') {
      viewOffset.set(0, 0, distance)
    } else if (view === 'back') {
      viewOffset.set(0, 0, -distance)
    } else if (view === 'left') {
      viewOffset.set(-distance, 0, 0)
    } else if (view === 'right') {
      viewOffset.set(distance, 0, 0)
    } else if (view === 'top') {
      viewOffset.set(0, distance, 0)
    } else if (view === 'bottom') {
      viewOffset.set(0, -distance, 0)
    }

    camera.position.copy(controls.target).add(viewOffset)
    camera.up.set(0, 1, 0)
    if (view === 'top') {
      camera.up.set(0, 0, -1)
    } else if (view === 'bottom') {
      camera.up.set(0, 0, 1)
    }
    camera.lookAt(controls.target)
    controls.update()
  }

  function updateModelRootMarker() {
    const model = getSelectedModel()
    if (!model || !modelRootAxisVisible || models.length <= 1) {
      modelRootMarker.visible = false
      return
    }

    model.container.updateWorldMatrix(true, false)
    modelRootMarker.position.setFromMatrixPosition(model.container.matrixWorld)
    const axisScale = Math.max(0.18, Math.min(0.5, model.height * 0.12))
    modelRootMarker.scale.setScalar(axisScale / 0.28)
    modelRootMarker.visible = true
  }

  function arrangeModels() {
    if (!models.length) {
      controls.target.set(0, 1.1, 0)
      initialTarget.copy(controls.target)
      camera.position.set(0, 1.4, 3.8)
      initialCameraPosition.copy(camera.position)
      camera.lookAt(controls.target)
      controls.update()
      return
    }

    const totalWidth =
      models.reduce((sum, model) => sum + model.width, 0) +
      modelGap * Math.max(models.length - 1, 0)
    let cursor = -totalWidth / 2
    let maxHeight = 1

    models.forEach((model) => {
      cursor += model.width / 2
      model.container.position.set(cursor, 0, 0)
      cursor += model.width / 2 + modelGap
      maxHeight = Math.max(maxHeight, model.height)
    })

    const radius = Math.max(totalWidth, maxHeight, 1)
    controls.target.set(0, maxHeight * 0.55, 0)
    controls.minDistance = radius * 0.4
    controls.maxDistance = radius * 5
    camera.near = 0.1
    camera.far = Math.max(400, radius * 24)
    camera.updateProjectionMatrix()
    camera.position.set(controls.target.x, controls.target.y, controls.target.z + radius * 2.1)
    camera.up.set(0, 1, 0)
    initialCameraPosition.copy(camera.position)
    initialTarget.copy(controls.target)
    camera.lookAt(controls.target)
    controls.update()
  }

  function disposeModel(model: SceneModelEntry) {
    clearCurrentAnimation(model.modelId)
    model.animationMixer.uncacheRoot(model.vrm.scene)
    scene.remove(model.container)
    scene.remove(model.helperRoot)
    disposeHelperRoot(model.helperRoot)
    VRMUtils.deepDispose(model.vrm.scene)
  }

  function replaceModels(nextModels: SceneModelEntry[]) {
    models.forEach(disposeModel)
    models = nextModels
    selectedModelId = models[0]?.modelId ?? null
    boneController.clearSelection()
    arrangeModels()
    applyDebugMode(currentDebugMode)
    applyHelperVisibility()
  }

  async function addModel(arrayBuffer: ArrayBuffer, fileName: string, replace: boolean) {
    const loadedModel = await loadVrmIntoScene({ arrayBuffer, fileName })
    const containerGroup = new THREE.Group()
    containerGroup.name = `vrmModel:${loadedModel.fileName}`
    containerGroup.add(loadedModel.vrm.scene)

    prepareHelperRoot(loadedModel.helperRoot)
    loadedModel.helperRoot.visible = false
    scene.add(containerGroup)
    scene.add(loadedModel.helperRoot)

    const nextModel: SceneModelEntry = {
      ...loadedModel,
      container: containerGroup,
      animationClip: null,
      animationAction: null,
    }

    if (replace) {
      replaceModels([nextModel])
    } else {
      models = [...models, nextModel]
      selectedModelId = nextModel.modelId
      boneController.clearSelection()
      arrangeModels()
      applyDebugMode(currentDebugMode)
      applyHelperVisibility()
    }

    return {
      modelId: nextModel.modelId,
      fileName: nextModel.fileName,
      vrm: nextModel.vrm,
    }
  }

  timer.connect(document)

  const renderLoop = () => {
    if (disposed) {
      return
    }

    timer.update()
    const delta = timer.getDelta()
    models.forEach((model) => {
      model.animationMixer.update(delta)
      model.vrm.update(delta)
    })
    boneController.updateBoneMarker()
    updateModelRootMarker()
    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(renderLoop)
  }

  renderLoop()

  const resizeObserver = new ResizeObserver(() => {
    const { clientWidth, clientHeight } = container
    if (!clientWidth || !clientHeight) {
      return
    }

    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(clientWidth, clientHeight)
  })

  resizeObserver.observe(container)

  return {
    dispose() {
      disposed = true
      resizeObserver.disconnect()
      controls.dispose()
      clearAllAnimations()
      timer.dispose()
      models.forEach(disposeModel)
      models = []
      modelRootMarker.visible = false
      renderer.dispose()
      renderer.domElement.remove()
    },
    load(arrayBuffer, fileName) {
      return addModel(arrayBuffer, fileName, true)
    },
    add(arrayBuffer, fileName) {
      return addModel(arrayBuffer, fileName, false)
    },
    removeModel(modelId) {
      const removingSelected = selectedModelId === modelId
      const model = models.find((entry) => entry.modelId === modelId)
      if (!model) {
        return
      }

      disposeModel(model)
      models = models.filter((entry) => entry.modelId !== modelId)

      if (!models.length) {
        selectedModelId = null
      } else if (removingSelected) {
        selectedModelId = models[0].modelId
      }

      boneController.clearSelection()
      updateModelRootMarker()
      arrangeModels()
      applyHelperVisibility()
    },
    moveModel(modelId, toIndex) {
      const index = models.findIndex((entry) => entry.modelId === modelId)
      const nextIndex = Math.max(0, Math.min(toIndex, models.length - 1))
      if (index < 0 || nextIndex < 0 || nextIndex >= models.length) {
        return
      }
      if (index === nextIndex) {
        return
      }

      const nextModels = [...models]
      const [movingModel] = nextModels.splice(index, 1)
      nextModels.splice(nextIndex, 0, movingModel)
      models = nextModels
      arrangeModels()
      updateModelRootMarker()
      applyHelperVisibility()
    },
    selectModel(modelId) {
      selectedModelId = modelId
      boneController.clearSelection()
      updateModelRootMarker()
      applyHelperVisibility()
    },
    async loadAnimation(arrayBuffer, fileName, options) {
      const result = await loadVrmaIntoScene({
        arrayBuffer,
        fileName,
        options,
        targets: models.map((model) => ({
          modelId: model.modelId,
          vrm: model.vrm,
          animationMixer: model.animationMixer,
        })),
        clearCurrentAnimation,
      })

      result.perModel.forEach((animationResult) => {
        const model = models.find((entry) => entry.modelId === animationResult.modelId)
        if (!model) {
          return
        }

        model.animationClip = animationResult.animationClip
        model.animationAction = animationResult.animationAction
      })

      return result.animationState
    },
    setExpression(name, value) {
      const model = getSelectedModel()
      model?.vrm.expressionManager?.setValue(name, value)
      model?.vrm.expressionManager?.update()
    },
    resetCamera() {
      camera.position.copy(initialCameraPosition)
      controls.target.copy(initialTarget)
      camera.up.set(0, 1, 0)
      controls.update()
    },
    setView(view) {
      setCameraView(view)
    },
    selectBone(boneKey) {
      boneController.selectBone(boneKey)
    },
    getSelectedBoneTransform(space) {
      return boneController.getSelectedBoneTransform(space)
    },
    setSelectedBoneTransform(transform, space) {
      return boneController.setSelectedBoneTransform(transform, space)
    },
    resetSelectedBoneTransform(space) {
      return boneController.resetSelectedBoneTransform(space)
    },
    resetAllBoneTransforms(space) {
      return boneController.resetAllBoneTransforms(space)
    },
    setDebugMode(mode) {
      applyDebugMode(mode)
    },
    setSpringBoneHelpersVisible(visible) {
      springBoneHelpersVisible = visible
      applyHelperVisibility()
    },
    setColliderHelpersVisible(visible) {
      colliderHelpersVisible = visible
      applyHelperVisibility()
    },
    setModelGap(gap) {
      modelGap = Math.max(0, gap)
      arrangeModels()
    },
    setModelRootAxisVisible(visible) {
      modelRootAxisVisible = visible
      updateModelRootMarker()
    },
    setAnimationPlaying(playing) {
      const actions = models
        .map((model) => model.animationAction)
        .filter((action): action is THREE.AnimationAction => action !== null)
      if (!actions.length) {
        return false
      }

      actions.forEach((action) => {
        action.paused = !playing
        if (playing) {
          action.play()
        }
      })

      return playing
    },
    restartAnimation() {
      const actions = models
        .map((model) => model.animationAction)
        .filter((action): action is THREE.AnimationAction => action !== null)
      if (!actions.length) {
        return false
      }

      actions.forEach((action) => {
        action.reset()
        action.paused = false
        action.play()
      })

      return true
    },
    getAnimationPlaybackState() {
      const action = models.find((model) => model.animationAction)?.animationAction
      if (!action) {
        return null
      }

      return {
        isPlaying: !action.paused,
        time: action.time,
      }
    },
    clearAnimation() {
      clearAllAnimations()
    },
  }
}

function isMToonMaterial(material: THREE.Material): material is MToonMaterial {
  return 'isMToonMaterial' in material && material.isMToonMaterial === true
}

function prepareHelperRoot(helperRoot: THREE.Group) {
  helperRoot.renderOrder = 10000
  helperRoot.traverse((object) => {
    object.frustumCulled = false
    object.renderOrder = 10000
  })
}

function disposeHelperRoot(helperRoot: THREE.Group) {
  helperRoot.traverse((object) => {
    const disposable = object as THREE.Object3D & { dispose?: () => void }
    disposable.dispose?.()
  })
}
