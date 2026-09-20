import * as THREE from 'three'
import { GalaxyManager } from './GalaxyManager'

export class GalaxyScene {
  private readonly host: HTMLElement
  private animationFrame = 0
  private renderer?: THREE.WebGLRenderer
  private resizeObserver?: ResizeObserver
  private scene?: THREE.Scene
  private camera?: THREE.PerspectiveCamera
  private galaxy?: THREE.Group
  private manager?: GalaxyManager
  private geometries: THREE.BufferGeometry[] = []
  private materials: THREE.Material[] = []
  private starTexture?: THREE.CanvasTexture

  constructor(host: HTMLElement) {
    this.host = host
    this.createGalaxy()
  }

  pointerDown(event: PointerEvent) {
    this.manager?.pointerDown(event)
  }

  pointerMove(event: PointerEvent) {
    this.manager?.pointerMove(event)
  }

  pointerUp(event: PointerEvent) {
    this.manager?.pointerUp(event)
  }

  wheel(event: WheelEvent) {
    this.manager?.wheel(event)
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver?.disconnect()
    this.manager?.destroy()
    this.geometries.forEach((geometry) => geometry.dispose())
    this.materials.forEach((material) => material.dispose())
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
    this.starTexture?.dispose()
    this.geometries = []
    this.materials = []
    this.manager = undefined
    this.renderer = undefined
    this.scene = undefined
    this.camera = undefined
    this.galaxy = undefined
    this.starTexture = undefined
  }

  private makeStarTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) return
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.12, 'rgba(232,247,255,1)')
    gradient.addColorStop(0.36, 'rgba(136,204,255,.65)')
    gradient.addColorStop(1, 'rgba(54,137,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
    this.starTexture = new THREE.CanvasTexture(canvas)
    this.starTexture.colorSpace = THREE.SRGBColorSpace
  }

  private makeStars(count: number, radius: number, spread: number, size: number, opacity: number) {
    const geometry = new THREE.BufferGeometry()
    const positions: number[] = []
    for (let index = 0; index < count; index += 1) {
      const distance = Math.pow(Math.random(), 0.7) * radius
      const armIndex = index % 5
      const angle = armIndex * ((Math.PI * 2) / 5) + distance * 0.014 + (Math.random() - 0.5) * 0.72
      const armWidth = spread * (0.08 + (distance / radius) * 0.18)
      const offset = (Math.random() - 0.5) * armWidth
      positions.push(
        Math.cos(angle) * distance + offset,
        (Math.random() - 0.5) * spread * 0.55,
        Math.sin(angle) * distance + offset,
      )
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const options: THREE.PointsMaterialParameters = {
      color: 0xd8efff,
      size,
      alphaTest: 0.01,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }
    if (this.starTexture) options.map = this.starTexture
    const material = new THREE.PointsMaterial(options)
    this.geometries.push(geometry)
    this.materials.push(material)
    return new THREE.Points(geometry, material)
  }

  private createGalaxy() {
    this.scene = new THREE.Scene()
    this.makeStarTexture()
    this.camera = new THREE.PerspectiveCamera(52, 1, 1, 2400)
    this.camera.position.set(0, 260, 720)
    this.camera.lookAt(0, 0, 0)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.host.appendChild(this.renderer.domElement)

    this.galaxy = new THREE.Group()
    const distantStars = this.makeStars(4800, 980, 520, 2.4, 0.78)
    const spiralStars = this.makeStars(2600, 520, 190, 3.8, 0.92)
    const innerStars = this.makeStars(1000, 250, 90, 5.2, 0.95)
    const starFields = [distantStars, spiralStars, innerStars]
    const connectionGroup = new THREE.Group()
    this.galaxy.add(distantStars, spiralStars, innerStars, connectionGroup)
    this.scene.add(this.galaxy)
    this.manager = new GalaxyManager({
      host: this.host,
      renderer: this.renderer,
      camera: this.camera,
      galaxy: this.galaxy,
      connectionGroup,
      starFields,
      starTexture: this.starTexture!,
      geometries: this.geometries,
      materials: this.materials,
    })

    const resize = () => {
      if (!this.camera || !this.renderer) return
      this.camera.aspect = this.host.clientWidth / this.host.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.host.clientWidth, this.host.clientHeight)
    }
    this.resizeObserver = new ResizeObserver(resize)
    this.resizeObserver.observe(this.host)
    resize()

    const animate = () => {
      if (!this.galaxy || !this.camera || !this.renderer || !this.scene || !this.manager) return
      this.manager.update(performance.now())
      this.renderer.render(this.scene, this.camera)
      this.animationFrame = requestAnimationFrame(animate)
    }
    animate()
  }
}
