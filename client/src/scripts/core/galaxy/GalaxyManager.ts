import * as THREE from 'three'
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
}

const planetColors: [string, string, string] = ['#7ec8ff', '#a7e8ff', '#ffd27d']

export class GalaxyManager {
  private readonly options: GalaxyManagerOptions
  private readonly stars = new Map<string, GalaxyStar>()
  private selectionMarker?: THREE.Mesh
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
    const [spiralStars] = options.starFields.slice(1, 2)
    if (spiralStars) {
      const position = spiralStars.geometry.attributes.position
      if (position) {
        for (let index = 0; index < position.count; index += 1) {
          this.getOrCreateStar(
            spiralStars,
            index,
            planetColors[(index * 7) % planetColors.length] ?? planetColors[1],
          )
        }
      }
    }
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

  pointerUp(event: PointerEvent) {
    if (!this.pointerMoved) this.selectStar(event)
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
    this.stars.forEach((star) => star.update(time))
    if (this.selectionMarker) {
      const pulse = 1 + Math.sin(time * 0.008) * 0.14
      this.selectionMarker.scale.setScalar(pulse)
    }
  }

  destroy() {
    if (this.selectionMarker) {
      this.options.galaxy.remove(this.selectionMarker)
      this.selectionMarker = undefined
    }
    this.stars.clear()
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

  private selectStar(event: PointerEvent) {
    const { renderer, camera, galaxy, starFields } = this.options
    const bounds = renderer.domElement.getBoundingClientRect()
    galaxy.updateMatrixWorld(true)
    const clickX = event.clientX - bounds.left
    const clickY = event.clientY - bounds.top
    let nearest: { field: THREE.Points; index: number; distance: number } | undefined
    const projected = new THREE.Vector3()

    starFields.forEach((field) => {
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
    const fieldIndex = Math.max(0, starFields.indexOf(nearest.field))
    const star = this.getOrCreateStar(
      nearest.field,
      nearest.index,
      planetColors[fieldIndex % planetColors.length] ?? planetColors[0],
    )
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
}
