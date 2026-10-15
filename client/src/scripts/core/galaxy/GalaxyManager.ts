import * as THREE from 'three'
import type { SentGalaxyStar } from '../../../../../common/entity/galaxy-star'
import { GalaxyLink } from './GalaxyLink'
import { GalaxyStar } from './GalaxyStar'

type GalaxyManagerOptions = {
  host: HTMLElement
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  galaxy: THREE.Group
  starFields: THREE.Points[]
  starTexture: THREE.CanvasTexture
  geometries: THREE.BufferGeometry[]
  materials: THREE.Material[]
  onSentStarClick: (star: SentGalaxyStar) => void
}

const starColors = ['#7ec8ff', '#a7e8ff', '#ffd27d', '#ff9fba', '#b69cff', '#8ff0da']
const SENT_STAR_LABEL_OFFSET = 7
const SENT_STAR_LABEL_MAX_DISTANCE = 360
const GALAXY_CAMERA_BOUNDARY = 900
const IDLE_WANDER_BOUNDARY = GALAXY_CAMERA_BOUNDARY * 0.4
const GALAXY_CAMERA_CENTER_LIMIT = 40
const CAMERA_PITCH_LIMIT = Math.PI / 2 - 0.04
const CAMERA_LOOK_SENSITIVITY = 0.0035
const IDLE_WANDER_DELAY = 8000
const IDLE_WANDER_SPEED = 24
const IDLE_WANDER_TURN_SPEED = 1.8
const WANDER_TARGET_REACHED_DISTANCE = 70

type SentStarVisual = {
  data: SentGalaxyStar
  star: GalaxyStar
  label: THREE.Sprite
  labelTexture: THREE.CanvasTexture
  labelMaterial: THREE.SpriteMaterial
}

export class GalaxyManager {
  private readonly options: GalaxyManagerOptions
  private readonly stars = new Map<string, GalaxyStar>()
  private readonly links: GalaxyLink[] = []
  private readonly sentStars = new Map<string, SentStarVisual>()
  private selectionMarker?: THREE.Mesh
  private selectedStar?: GalaxyStar
  private pointerStartX = 0
  private pointerStartY = 0
  private pointerYaw = 0
  private pointerPitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private isDragging = false
  private pointerMoved = false
  private readonly touchPointers = new Map<number, THREE.Vector2>()
  private pinchDistance?: number
  private touchGesture = false
  private lastInteractionTime = performance.now()
  private lastUpdateTime = this.lastInteractionTime
  private nextWanderDecisionTime = 0
  private wanderTarget?: THREE.Vector3

  constructor(options: GalaxyManagerOptions) {
    this.options = options
    const initialDirection = options.camera.getWorldDirection(new THREE.Vector3())
    this.targetYaw = Math.atan2(-initialDirection.x, -initialDirection.z)
    this.targetPitch = THREE.MathUtils.clamp(
      Math.asin(initialDirection.y),
      -CAMERA_PITCH_LIMIT,
      CAMERA_PITCH_LIMIT,
    )
    options.camera.rotation.order = 'YXZ'
    options.camera.rotation.set(this.targetPitch, this.targetYaw, 0)
  }

  pointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      this.touchPointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY))
      if (this.touchPointers.size > 1) {
        this.touchGesture = true
        this.isDragging = false
        this.pointerMoved = true
        this.pinchDistance = this.currentPinchDistance()
        this.recordInteraction()
        this.capturePointer(event.pointerId)
        return
      }
    }
    this.isDragging = true
    this.pointerMoved = false
    this.pointerStartX = event.clientX
    this.pointerStartY = event.clientY
    this.pointerYaw = this.targetYaw
    this.pointerPitch = this.targetPitch
    this.recordInteraction()
    this.capturePointer(event.pointerId)
  }

  pointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' && this.touchPointers.has(event.pointerId)) {
      this.touchPointers.get(event.pointerId)!.set(event.clientX, event.clientY)
      if (this.touchPointers.size > 1) {
        const distance = this.currentPinchDistance()
        if (distance !== undefined && this.pinchDistance !== undefined) {
          this.moveForward((distance - this.pinchDistance) * 0.4)
        }
        this.pinchDistance = distance
        this.pointerMoved = true
        this.recordInteraction()
        return
      }
    }
    if (!this.isDragging) return
    if (Math.hypot(event.clientX - this.pointerStartX, event.clientY - this.pointerStartY) > 6)
      this.pointerMoved = true
    this.targetYaw =
      this.pointerYaw - (event.clientX - this.pointerStartX) * CAMERA_LOOK_SENSITIVITY
    this.targetPitch = THREE.MathUtils.clamp(
      this.pointerPitch - (event.clientY - this.pointerStartY) * CAMERA_LOOK_SENSITIVITY,
      -CAMERA_PITCH_LIMIT,
      CAMERA_PITCH_LIMIT,
    )
    this.recordInteraction()
  }

  pointerUp(event: PointerEvent, suppressSelection = false) {
    const suppressTouchTap = this.touchGesture
    if (event.pointerType === 'touch') {
      this.touchPointers.delete(event.pointerId)
      if (this.touchPointers.size < 2) this.pinchDistance = undefined
      if (this.touchPointers.size === 0) this.touchGesture = false
    }
    if (!this.pointerMoved && !suppressSelection && !suppressTouchTap) this.selectStar(event)
    this.isDragging = this.touchPointers.size === 1 && !suppressTouchTap
    if (this.options.host.hasPointerCapture(event.pointerId)) {
      this.options.host.releasePointerCapture(event.pointerId)
    }
  }

  wheel(event: WheelEvent) {
    this.moveForward(-event.deltaY * 0.12)
  }

  resetView() {
    const camera = this.options.camera
    camera.position.set(0, 0, 0)
    this.targetYaw = 0
    this.targetPitch = 0
    camera.rotation.set(0, 0, 0)
    this.recordInteraction()
  }

  update(time: number) {
    const { galaxy } = this.options
    galaxy.rotation.y += 0.00006
    const deltaSeconds = Math.min(0.05, Math.max(0, (time - this.lastUpdateTime) / 1000))
    this.lastUpdateTime = time
    const isIdleWandering = time - this.lastInteractionTime >= IDLE_WANDER_DELAY
    this.updateCameraLook(deltaSeconds, isIdleWandering)
    if (isIdleWandering) {
      this.updateIdleWander(time, deltaSeconds)
    }
    this.updateSentStarLabels()
    this.stars.forEach((star) => star.update(time))
    this.links.forEach((link) => link.update(time))
    this.updateSelectionMarker()
  }

  destroy() {
    this.touchPointers.clear()
    if (this.selectionMarker) {
      this.options.galaxy.remove(this.selectionMarker)
      this.selectionMarker = undefined
    }
    this.links.forEach((link) => link.destroy(this.options.galaxy))
    this.links.length = 0
    this.selectedStar = undefined
    this.stars.clear()
    this.sentStars.forEach((star) => {
      this.options.galaxy.remove(star.label)
      star.labelTexture.dispose()
      star.labelMaterial.dispose()
    })
    this.sentStars.clear()
  }

  private recordInteraction() {
    this.lastInteractionTime = performance.now()
    this.nextWanderDecisionTime = 0
    this.wanderTarget = undefined
  }

  private updateCameraLook(deltaSeconds: number, isIdleWandering: boolean) {
    const camera = this.options.camera
    const turnSpeed = isIdleWandering ? IDLE_WANDER_TURN_SPEED : 10
    const yawDifference =
      THREE.MathUtils.euclideanModulo(this.targetYaw - camera.rotation.y + Math.PI, Math.PI * 2) -
      Math.PI
    camera.rotation.y += yawDifference * Math.min(1, deltaSeconds * turnSpeed)
    camera.rotation.x +=
      (this.targetPitch - camera.rotation.x) * Math.min(1, deltaSeconds * turnSpeed)
  }

  private moveForward(distance: number) {
    const direction = this.options.camera.getWorldDirection(new THREE.Vector3())
    const nextPosition = this.options.camera.position.clone().addScaledVector(direction, distance)
    this.constrainCameraPosition(nextPosition)
    this.options.camera.position.copy(nextPosition)
    this.recordInteraction()
  }

  private capturePointer(event: PointerEvent) {
    this.options.host.setPointerCapture(event.pointerId)
  }

  private currentPinchDistance() {
    if (this.touchPointers.size < 2) return undefined
    const [first, second] = [...this.touchPointers.values()]
    return first && second ? first.distanceTo(second) : undefined
  }

  private updateIdleWander(time: number, deltaSeconds: number) {
    const camera = this.options.camera
    if (!this.wanderTarget || time >= this.nextWanderDecisionTime) {
      this.wanderTarget = this.randomWanderTarget()
      this.nextWanderDecisionTime = time + 5000 + Math.random() * 5000
    }

    const direction = this.wanderTarget.clone().sub(camera.position)
    if (direction.length() <= WANDER_TARGET_REACHED_DISTANCE) {
      this.wanderTarget = this.randomWanderTarget()
      this.nextWanderDecisionTime = time + 5000 + Math.random() * 5000
      return
    }

    const distance = Math.min(IDLE_WANDER_SPEED * deltaSeconds, direction.length())
    direction.normalize()
    camera.position.addScaledVector(direction, distance)
    this.constrainCameraPosition(camera.position, IDLE_WANDER_BOUNDARY)
    this.targetYaw = Math.atan2(-direction.x, -direction.z)
    this.targetPitch = THREE.MathUtils.clamp(
      Math.asin(direction.y),
      -CAMERA_PITCH_LIMIT,
      CAMERA_PITCH_LIMIT,
    )
  }

  private randomWanderTarget() {
    const direction = new THREE.Vector3(
      Math.random() * 2 - 1,
      (Math.random() - 0.5) * 0.8,
      Math.random() * 2 - 1,
    ).normalize()
    const distance = 220 + Math.random() * 560
    return this.options.camera.position
      .clone()
      .addScaledVector(direction, distance)
      .clampLength(GALAXY_CAMERA_CENTER_LIMIT, IDLE_WANDER_BOUNDARY)
  }

  private constrainCameraPosition(position: THREE.Vector3, boundary = GALAXY_CAMERA_BOUNDARY) {
    const distance = position.length()
    if (distance > boundary) {
      position.setLength(boundary)
    } else if (distance < GALAXY_CAMERA_CENTER_LIMIT) {
      position.setLength(GALAXY_CAMERA_CENTER_LIMIT)
    }
  }

  setSentStars(stars: SentGalaxyStar[]) {
    const incomingIds = new Set(stars.map((star) => star.id))
    const usedStarKeys = new Set(
      [...this.sentStars.values()].map(({ star }) => `${star.field.uuid}:${star.index}`),
    )
    this.sentStars.forEach((star, id) => {
      if (incomingIds.has(id)) return
      this.options.galaxy.remove(star.label)
      star.labelTexture.dispose()
      star.labelMaterial.dispose()
      const materialIndex = this.options.materials.indexOf(star.labelMaterial)
      if (materialIndex >= 0) this.options.materials.splice(materialIndex, 1)
      this.sentStars.delete(id)
    })

    stars.forEach((data) => {
      if (this.sentStars.has(data.id)) return
      const { field, index } = this.originalStarForId(data.id, usedStarKeys)
      const star = this.getOrCreateStar(field, index, data.color)
      star.setColor(data.color)
      usedStarKeys.add(`${field.uuid}:${index}`)

      const labelTexture = this.makeLabelTexture(data.title, data.color)
      const labelMaterial = new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
      const label = new THREE.Sprite(labelMaterial)
      label.position.copy(star.position)
      label.scale.set(72, 20, 1)
      this.options.galaxy.add(label)
      this.options.materials.push(labelMaterial)
      this.sentStars.set(data.id, {
        data,
        star,
        label,
        labelTexture,
        labelMaterial,
      })
    })
  }

  private getOrCreateStar(field: THREE.Points, index: number, color: string) {
    const key = `${field.uuid}:${index}`
    const existing = this.stars.get(key)
    if (existing) return existing
    const star = new GalaxyStar(
      field,
      index,
      color,
      this.options.starTexture,
      this.options.galaxy,
      this.options.materials,
    )
    this.stars.set(key, star)
    return star
  }

  private updateSentStarLabels() {
    const { camera, galaxy } = this.options
    if (this.sentStars.size === 0) return
    galaxy.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3())
    const cameraUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()))
      .normalize()
    this.sentStars.forEach((star) => {
      const worldPosition = galaxy.localToWorld(star.star.position.clone())
      star.label.position.copy(worldPosition).addScaledVector(cameraUp, SENT_STAR_LABEL_OFFSET)
      galaxy.worldToLocal(star.label.position)
      const cameraSpacePosition = camera.worldToLocal(worldPosition.clone())
      star.label.visible =
        cameraSpacePosition.z < 0 &&
        worldPosition.distanceTo(cameraPosition) <= SENT_STAR_LABEL_MAX_DISTANCE
    })
  }

  private selectStar(event: PointerEvent) {
    const { renderer, camera, galaxy, starFields } = this.options
    const bounds = renderer.domElement.getBoundingClientRect()
    galaxy.updateMatrixWorld(true)
    const clickX = event.clientX - bounds.left
    const clickY = event.clientY - bounds.top
    let nearestSentStar: SentStarVisual | undefined
    let nearestSentDistance = Number.POSITIVE_INFINITY
    this.sentStars.forEach((star) => {
      const projected = galaxy.localToWorld(star.star.position.clone()).project(camera)
      if (projected.z < -1 || projected.z > 1) return
      const screenX = (projected.x + 1) * 0.5 * bounds.width
      const screenY = (1 - projected.y) * 0.5 * bounds.height
      const distance = Math.hypot(screenX - clickX, screenY - clickY)
      if (distance < nearestSentDistance) {
        nearestSentDistance = distance
        nearestSentStar = star
      }
    })
    if (nearestSentStar && nearestSentDistance <= 32) {
      this.clearSelection(galaxy)
      this.options.onSentStarClick(nearestSentStar.data)
      return
    }

    let nearest: { field: THREE.Points; index: number; distance: number } | undefined
    const projected = new THREE.Vector3()

    starFields
      .filter((field) => field.userData.selectable === true)
      .forEach((field) => {
        const position = field.geometry.attributes.position
        if (!position) return
        for (let index = 0; index < position.count; index += 1) {
          projected.fromBufferAttribute(position as THREE.BufferAttribute, index)
          projected.applyMatrix4(field.matrixWorld).project(camera)
          const screenX = (projected.x + 1) * 0.5 * bounds.width
          const screenY = (1 - projected.y) * 0.5 * bounds.height
          const distance = Math.hypot(screenX - clickX, screenY - clickY)
          if (!nearest || distance < nearest.distance) nearest = { field, index, distance }
        }
      })

    if (!nearest || nearest.distance > 32) return
    const star = this.getOrCreateStar(nearest.field, nearest.index, this.getRandomStarColor())
    if (!this.selectedStar) {
      this.selectedStar = star
      this.showSelectionMarker(galaxy, star)
      return
    }
    if (this.selectedStar === star) {
      this.clearSelection(galaxy)
      return
    }
    this.addLink(this.selectedStar, star, galaxy)
    this.clearSelection(galaxy)
  }

  private showSelectionMarker(galaxy: THREE.Group, star: GalaxyStar) {
    if (this.selectionMarker) galaxy.remove(this.selectionMarker)
    this.selectionMarker = undefined
    const markerGeometry = new THREE.TorusGeometry(13, 1.8, 8, 32)
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
    })
    this.selectionMarker = new THREE.Mesh(markerGeometry, markerMaterial)
    this.selectionMarker.position.copy(star.position)
    galaxy.add(this.selectionMarker)
    this.options.geometries.push(markerGeometry)
    this.options.materials.push(markerMaterial)
  }

  private updateSelectionMarker() {
    const { galaxy, camera, renderer } = this.options
    const marker = this.selectionMarker
    const star = this.selectedStar
    if (!marker || !star) return

    galaxy.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    marker.position.copy(star.position)

    const worldPosition = galaxy.localToWorld(star.position.clone())
    const cameraPosition = camera.worldToLocal(worldPosition.clone())
    const depth = Math.max(camera.near, -cameraPosition.z)
    const viewportHeight = renderer.domElement.clientHeight
    if (viewportHeight <= 0) return

    const viewHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    const ringDiameter = 2 * (13 + 1.8)
    marker.scale.setScalar((viewHeight * 36) / (viewportHeight * ringDiameter))

    const galaxyRotation = galaxy.getWorldQuaternion(new THREE.Quaternion()).invert()
    const cameraRotation = camera.getWorldQuaternion(new THREE.Quaternion())
    marker.quaternion.copy(galaxyRotation.multiply(cameraRotation))
  }

  private clearSelection(galaxy: THREE.Group) {
    if (this.selectionMarker) galaxy.remove(this.selectionMarker)
    this.selectionMarker = undefined
    this.selectedStar = undefined
  }

  private addLink(start: GalaxyStar, end: GalaxyStar, galaxy: THREE.Group) {
    this.links.push(
      new GalaxyLink(start, end, galaxy, this.options.geometries, this.options.materials),
    )
  }

  private getRandomStarColor(): string {
    return starColors[Math.floor(Math.random() * starColors.length)] ?? (starColors[0] as string)
  }

  private originalStarForId(id: string, usedKeys: Set<string>) {
    const fields = this.options.starFields.filter(
      (field) => (field.geometry.getAttribute('position')?.count ?? 0) > 0,
    )
    const total = fields.reduce(
      (count, field) => count + field.geometry.getAttribute('position').count,
      0,
    )
    if (total === 0) throw new Error('银河场景中没有可绑定的星星')

    let hash = 2166136261
    for (let index = 0; index < id.length; index += 1) {
      hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
    }
    const startIndex = (hash >>> 0) % total
    for (let offset = 0; offset < total; offset += 1) {
      let fieldIndex = (startIndex + offset) % total
      for (const field of fields) {
        const count = field.geometry.getAttribute('position').count
        if (fieldIndex < count) {
          const key = `${field.uuid}:${fieldIndex}`
          if (!usedKeys.has(key)) return { field, index: fieldIndex }
          break
        }
        fieldIndex -= count
      }
    }
    throw new Error('没有可绑定的未占用星星')
  }

  private makeLabelTexture(title: string, color: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 384
    canvas.height = 96
    const context = canvas.getContext('2d')
    if (context) {
      context.font = '30px "Microsoft YaHei", sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.shadowColor = color
      context.shadowBlur = 14
      context.fillStyle = '#ffffff'
      context.fillText(title, 192, 48, 360)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
}
