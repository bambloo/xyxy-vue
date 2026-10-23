import * as THREE from 'three'
import { createGalaxyStarLabelCanvas } from './starTexture'
import type {
  GalaxyStarConnection,
  GalaxyStarView,
  SentGalaxyStar,
} from '../../../../../common/entity/galaxy-star'
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
const SENT_STAR_LABEL_MAX_DISTANCE = 160
const GALAXY_CAMERA_BOUNDARY = 900
const IDLE_WANDER_BOUNDARY = GALAXY_CAMERA_BOUNDARY * 0.6
const GALAXY_CAMERA_CENTER_LIMIT = 40
const CAMERA_PITCH_LIMIT = Math.PI / 2 - 0.04
const CAMERA_LOOK_SENSITIVITY = 0.0035
const IDLE_WANDER_DELAY = 8000
const IDLE_WANDER_SPEED = 1
const IDLE_WANDER_RETURN_SPEED = 3
const IDLE_WANDER_ACCELERATION = 0.8
const IDLE_WANDER_TURN_SPEED = 0.02
const IDLE_WANDER_ROLL_SPEED = 0.06
const CAMERA_ROLL_ACCELERATION = 0.8
const CAMERA_ROLL_MAX_SPEED = 1.2
const WANDER_TARGET_REACHED_DISTANCE = 70
const WANDER_TARGET_BOUNDARY_MARGIN = 80

type SentStarVisual = {
  data: SentGalaxyStar
  star: GalaxyStar
  label: THREE.Sprite
  labelTexture: THREE.CanvasTexture
  labelMaterial: THREE.SpriteMaterial
}

type HiddenStarAssignment = {
  field: THREE.Points
  index: number
  color: THREE.Color
}

