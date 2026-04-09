import * as THREE from 'three'
import { VRM, VRMHumanBoneList, type VRMHumanBoneName } from '@pixiv/three-vrm'

export type MetaField = {
  label: string
  value: string
}

export type TextureInfo = {
  id: string
  label: string
  textureNames: string[]
  downloadFileName: string
  slots: string[]
  image: string
  sourceImage: unknown
  colorSpace: string
  flipY: string
  mapping: string
}

export type MaterialInfo = {
  name: string
  type: string
  transparent: boolean
  opacity: number
  side: string
  color?: string
  roughness?: number
  metalness?: number
  textureSlots: string[]
}

export type ExpressionInfo = {
  name: string
  isBinary: boolean
  binds: number
  currentWeight: number
  trackName: string | null
}

export type BoneInfo = {
  key: string
  label: string
  nodeName: string
  humanoidName: VRMHumanBoneName | null
  children: BoneInfo[]
}

export type InspectorData = {
  fileName: string
  stats: Array<{ label: string; value: string }>
  meta: MetaField[]
  textures: TextureInfo[]
  materials: MaterialInfo[]
  expressions: ExpressionInfo[]
  bones: BoneInfo[]
}

const TEXTURE_SLOTS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'transmissionMap',
  'thicknessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'anisotropyMap',
  'gradientMap',
  'matcap',
  'shadeMultiplyTexture',
  'rimMultiplyTexture',
  'uvAnimationMaskTexture',
  'outlineWidthMultiplyTexture',
] as const

export function inspectVRM(vrm: VRM, fileName: string): InspectorData {
  const startedAt = performance.now()
  const stats = collectStats(vrm)
  logInspectorStage(fileName, 'collectStats', startedAt)
  const meta = collectMeta(vrm)
  logInspectorStage(fileName, 'collectMeta', startedAt)
  const textures = collectTextures(vrm)
  logInspectorStage(fileName, 'collectTextures', startedAt)
  const materials = collectMaterials(vrm)
  logInspectorStage(fileName, 'collectMaterials', startedAt)
  const expressions = collectExpressions(vrm)
  logInspectorStage(fileName, 'collectExpressions', startedAt)
  const bones = collectBones(vrm)
  logInspectorStage(fileName, 'collectBones', startedAt)

  console.info('[inspectVRM] complete', {
    fileName,
    totalElapsedMs: roundDuration(performance.now() - startedAt),
  })

  return { fileName, stats, meta, textures, materials, expressions, bones }
}

