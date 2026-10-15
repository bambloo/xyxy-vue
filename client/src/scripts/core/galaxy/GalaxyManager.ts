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
  private pointerRotationX = 0
  private pointerRotationY = 0
  private targetRotationX = 0
  private targetRotationY = 0
  private isDragging = false
  private pointerMoved = false

  constructor(options: GalaxyManagerOptions) {
    this.options = options
  }

  pointerDown(event: PointerEvent) {
    this.isDragging = true
    this.pointerMoved = false
    this.pointerStartX = event.clientX
    this.pointerStartY = event.clientY
    this.pointerRotationX = this.targetRotationX
    this.pointerRotationY = this.targetRotationY
    this.options.host.setPointerCapture(event.pointerId)
  }

  pointerMove(event: PointerEvent) {
    if (!this.isDragging) return
    if (Math.hypot(event.clientX - this.pointerStartX, event.clientY - this.pointerStartY) > 6)
      this.pointerMoved = true
    this.targetRotationY = this.pointerRotationY + (event.clientX - this.pointerStartX) * 0.006
    this.targetRotationX = Math.max(
      -0.9,
      Math.min(0.9, this.pointerRotationX + (event.clientY - this.pointerStartY) * 0.004),
    )
  }

  pointerUp(event: PointerEvent, suppressSelection = false) {
    if (!this.pointerMoved && !suppressSelection) this.selectStar(event)
    this.isDragging = false
    this.options.host.releasePointerCapture(event.pointerId)
  }

  wheel(event: WheelEvent) {
    this.options.camera.position.z = Math.max(
      430,
      Math.min(1050, this.options.camera.position.z + event.deltaY * 0.35),
    )
  }

  resetView() {
    this.targetRotationX = 0
    this.targetRotationY = 0
    this.options.camera.position.set(0, 260, 720)
    this.options.camera.lookAt(0, 0, 0)
  }

  update(time: number) {
    const { galaxy } = this.options
    galaxy.rotation.y += (this.targetRotationY - galaxy.rotation.y) * 0.08 + 0.0018
    galaxy.rotation.x += (this.targetRotationX - galaxy.rotation.x) * 0.08
    this.updateSentStarLabels()
    this.stars.forEach((star) => star.update(time))
    this.links.forEach((link) => link.update(time))
    this.updateSelectionMarker()
  }

  destroy() {
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