export class GalaxyManager {
  private readonly options: GalaxyManagerOptions
  private readonly stars = new Map<string, GalaxyStar>()
  private readonly links: GalaxyLink[] = []
  private readonly socialLinks = new Map<string, GalaxyLink>()
  private readonly sentStars = new Map<string, SentStarVisual>()
  private readonly hiddenStarAssignments = new Map<string, HiddenStarAssignment>()
  private downvotedStarIds = new Set<string>()
  private currentConnections: GalaxyStarConnection[] = []
  private blackHoleView = false
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
  private pinchAngle?: number
  private pinchAngleTime = 0
  private touchGesture = false
  private lastInteractionTime = performance.now()
  private lastUpdateTime = this.lastInteractionTime
  private wanderTarget?: THREE.Vector3
  private readonly wanderVelocity = new THREE.Vector3()
  private rollVelocity = 0
  private targetRollVelocity = 0

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
        this.pinchAngle = this.currentPinchAngle()
        this.pinchAngleTime = performance.now()
        this.targetRollVelocity = 0
        this.recordInteraction()
        this.capturePointer(event)
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
    this.capturePointer(event)
  }

  pointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' && this.touchPointers.has(event.pointerId)) {
      this.touchPointers.get(event.pointerId)!.set(event.clientX, event.clientY)
      if (this.touchPointers.size > 1) {
        const distance = this.currentPinchDistance()
        const angle = this.currentPinchAngle()
        const now = performance.now()
        let angleDelta = 0
        if (distance !== undefined && this.pinchDistance !== undefined) {
          this.moveForward((distance - this.pinchDistance) * 0.4)
        }
        if (angle !== undefined && this.pinchAngle !== undefined) {
          angleDelta =
            THREE.MathUtils.euclideanModulo(angle - this.pinchAngle + Math.PI, Math.PI * 2) -
            Math.PI
        }
        const angleElapsed = Math.max(1 / 120, (now - this.pinchAngleTime) / 1000)
        this.pinchDistance = distance
        this.pinchAngle = angle
        this.pinchAngleTime = now
        this.pointerMoved = true
        this.recordInteraction()
        this.targetRollVelocity =
          Math.abs(angleDelta) > 0.0001
            ? THREE.MathUtils.clamp(
                angleDelta / angleElapsed,
                -CAMERA_ROLL_MAX_SPEED,
                CAMERA_ROLL_MAX_SPEED,
              )
            : 0
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
      if (this.touchPointers.size < 2) {
        this.pinchDistance = undefined
        this.pinchAngle = undefined
        this.targetRollVelocity = 0
      }
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
    if (this.touchPointers.size < 2) {
      this.targetRollVelocity = isIdleWandering ? IDLE_WANDER_ROLL_SPEED : 0
    }
    this.updateCameraLook(deltaSeconds, isIdleWandering)
    if (isIdleWandering) {
      this.updateIdleWander(deltaSeconds)
    }
    this.updateSentStarLabels()
    this.stars.forEach((star) => star.update(time))
    this.links.forEach((link) => link.update(time))
    this.socialLinks.forEach((link) => link.update(time))
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
    this.socialLinks.forEach((link) => link.destroy(this.options.galaxy))
    this.socialLinks.clear()
    this.selectedStar = undefined
    this.stars.clear()
    this.sentStars.forEach((star) => {
      this.options.galaxy.remove(star.label)
      star.labelTexture.dispose()
      star.labelMaterial.dispose()
    })
    this.sentStars.clear()
    this.hiddenStarAssignments.clear()
  }

  private recordInteraction() {
    this.lastInteractionTime = performance.now()
    this.wanderTarget = undefined
    this.wanderVelocity.set(0, 0, 0)
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
    const maxRollVelocityChange = CAMERA_ROLL_ACCELERATION * deltaSeconds
    this.rollVelocity += THREE.MathUtils.clamp(
      this.targetRollVelocity - this.rollVelocity,
      -maxRollVelocityChange,
      maxRollVelocityChange,
    )
    camera.rotation.z += this.rollVelocity * deltaSeconds
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

  private currentPinchAngle() {
    if (this.touchPointers.size < 2) return undefined
    const [first, second] = [...this.touchPointers.values()]
    return first && second ? Math.atan2(second.y - first.y, second.x - first.x) : undefined
  }

  private updateIdleWander(deltaSeconds: number) {
    const camera = this.options.camera
    const distanceFromCenter = camera.position.length()
    const desiredVelocity = new THREE.Vector3()
    const movementBoundary =
      distanceFromCenter > IDLE_WANDER_BOUNDARY ? GALAXY_CAMERA_BOUNDARY : IDLE_WANDER_BOUNDARY

    if (distanceFromCenter > IDLE_WANDER_BOUNDARY) {
      this.wanderTarget = undefined
      desiredVelocity
        .copy(camera.position)
        .normalize()
        .negate()
        .multiplyScalar(IDLE_WANDER_RETURN_SPEED)
    } else {
      if (!this.wanderTarget) this.wanderTarget = this.randomWanderTarget()

      const direction = this.wanderTarget.clone().sub(camera.position)
      if (direction.length() <= WANDER_TARGET_REACHED_DISTANCE) {
        this.wanderTarget = this.randomWanderTarget()
        direction.copy(this.wanderTarget).sub(camera.position)
      }
      desiredVelocity.copy(direction).normalize().multiplyScalar(IDLE_WANDER_SPEED)
    }

    const velocityBlend = 1 - Math.exp(-IDLE_WANDER_ACCELERATION * deltaSeconds)
    this.wanderVelocity.lerp(desiredVelocity, velocityBlend)
    camera.position.addScaledVector(this.wanderVelocity, deltaSeconds)
    this.constrainCameraPosition(camera.position, movementBoundary)

    const velocityLength = this.wanderVelocity.length()
    if (velocityLength > 0.001) {
      const direction = this.wanderVelocity.clone().divideScalar(velocityLength)
      this.targetYaw = Math.atan2(-direction.x, -direction.z)
      this.targetPitch = THREE.MathUtils.clamp(
        Math.asin(direction.y),
        -CAMERA_PITCH_LIMIT,
        CAMERA_PITCH_LIMIT,
      )
    }
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
      .clampLength(GALAXY_CAMERA_CENTER_LIMIT, IDLE_WANDER_BOUNDARY - WANDER_TARGET_BOUNDARY_MARGIN)
  }

  private constrainCameraPosition(position: THREE.Vector3, boundary = GALAXY_CAMERA_BOUNDARY) {
    const distance = position.length()
    if (distance > boundary) {
      position.setLength(boundary)
    } else if (distance < GALAXY_CAMERA_CENTER_LIMIT) {
      position.setLength(GALAXY_CAMERA_CENTER_LIMIT)
    }
  }

  setSentStars(stars: GalaxyStarView[]) {
    const incomingIds = new Set(stars.map((star) => star.id))
    const usedStarKeys = new Set(this.stars.keys())
    this.hiddenStarAssignments.forEach(({ field, index }) => {
      usedStarKeys.add(`${field.uuid}:${index}`)
    })
    this.sentStars.forEach((star, id) => {
      if (incomingIds.has(id)) return
      star.star.setVisible(this.isStarVisible(id))
      this.options.galaxy.remove(star.label)
      star.labelTexture.dispose()
      star.labelMaterial.dispose()
      const materialIndex = this.options.materials.indexOf(star.labelMaterial)
      if (materialIndex >= 0) this.options.materials.splice(materialIndex, 1)
      this.sentStars.delete(id)
    })

    stars.forEach((data) => {
      const existing = this.sentStars.get(data.id)
      if (existing) {
        existing.data = data
        existing.star.setConnectionCount(data.connectionCount)
        existing.star.setVisible(this.isStarVisible(data.id))
        existing.label.visible = this.isStarVisible(data.id)
        return
      }
      const hiddenAssignment = this.hiddenStarAssignments.get(data.id)
      if (hiddenAssignment) this.setHiddenStarPointVisible(data.id, hiddenAssignment, true)
      const { field, index } = hiddenAssignment
        ? { field: hiddenAssignment.field, index: hiddenAssignment.index }
        : this.originalStarForId(data.id, usedStarKeys)
      const star = this.getOrCreateStar(field, index, data.color)
      star.setColor(data.color)
      star.setConnectionCount(data.connectionCount)
      star.setVisible(this.isStarVisible(data.id))
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
      label.visible = this.isStarVisible(data.id)
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

  setDownvotedStarIds(ids: string[]) {
    if (this.blackHoleView) return
    this.downvotedStarIds = new Set(ids)
    const usedStarKeys = new Set(this.stars.keys())
    this.hiddenStarAssignments.forEach(({ field, index }) => {
      usedStarKeys.add(`${field.uuid}:${index}`)
    })
    ids.forEach((id) => {
      if (this.hiddenStarAssignments.has(id)) return
      const sentStar = this.sentStars.get(id)?.star
      if (sentStar) {
        sentStar.setVisible(true)
      }
      const { field, index } = sentStar
        ? { field: sentStar.field, index: sentStar.index }
        : this.originalStarForId(id, usedStarKeys)
      const fieldColors = field.geometry.getAttribute('color')
      const color = fieldColors
        ? new THREE.Color().fromBufferAttribute(fieldColors, index)
        : new THREE.Color(1, 1, 1)
      this.hiddenStarAssignments.set(id, { field, index, color })
      usedStarKeys.add(`${field.uuid}:${index}`)
    })
    this.hiddenStarAssignments.forEach((assignment, id) => {
      if (this.downvotedStarIds.has(id)) {
        const sentStar = this.sentStars.get(id)?.star
        if (sentStar) sentStar.setVisible(false)
        else this.setHiddenStarPointVisible(id, assignment, false)
        return
      }
      this.setHiddenStarPointVisible(id, assignment, true)
      this.hiddenStarAssignments.delete(id)
    })
    this.sentStars.forEach((star, id) => {
      const visible = this.isStarVisible(id)
      star.star.setVisible(visible)
      star.label.visible = visible
    })
    this.setConnections(this.currentConnections)
  }

  setBlackHoleView(enabled: boolean) {
    this.blackHoleView = enabled
    this.options.starFields.forEach((field) => {
      field.visible = !enabled
    })
    if (enabled) {
      this.links.forEach((link) => link.destroy(this.options.galaxy))
      this.links.length = 0
      this.clearSelection(this.options.galaxy)
    }
    this.sentStars.forEach((star, id) => {
      const visible = this.isStarVisible(id)
      star.star.setVisible(visible)
      star.label.visible = visible
    })
    this.hiddenStarAssignments.forEach((assignment, id) => {
      const sentStar = this.sentStars.get(id)?.star
      if (sentStar) sentStar.setVisible(this.isStarVisible(id))
      else this.setHiddenStarPointVisible(id, assignment, this.isStarVisible(id))
    })
    this.setConnections(this.currentConnections)
  }

  setConnections(connections: GalaxyStarConnection[]) {
    this.currentConnections = connections
    const visibleConnections = this.blackHoleView
      ? []
      : connections.filter(
          ({ sourceStarId, targetStarId }) =>
            !this.downvotedStarIds.has(sourceStarId) && !this.downvotedStarIds.has(targetStarId),
        )
    const uniqueConnections = new Map<
      string,
      { sourceStarId: string; targetStarId: string; count: number }
    >()
    visibleConnections.forEach(({ sourceStarId, targetStarId, count }) => {
      const [firstStarId, secondStarId] = [sourceStarId, targetStarId].sort()
      const key = `${firstStarId}:${secondStarId}`
      const existing = uniqueConnections.get(key)
      if (existing) {
        existing.count += count
        return
      }
      uniqueConnections.set(key, {
        sourceStarId: firstStarId,
        targetStarId: secondStarId,
        count,
      })
    })
    const incomingKeys = new Set(uniqueConnections.keys())
    this.socialLinks.forEach((link, key) => {
      if (incomingKeys.has(key)) return
      link.destroy(this.options.galaxy)
      this.socialLinks.delete(key)
    })

    uniqueConnections.forEach(({ sourceStarId, targetStarId, count }, key) => {
      const existing = this.socialLinks.get(key)
      if (existing) {
        existing.setConnectionCount(count)
        return
      }
      const source = this.sentStars.get(sourceStarId)?.star
      const target = this.sentStars.get(targetStarId)?.star
      if (!source || !target) return
      const link = new GalaxyLink(
        source,
        target,
        this.options.galaxy,
        this.options.geometries,
        this.options.materials,
        count,
        true,
      )
      this.socialLinks.set(key, link)
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

  private setHiddenStarPointVisible(
    id: string,
    assignment: HiddenStarAssignment,
    visible: boolean,
  ) {
    const sentStar = this.sentStars.get(id)?.star
    if (sentStar) {
      sentStar.setVisible(visible)
      return
    }
    const fieldColors = assignment.field.geometry.getAttribute('color')
    if (!fieldColors) return
    const color = visible ? assignment.color : new THREE.Color(0, 0, 0)
    fieldColors.setXYZ(assignment.index, color.r, color.g, color.b)
    fieldColors.needsUpdate = true
  }

  private isStarVisible(id: string) {
    return !this.blackHoleView && !this.downvotedStarIds.has(id)
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
      const cameraSpacePosition = camera.worldToLocal(worldPosition.clone())
      const inFrontOfCamera = cameraSpacePosition.z < 0
      const withinLabelRange =
        worldPosition.distanceTo(cameraPosition) <= SENT_STAR_LABEL_MAX_DISTANCE
      star.label.visible = this.isStarVisible(star.data.id) && inFrontOfCamera && withinLabelRange
      if (!star.label.visible) return

      const labelWorldPosition = worldPosition
        .clone()
        .addScaledVector(cameraUp, SENT_STAR_LABEL_OFFSET)
      const labelCameraPosition = camera.worldToLocal(labelWorldPosition)
      const minimumLabelDepth = camera.near + 5
      const labelDepth = -labelCameraPosition.z
      if (labelDepth < minimumLabelDepth) {
        const depthScale = minimumLabelDepth / Math.max(labelDepth, camera.near)
        labelCameraPosition.x *= depthScale
        labelCameraPosition.y *= depthScale
        labelCameraPosition.z = -minimumLabelDepth
      }
      camera.localToWorld(labelCameraPosition)
      star.label.position.copy(galaxy.worldToLocal(labelCameraPosition))
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
    if (this.blackHoleView) return
    const star = this.getOrCreateStar(
      nearest.field,
      nearest.index,
      this.getDefaultStarColor(nearest.index),
    )
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

  private getDefaultStarColor(index: number): string {
    return starColors[index % starColors.length] ?? (starColors[0] as string)
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
    const texture = new THREE.CanvasTexture(createGalaxyStarLabelCanvas(title, color))
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
}