function collectStats(vrm: VRM) {
  let nodeCount = 0
  let meshCount = 0
  let skinnedMeshCount = 0
  let triangles = 0
  const materials = new Set<string>()
  const textures = new Set<string>()

  vrm.scene.traverse((object: THREE.Object3D) => {
    nodeCount += 1

    if ((object as THREE.Mesh).isMesh) {
      const mesh = object as THREE.Mesh
      meshCount += 1

      if ((object as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshCount += 1
      }

      const geometry = mesh.geometry
      const position = geometry.getAttribute('position')
      if (geometry.index) {
        triangles += geometry.index.count / 3
      } else if (position) {
        triangles += position.count / 3
      }

      for (const material of toMaterialArray(mesh.material)) {
        materials.add(material.uuid)
        for (const texture of getTexturesFromMaterial(material)) {
          textures.add(texture.uuid)
        }
      }
    }
  })

  if ('texture' in vrm.meta && vrm.meta.texture) {
    textures.add(vrm.meta.texture.uuid)
  }

  return [
    { label: 'Nodes', value: formatNumber(nodeCount) },
    { label: 'Meshes', value: formatNumber(meshCount) },
    { label: 'Skinned Meshes', value: formatNumber(skinnedMeshCount) },
    { label: 'Materials', value: formatNumber(materials.size) },
    { label: 'Textures', value: formatNumber(textures.size) },
    { label: 'Triangles', value: formatNumber(Math.round(triangles)) },
    {
      label: 'Expressions',
      value: formatNumber(Object.keys(vrm.expressionManager?.expressionMap ?? {}).length),
    },
  ]
}

function collectMeta(vrm: VRM): MetaField[] {
  const meta = vrm.meta
  const values: MetaField[] = [{ label: 'Meta Version', value: meta.metaVersion }]

  if (meta.metaVersion === '0') {
    pushIfDefined(values, 'Title', meta.title)
    pushIfDefined(values, 'Version', meta.version)
    pushIfDefined(values, 'Author', meta.author)
    pushIfDefined(values, 'Contact', meta.contactInformation)
    pushIfDefined(values, 'Reference', meta.reference)
    pushIfDefined(values, 'License', meta.licenseName)
    pushIfDefined(values, 'Allowed User', meta.allowedUserName)
    pushIfDefined(values, 'Commercial Usage', meta.commercialUssageName)
    pushIfDefined(values, 'Violent Usage', meta.violentUssageName)
    pushIfDefined(values, 'Sexual Usage', meta.sexualUssageName)
    pushIfDefined(values, 'Other License URL', meta.otherLicenseUrl)
    pushIfDefined(values, 'Other Permission URL', meta.otherPermissionUrl)
  } else {
    pushIfDefined(values, 'Name', meta.name)
    pushIfDefined(values, 'Version', meta.version)
    pushIfDefined(values, 'Authors', meta.authors.join(', '))
    pushIfDefined(values, 'Copyright', meta.copyrightInformation)
    pushIfDefined(values, 'Contact', meta.contactInformation)
    pushIfDefined(values, 'References', meta.references?.join(', '))
    pushIfDefined(values, 'Third Party Licenses', meta.thirdPartyLicenses)
    pushIfDefined(values, 'License URL', meta.licenseUrl)
    pushIfDefined(values, 'Avatar Permission', meta.avatarPermission)
    pushIfDefined(values, 'Commercial Usage', meta.commercialUsage)
    pushIfDefined(values, 'Credit Notation', meta.creditNotation)
    pushIfDefined(values, 'Allow Redistribution', formatBoolean(meta.allowRedistribution))
    pushIfDefined(
      values,
      'Allow Violent Usage',
      formatBoolean(meta.allowExcessivelyViolentUsage),
    )
    pushIfDefined(
      values,
      'Allow Sexual Usage',
      formatBoolean(meta.allowExcessivelySexualUsage),
    )
    pushIfDefined(
      values,
      'Political / Religious Usage',
      formatBoolean(meta.allowPoliticalOrReligiousUsage),
    )
    pushIfDefined(
      values,
      'Antisocial / Hate Usage',
      formatBoolean(meta.allowAntisocialOrHateUsage),
    )
    pushIfDefined(values, 'Modification', meta.modification)
    pushIfDefined(values, 'Other License URL', meta.otherLicenseUrl)
  }

  return values
}

function collectTextures(vrm: VRM): TextureInfo[] {
  const entries = new Map<string, TextureInfo>()
  const imageKeys = new Map<unknown, string>()

  vrm.scene.traverse((object: THREE.Object3D) => {
    if (!(object as THREE.Mesh).isMesh) {
      return
    }

    for (const material of toMaterialArray((object as THREE.Mesh).material)) {
      const materialRecord = material as MaterialWithMaps

      for (const slot of TEXTURE_SLOTS) {
        const value = materialRecord[slot]
        if (!(value instanceof THREE.Texture)) {
          continue
        }

        const imageDescription = describeImage(value.image)
        const textureName = value.name || material.name || 'Unnamed Texture'
        const imageKey = getImageKey(imageKeys, value.image, textureName)
        const slotName = `${material.name || 'Unnamed Material'}:${slot}`
        upsertTextureEntry(entries, imageKey, {
          imageDescription,
          textureName,
          slotName,
          sourceImage: value.image,
          colorSpace: value.colorSpace,
          flipY: String(value.flipY),
          mapping: String(value.mapping),
        })
      }
    }
  })

  if ('texture' in vrm.meta && vrm.meta.texture) {
    const thumbnail = vrm.meta.texture
    const imageDescription = describeImage(thumbnail.image)
    const textureName = thumbnail.name || 'VRM Thumbnail'
    const imageKey = getImageKey(imageKeys, thumbnail.image, textureName)
    upsertTextureEntry(entries, imageKey, {
      imageDescription,
      textureName,
      slotName: 'Meta:thumbnail',
      sourceImage: thumbnail.image,
      colorSpace: thumbnail.colorSpace,
      flipY: String(thumbnail.flipY),
      mapping: String(thumbnail.mapping),
    })
  }

  return [...entries.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function collectMaterials(vrm: VRM): MaterialInfo[] {
  const entries = new Map<string, MaterialInfo>()

  vrm.scene.traverse((object: THREE.Object3D) => {
    if (!(object as THREE.Mesh).isMesh) {
      return
    }

    for (const material of toMaterialArray((object as THREE.Mesh).material)) {
      if (entries.has(material.uuid)) {
        continue
      }

      const textureSlots = getTextureSlots(material)
      const color =
        'color' in material && material.color instanceof THREE.Color
          ? `#${material.color.getHexString()}`
          : undefined
      const roughness =
        typeof (material as MaterialWithMaps).roughness === 'number'
          ? (material as MaterialWithMaps).roughness
          : undefined
      const metalness =
        typeof (material as MaterialWithMaps).metalness === 'number'
          ? (material as MaterialWithMaps).metalness
          : undefined

      entries.set(material.uuid, {
        name: material.name || 'Unnamed Material',
        type: material.type,
        transparent: material.transparent,
        opacity: material.opacity,
        side: describeSide(material.side),
        color,
        roughness,
        metalness,
        textureSlots,
      })
    }
  })

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function collectExpressions(vrm: VRM): ExpressionInfo[] {
  const map = vrm.expressionManager?.expressionMap ?? {}

  return Object.values(map)
    .map((expression) => ({
      name: expression.expressionName,
      isBinary: expression.isBinary,
      binds: expression.binds.length,
      currentWeight: expression.weight,
      trackName:
        vrm.expressionManager?.getExpressionTrackName(expression.expressionName) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function collectBones(vrm: VRM): BoneInfo[] {
  const humanoidByUuid = new Map<string, VRMHumanBoneName>()
  VRMHumanBoneList.forEach((boneName) => {
    const node = vrm.humanoid.getRawBoneNode(boneName)
    if (node) {
      humanoidByUuid.set(node.uuid, boneName)
    }
  })

  const allBones: Array<{ node: THREE.Bone; order: number }> = []
  let order = 0
  vrm.scene.traverse((object) => {
    if ((object as THREE.Bone).isBone) {
      allBones.push({ node: object as THREE.Bone, order })
      order += 1
    }
  })

  const childUuidMap = new Map<string | null, string[]>()
  const byUuid = new Map(
    allBones.map((entry) => [
      entry.node.uuid,
      {
        node: entry.node,
        order: entry.order,
      },
    ]),
  )

  for (const { node } of allBones) {
    const parentUuid = node.parent && (node.parent as THREE.Bone).isBone ? node.parent.uuid : null
    const siblings = childUuidMap.get(parentUuid) ?? []
    siblings.push(node.uuid)
    childUuidMap.set(parentUuid, siblings)
  }

  const buildNode = (uuid: string): BoneInfo | null => {
    const entry = byUuid.get(uuid)
    if (!entry) {
      return null
    }

    const humanoidName = humanoidByUuid.get(uuid) ?? null
    const children = (childUuidMap.get(uuid) ?? [])
      .sort((a, b) => (byUuid.get(a)?.order ?? 0) - (byUuid.get(b)?.order ?? 0))
      .map((childUuid) => buildNode(childUuid))
      .filter((child): child is BoneInfo => child !== null)

    return {
      key: uuid,
      label: humanoidName ?? (entry.node.name || '(unnamed bone)'),
      nodeName: entry.node.name || '(unnamed bone)',
      humanoidName,
      children,
    }
  }

  return (childUuidMap.get(null) ?? [])
    .sort((a, b) => (byUuid.get(a)?.order ?? 0) - (byUuid.get(b)?.order ?? 0))
    .map((uuid) => buildNode(uuid))
    .filter((node): node is BoneInfo => node !== null)
}

function toMaterialArray(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material]
}

function getTextureSlots(material: THREE.Material) {
  const materialRecord = material as MaterialWithMaps
  return TEXTURE_SLOTS.filter((slot) => materialRecord[slot] instanceof THREE.Texture)
}

function getTexturesFromMaterial(material: THREE.Material) {
  const materialRecord = material as MaterialWithMaps
  return TEXTURE_SLOTS.map((slot) => materialRecord[slot]).filter(
    (value): value is THREE.Texture => value instanceof THREE.Texture,
  )
}

type MaterialWithMaps = THREE.Material &
  Partial<Record<(typeof TEXTURE_SLOTS)[number], THREE.Texture | null>> & {
    roughness?: number
    metalness?: number
  }

function describeImage(image: unknown) {
  if (typeof image === 'object' && image !== null) {
    const width =
      'width' in image && typeof image.width === 'number' ? image.width : undefined
    const height =
      'height' in image && typeof image.height === 'number' ? image.height : undefined

    if (width && height) {
      return `${width} x ${height}`
    }
  }

  return 'Unknown'
}

function describeSide(side: THREE.Side) {
  if (side === THREE.FrontSide) {
    return 'Front'
  }

  if (side === THREE.BackSide) {
    return 'Back'
  }

  return 'Double'
}

function pushIfDefined(values: MetaField[], label: string, value?: string) {
  if (value) {
    values.push({ label, value })
  }
}

function formatBoolean(value?: boolean) {
  if (value == null) {
    return undefined
  }

  return value ? 'Yes' : 'No'
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function createTextureDownloadFileName(name?: string) {
  const baseName = (name?.trim() || 'texture')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')

  return `${baseName || 'texture'}.png`
}

function mergeStringValue(current: string, next: string) {
  if (current === next) {
    return current
  }

  const parts = new Set([...current.split(' / '), next])
  return [...parts].join(' / ')
}

function getImageKey(
  imageKeys: Map<unknown, string>,
  image: unknown,
  fallbackLabel: string,
) {
  if (typeof image === 'object' && image !== null) {
    const existingKey = imageKeys.get(image)
    if (existingKey) {
      return existingKey
    }

    const nextKey = `${describeImage(image)}:${fallbackLabel}:${imageKeys.size}`
    imageKeys.set(image, nextKey)
    return nextKey
  }

  return `${describeImage(image)}:${fallbackLabel}`
}

function upsertTextureEntry(
  entries: Map<string, TextureInfo>,
  imageKey: string,
  next: {
    imageDescription: string
    textureName: string
    slotName: string
    sourceImage: unknown
    colorSpace: string
    flipY: string
    mapping: string
  },
) {
  const existing = entries.get(imageKey)
  if (existing) {
    if (!existing.slots.includes(next.slotName)) {
      existing.slots.push(next.slotName)
    }
    if (!existing.textureNames.includes(next.textureName)) {
      existing.textureNames.push(next.textureName)
    }
    existing.colorSpace = mergeStringValue(existing.colorSpace, next.colorSpace)
    existing.flipY = mergeStringValue(existing.flipY, next.flipY)
    existing.mapping = mergeStringValue(existing.mapping, next.mapping)
    return
  }

  entries.set(imageKey, {
    id: imageKey,
    label: next.textureName,
    textureNames: [next.textureName],
    downloadFileName: createTextureDownloadFileName(next.textureName),
    slots: [next.slotName],
    image: next.imageDescription,
    sourceImage: next.sourceImage,
    colorSpace: next.colorSpace,
    flipY: next.flipY,
    mapping: next.mapping,
  })
}

function logInspectorStage(fileName: string, stage: string, startedAt: number) {
  console.info(`[inspectVRM] ${stage}`, {
    fileName,
    elapsedMs: roundDuration(performance.now() - startedAt),
  })
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100
}
