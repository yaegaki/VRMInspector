import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import {
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
  createVRMAnimationClip,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation'
import type { BoneTransform, DebugViewMode, LoadAnimationOptions, LoadedAnimationState } from '../types'

type LoadVrmIntoSceneOptions = {
  arrayBuffer: ArrayBuffer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  initialCameraPosition: THREE.Vector3
  initialTarget: THREE.Vector3
  officialHelperRoot: THREE.Group
  boneMarker: THREE.Group
  currentVRM: VRM | null
  animationMixer: THREE.AnimationMixer | null
  currentDebugMode: DebugViewMode
  clearCurrentAnimation: () => void
  clearHelperRoots: () => void
  applyDebugMode: (mode: DebugViewMode) => void
  setupSpringBoneHelpers: () => void
}

type LoadVrmIntoSceneResult = {
  vrm: VRM
  animationMixer: THREE.AnimationMixer
  initialBoneTransforms: Map<string, BoneTransform>
}

type LoadVrmaIntoSceneOptions = {
  arrayBuffer: ArrayBuffer
  fileName: string
  options?: LoadAnimationOptions
  currentVRM: VRM | null
  animationMixer: THREE.AnimationMixer | null
  clearCurrentAnimation: () => void
}

type LoadVrmaIntoSceneResult = {
  animationMixer: THREE.AnimationMixer
  animationClip: THREE.AnimationClip
  animationAction: THREE.AnimationAction
  animationState: LoadedAnimationState
}

export async function loadVrmIntoScene({
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
  clearHelperRoots,
  applyDebugMode,
  setupSpringBoneHelpers,
}: LoadVrmIntoSceneOptions): Promise<LoadVrmIntoSceneResult> {
  const startedAt = performance.now()
  const loader = new GLTFLoader()
  clearHelperRoots()
  officialHelperRoot.clear()
  loader.register(
    (parser) =>
      new VRMLoaderPlugin(parser, {
        helperRoot: officialHelperRoot,
      }),
  )

  const gltf = await loader.parseAsync(arrayBuffer, '')
  logSceneLoadStage('loader.parseAsync', startedAt)
  const vrm = gltf.userData.vrm as VRM | undefined

  if (!vrm) {
    throw new Error('Failed to read VRM data.')
  }

  if (currentVRM) {
    clearCurrentAnimation()
    if (animationMixer) {
      animationMixer.uncacheRoot(currentVRM.scene)
    }
    scene.remove(currentVRM.scene)
    VRMUtils.deepDispose(currentVRM.scene)
  }

  VRMUtils.rotateVRM0(vrm)
  logSceneLoadStage('VRMUtils.rotateVRM0', startedAt)
  vrm.scene.traverse((object) => {
    object.frustumCulled = false
  })
  logSceneLoadStage('scene.traverse disable frustum culling', startedAt)
  placeModel(vrm, camera, controls, initialCameraPosition, initialTarget)
  logSceneLoadStage('placeModel', startedAt)
  ensureLookAtProxy(vrm)
  logSceneLoadStage('ensureLookAtProxy', startedAt)
  scene.add(vrm.scene)
  logSceneLoadStage('scene.add', startedAt)

  const nextAnimationMixer = new THREE.AnimationMixer(vrm.scene)
  logSceneLoadStage('AnimationMixer init', startedAt)
  const initialBoneTransforms = collectInitialBoneTransforms(vrm.scene)
  logSceneLoadStage('collectInitialBoneTransforms', startedAt)

  boneMarker.visible = false
  applyDebugMode(currentDebugMode)
  logSceneLoadStage('applyDebugMode', startedAt)
  setupSpringBoneHelpers()
  logSceneLoadStage('setupSpringBoneHelpers', startedAt)

  console.info('[scene load] complete', {
    totalElapsedMs: roundDuration(performance.now() - startedAt),
  })

  return {
    vrm,
    animationMixer: nextAnimationMixer,
    initialBoneTransforms,
  }
}

export async function loadVrmaIntoScene({
  arrayBuffer,
  fileName,
  options,
  currentVRM,
  animationMixer,
  clearCurrentAnimation,
}: LoadVrmaIntoSceneOptions): Promise<LoadVrmaIntoSceneResult> {
  if (!currentVRM) {
    throw new Error('Load a VRM before loading a VRMA animation.')
  }

  const loader = new GLTFLoader()
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

  const gltf = await loader.parseAsync(arrayBuffer, '')
  const vrmAnimations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined
  const vrmAnimation = vrmAnimations?.[0]

  if (!vrmAnimation) {
    throw new Error('No VRM animation track was found in the selected VRMA file.')
  }

  const clip = createVRMAnimationClip(
    vrmAnimation,
    currentVRM as unknown as Parameters<typeof createVRMAnimationClip>[1],
  )
  const nextAnimationMixer = animationMixer ?? new THREE.AnimationMixer(currentVRM.scene)

  clearCurrentAnimation()

  const action = nextAnimationMixer.clipAction(clip)
  action.reset()
  action.setLoop(THREE.LoopRepeat, Infinity)
  action.clampWhenFinished = false
  action.play()
  action.paused = options?.isPlaying === false

  return {
    animationMixer: nextAnimationMixer,
    animationClip: clip,
    animationAction: action,
    animationState: {
      fileName,
      currentTime: action.time,
      duration: clip.duration,
      isPlaying: !action.paused,
      status: 'ready',
    },
  }
}

function placeModel(
  vrm: VRM,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  initialCameraPosition: THREE.Vector3,
  initialTarget: THREE.Vector3,
) {
  const box = new THREE.Box3().setFromObject(vrm.scene)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  vrm.scene.position.x -= center.x
  vrm.scene.position.z -= center.z
  vrm.scene.position.y -= box.min.y

  const maxDimension = Math.max(size.x, size.y, size.z, 1)
  controls.target.set(0, size.y * 0.55, 0)
  controls.minDistance = maxDimension * 0.4
  controls.maxDistance = maxDimension * 5
  camera.position.set(controls.target.x, controls.target.y, controls.target.z + maxDimension * 2.1)
  camera.up.set(0, 1, 0)
  initialCameraPosition.copy(camera.position)
  initialTarget.copy(controls.target)
  camera.lookAt(controls.target)
  controls.update()
}

function collectInitialBoneTransforms(root: THREE.Object3D) {
  const transforms = new Map<string, BoneTransform>()

  root.traverse((object) => {
    if ((object as THREE.Bone).isBone) {
      transforms.set(object.uuid, {
        position: {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z,
        },
        rotation: {
          x: THREE.MathUtils.radToDeg(object.rotation.x),
          y: THREE.MathUtils.radToDeg(object.rotation.y),
          z: THREE.MathUtils.radToDeg(object.rotation.z),
        },
      })
    }
  })

  return transforms
}

function ensureLookAtProxy(vrm: VRM) {
  if (!vrm.lookAt) {
    return
  }

  const existingProxy = vrm.scene.children.find(
    (object) => object instanceof VRMLookAtQuaternionProxy,
  ) as VRMLookAtQuaternionProxy | undefined

  if (existingProxy) {
    if (!existingProxy.name) {
      existingProxy.name = 'VRMLookAtQuaternionProxy'
    }
    return
  }

  const proxy = new VRMLookAtQuaternionProxy(
    vrm.lookAt as unknown as ConstructorParameters<typeof VRMLookAtQuaternionProxy>[0],
  )
  proxy.name = 'VRMLookAtQuaternionProxy'
  vrm.scene.add(proxy)
}

function logSceneLoadStage(stage: string, startedAt: number) {
  console.info(`[scene load] ${stage}`, {
    elapsedMs: roundDuration(performance.now() - startedAt),
  })
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100
}
