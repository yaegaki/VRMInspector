import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRMUtils, type VRM } from '@pixiv/three-vrm'
import {
  MToonMaterialDebugMode,
  type MToonMaterial,
} from '@pixiv/three-vrm-materials-mtoon'
import type {
  BoneTransform,
  CameraView,
  DebugViewMode,
  SceneController,
} from '../types'
import { createBoneController } from './boneController'
import { createHelperController } from './helperController'
import { loadVrmaIntoScene, loadVrmIntoScene } from './loaders'

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

  const springBoneHelperRoot = new THREE.Group()
  springBoneHelperRoot.name = 'springBoneHelperRoot'
  springBoneHelperRoot.renderOrder = 10000
  scene.add(springBoneHelperRoot)

  const colliderHelperRoot = new THREE.Group()
  colliderHelperRoot.name = 'colliderHelperRoot'
  colliderHelperRoot.renderOrder = 10000
  scene.add(colliderHelperRoot)

  const officialHelperRoot = new THREE.Group()
  officialHelperRoot.name = 'officialHelperRoot'
  officialHelperRoot.renderOrder = 10000
  officialHelperRoot.visible = false
  scene.add(officialHelperRoot)

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

  const viewOffset = new THREE.Vector3()
  const timer = new THREE.Timer()
  let currentVRM: VRM | null = null
  let animationMixer: THREE.AnimationMixer | null = null
  let currentAnimationClip: THREE.AnimationClip | null = null
  let currentAnimationAction: THREE.AnimationAction | null = null
  let currentDebugMode: DebugViewMode = 'standard'
  let springBoneHelpersVisible = false
  let colliderHelpersVisible = false
  let initialBoneTransforms = new Map<string, BoneTransform>()
  let disposed = false

  const helperController = createHelperController({
    officialHelperRoot,
    springBoneHelperRoot,
    colliderHelperRoot,
  })
  const boneController = createBoneController({
    boneMarker,
    getCurrentVrm: () => currentVRM,
    getInitialBoneTransforms: () => initialBoneTransforms,
  })

  const clearCurrentAnimation = () => {
    if (currentAnimationAction) {
      currentAnimationAction.stop()
      currentAnimationAction = null
    }

    if (animationMixer && currentAnimationClip) {
      animationMixer.uncacheClip(currentAnimationClip)
    }

    currentAnimationClip = null
  }

  const applyDebugMode = (mode: DebugViewMode) => {
    currentDebugMode = mode

    if (!currentVRM) {
      return
    }

    const nextMode =
      mode === 'standard'
        ? MToonMaterialDebugMode.None
        : mode === 'normal'
          ? MToonMaterialDebugMode.Normal
          : mode === 'litShadeRate'
            ? MToonMaterialDebugMode.LitShadeRate
            : MToonMaterialDebugMode.UV

    currentVRM.scene.traverse((object) => {
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
  }

  const applyHelperVisibility = () => {
    helperController.applyHelperVisibility({
      springBoneHelpersVisible,
      colliderHelpersVisible,
    })
  }

  const setCameraView = (view: CameraView) => {
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

  applyHelperVisibility()
  timer.connect(document)

  const renderLoop = () => {
    if (disposed) {
      return
    }

    timer.update()
    const delta = timer.getDelta()
    animationMixer?.update(delta)
    currentVRM?.update(delta)
    boneController.updateBoneMarker()
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
      helperController.clearHelperRoots()
      clearCurrentAnimation()
      if (animationMixer && currentVRM) {
        animationMixer.uncacheRoot(currentVRM.scene)
      }
      timer.dispose()
      if (currentVRM) {
        scene.remove(currentVRM.scene)
        VRMUtils.deepDispose(currentVRM.scene)
      }
      renderer.dispose()
      renderer.domElement.remove()
    },
    async load(arrayBuffer) {
      const result = await loadVrmIntoScene({
        arrayBuffer,
        scene,
        camera,
        controls,
        initialCameraPosition,
        initialTarget,
        officialHelperRoot,
        boneMarker,
        currentVRM,
        animationMixer,
        currentDebugMode,
        clearCurrentAnimation,
        clearHelperRoots: helperController.clearHelperRoots,
        applyDebugMode,
        setupSpringBoneHelpers: () =>
          helperController.setupSpringBoneHelpers(
            springBoneHelpersVisible,
            colliderHelpersVisible,
          ),
      })

      currentVRM = result.vrm
      animationMixer = result.animationMixer
      initialBoneTransforms = result.initialBoneTransforms
      boneController.clearSelection()

      return result.vrm
    },
    async loadAnimation(arrayBuffer, fileName, options) {
      const result = await loadVrmaIntoScene({
        arrayBuffer,
        fileName,
        options,
        currentVRM,
        animationMixer,
        clearCurrentAnimation,
      })

      animationMixer = result.animationMixer
      currentAnimationClip = result.animationClip
      currentAnimationAction = result.animationAction

      return result.animationState
    },
    setExpression(name, value) {
      currentVRM?.expressionManager?.setValue(name, value)
      currentVRM?.expressionManager?.update()
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
    setAnimationPlaying(playing) {
      if (!currentAnimationAction) {
        return false
      }

      currentAnimationAction.paused = !playing
      if (playing) {
        currentAnimationAction.play()
      }

      return !currentAnimationAction.paused
    },
    restartAnimation() {
      if (!currentAnimationAction) {
        return false
      }

      currentAnimationAction.reset()
      currentAnimationAction.paused = false
      currentAnimationAction.play()
      return true
    },
    getAnimationPlaybackState() {
      if (!currentAnimationAction) {
        return null
      }

      return {
        isPlaying: !currentAnimationAction.paused,
        time: currentAnimationAction.time,
      }
    },
    clearAnimation() {
      clearCurrentAnimation()
    },
  }
}

function isMToonMaterial(material: THREE.Material): material is MToonMaterial {
  return 'isMToonMaterial' in material && material.isMToonMaterial === true
}
