import type { VRM } from '@pixiv/three-vrm'

export type DebugViewMode = 'standard' | 'normal' | 'litShadeRate' | 'uv'
export type CameraView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

export type AnimationPlaybackState = {
  isPlaying: boolean
  time: number
}

export type LoadAnimationOptions = Partial<AnimationPlaybackState>

export type LoadedAnimationState = {
  fileName: string
  currentTime: number
  duration: number | null
  isPlaying: boolean
  status: 'pending' | 'ready'
}

export type LoadedAnimationSource = {
  fileName: string
  arrayBuffer: ArrayBuffer
}

export type LoadErrorState = {
  title: string
  message: string
}

export type LoadedVrmModelSummary = {
  modelId: string
  fileName: string
}

export type BoneTransformSpace = 'local' | 'world'

export type BoneTransform = {
  position: {
    x: number
    y: number
    z: number
  }
  rotation: {
    x: number
    y: number
    z: number
  }
}

export type SceneController = {
  dispose: () => void
  load: (arrayBuffer: ArrayBuffer, fileName: string) => Promise<LoadedVrmModelSummary & { vrm: VRM }>
  add: (arrayBuffer: ArrayBuffer, fileName: string) => Promise<LoadedVrmModelSummary & { vrm: VRM }>
  removeModel: (modelId: string) => void
  moveModel: (modelId: string, toIndex: number) => void
  selectModel: (modelId: string | null) => void
  loadAnimation: (
    arrayBuffer: ArrayBuffer,
    fileName: string,
    options?: LoadAnimationOptions,
  ) => Promise<LoadedAnimationState>
  setExpression: (name: string, value: number) => void
  resetCamera: () => void
  setView: (view: CameraView) => void
  selectBone: (boneKey: string | null) => void
  getSelectedBoneTransform: (space: BoneTransformSpace) => BoneTransform | null
  setSelectedBoneTransform: (
    transform: BoneTransform,
    space: BoneTransformSpace,
  ) => BoneTransform | null
  resetSelectedBoneTransform: (space: BoneTransformSpace) => BoneTransform | null
  resetAllBoneTransforms: (space: BoneTransformSpace) => BoneTransform | null
  setDebugMode: (mode: DebugViewMode) => void
  setSpringBoneHelpersVisible: (visible: boolean) => void
  setColliderHelpersVisible: (visible: boolean) => void
  setModelGap: (gap: number) => void
  setModelRootAxisVisible: (visible: boolean) => void
  setAnimationPlaying: (playing: boolean) => boolean
  restartAnimation: () => boolean
  getAnimationPlaybackState: () => AnimationPlaybackState | null
  clearAnimation: () => void
}
