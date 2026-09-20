import * as THREE from 'three'
import { GalaxyStar } from './GalaxyStar'
import { GalaxyWormhole } from './GalaxyWormhole'

type GalaxyManagerOptions = {
  host: HTMLElement
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  galaxy: THREE.Group
  connectionGroup: THREE.Group
  starFields: THREE.Points[]
  starTexture: THREE.CanvasTexture
  geometries: THREE.BufferGeometry[]
  materials: THREE.Material[]
}

const planetColors: [string, string, string] = ['#7ec8ff', '#a7e8ff', '#ffd27d']

export class GalaxyManager {
  private readonly options: GalaxyManagerOptions
  private readonly stars = new Map<string, GalaxyStar>()
  private readonly wormholes: GalaxyWormhole[] = []
  private readonly glowGeometry = new THREE.CylinderGeometry(1, 1, 1, 8)
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
    options.geometries.push(this.glowGeometry)
    const [spiralStars] = options.starFields.slice(1, 2)
    if (spiralStars) {
      const position = spiralStars.geometry.attributes.position
      if (position) {
        for (let index = 0; index < position.count; index += 1) {
          this.getOrCreateStar(spiralStars, index, planetColors[1])
        }
        this.createRandomConnections(spiralStars)
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

  update(time: number) {
    const { galaxy } = this.options
    galaxy.rotation.y += (this.targetRotationY - galaxy.rotation.y) * 0.08 + 0.0018
    galaxy.rotation.x += (this.targetRotationX - galaxy.rotation.x) * 0.08
    this.wormholes.forEach((wormhole) => wormhole.update(time))
    this.stars.forEach((star) => star.update(time))
  }

  destroy() {
    if (this.selectionMarker) {
      this.options.galaxy.remove(this.selectionMarker)
      this.selectionMarker = undefined
    }
    this.wormholes.length = 0
    this.stars.clear()
    this.glowGeometry.dispose()
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
    const { renderer, camera, galaxy, connectionGroup, starFields } = this.options
    const bounds = renderer.domElement.getBoundingClientRect()
    const pointer = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 16
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(starFields, false)[0]
    if (!hit || hit.index === undefined || !(hit.object instanceof THREE.Points)) return
    const fieldIndex = Math.max(0, starFields.indexOf(hit.object))
    const star = this.getOrCreateStar(
      hit.object,
      hit.index,
      planetColors[fieldIndex % planetColors.length] ?? planetColors[0],
    )
    if (!this.selectedStar) {
      this.selectedStar = star
      const markerGeometry = new THREE.SphereGeometry(10, 12, 8)
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xf6cf75,
        transparent: true,
        opacity: 0.9,
      })
      this.selectionMarker = new THREE.Mesh(markerGeometry, markerMaterial)
      this.selectionMarker.position.copy(star.position)
      galaxy.add(this.selectionMarker)
      this.options.geometries.push(markerGeometry)
      this.options.materials.push(markerMaterial)
      return
    }
    if (this.selectedStar !== star) this.addWormhole(this.selectedStar, star, 10)
    if (this.selectionMarker) galaxy.remove(this.selectionMarker)
    this.selectedStar = undefined
    this.selectionMarker = undefined
  }

  private addWormhole(start: GalaxyStar, end: GalaxyStar, rayCount: number) {
    const wormhole = new GalaxyWormhole(
      start.position,
      end.position,
      rayCount,
      this.options.connectionGroup,
      {
        geometry: this.glowGeometry,
        geometries: this.options.geometries,
        materials: this.options.materials,
      },
      start,
      end,
    )
    this.wormholes.push(wormhole)
  }

  private createRandomConnections(field: THREE.Points) {
    const position = field.geometry.attributes.position
    if (!position) return
    const indexes = Array.from({ length: position.count }, (_, index) => index)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.ceil(position.count * 0.5))
    for (let index = 0; index + 1 < indexes.length; index += 2) {
      const startIndex = indexes[index]
      const endIndex = indexes[index + 1]
      if (startIndex === undefined || endIndex === undefined) continue
      const start = this.getOrCreateStar(field, startIndex, planetColors[2])
      const end = this.getOrCreateStar(field, endIndex, planetColors[2])
      this.addWormhole(start, end, 1)
    }
  }
}
