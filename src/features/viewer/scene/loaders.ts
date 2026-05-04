import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import {
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
  createVRMAnimationClip,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation'
import type {
  BoneTransform,
  LoadAnimationOptions,
  LoadedAnimationState,
  LoadedVrmModelSummary,
} from '../types'

export type LoadedSceneModel = LoadedVrmModelSummary & {
  vrm: VRM
  animationMixer: THREE.AnimationMixer
  initialBoneTransforms: Map<string, BoneTransform>
  helperRoot: THREE.Group
  width: number
  height: number
}

type LoadVrmIntoSceneOptions = {
  arrayBuffer: ArrayBuffer
  fileName: string
}

type LoadVrmaIntoSceneOptions = {
  arrayBuffer: ArrayBuffer
  fileName: string
  options?: LoadAnimationOptions
  targets: Array<{
    modelId: string
    vrm: VRM
    animationMixer: THREE.AnimationMixer
  }>
  clearCurrentAnimation: (modelId: string) => void
}

type LoadVrmaIntoSceneResult = {
  perModel: Array<{
    modelId: string
    animationClip: THREE.AnimationClip
    animationAction: THREE.AnimationAction
  }>
  animationState: LoadedAnimationState
}

export async function loadVrmIntoScene({
  arrayBuffer,
  fileName,
}: LoadVrmIntoSceneOptions): Promise<LoadedSceneModel> {
  const startedAt = performance.now()
  const loader = new GLTFLoader()
  const helperRoot = new THREE.Group()
  helperRoot.name = `officialHelperRoot:${fileName}`
  loader.register(
    (parser) =>
      new VRMLoaderPlugin(parser, {
        helperRoot,
      }),
  )

  const gltf = await loader.parseAsync(arrayBuffer, '')
  logSceneLoadStage('loader.parseAsync', startedAt)
  const vrm = gltf.userData.vrm as VRM | undefined

  if (!vrm) {
    throw new Error('Failed to read VRM data.')
  }

  VRMUtils.rotateVRM0(vrm)
  logSceneLoadStage('VRMUtils.rotateVRM0', startedAt)
  vrm.scene.traverse((object) => {
    object.frustumCulled = false
  })
  logSceneLoadStage('scene.traverse disable frustum culling', startedAt)
  const modelBounds = normalizeModel(vrm)
  logSceneLoadStage('normalizeModel', startedAt)
  ensureLookAtProxy(vrm)
  logSceneLoadStage('ensureLookAtProxy', startedAt)

  const animationMixer = new THREE.AnimationMixer(vrm.scene)
  logSceneLoadStage('AnimationMixer init', startedAt)
  const initialBoneTransforms = collectInitialBoneTransforms(vrm.scene)
  logSceneLoadStage('collectInitialBoneTransforms', startedAt)

  console.info('[scene load] complete', {
    totalElapsedMs: roundDuration(performance.now() - startedAt),
  })

  return {
    modelId: crypto.randomUUID(),
    fileName,
    vrm,
    animationMixer,
    initialBoneTransforms,
    helperRoot,
    width: modelBounds.width,
    height: modelBounds.height,
  }
}

export async function loadVrmaIntoScene({
  arrayBuffer,
  fileName,
  options,
  targets,
  clearCurrentAnimation,
}: LoadVrmaIntoSceneOptions): Promise<LoadVrmaIntoSceneResult> {
  if (!targets.length) {
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

  const perModel = targets.map(({ modelId, vrm, animationMixer }) => {
    clearCurrentAnimation(modelId)

    const clip = createVRMAnimationClip(
      vrmAnimation,
      vrm as unknown as Parameters<typeof createVRMAnimationClip>[1],
    )
    const action = animationMixer.clipAction(clip)
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.play()
    action.time = options?.time ?? 0
    action.paused = options?.isPlaying === false

    return {
      modelId,
      animationClip: clip,
      animationAction: action,
    }
  })

  const referenceAction = perModel[0].animationAction

  return {
    perModel,
    animationState: {
      fileName,
      currentTime: referenceAction.time,
      duration: perModel[0].animationClip.duration,
      isPlaying: !referenceAction.paused,
      status: 'ready',
    },
  }
}

function normalizeModel(vrm: VRM) {
  const box = new THREE.Box3().setFromObject(vrm.scene)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  vrm.scene.position.x -= center.x
  vrm.scene.position.z -= center.z
  vrm.scene.position.y -= box.min.y

  return {
    width: Math.max(size.x, 1),
    height: Math.max(size.y, 1),
  }
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
