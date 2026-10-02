import * as THREE from 'three'
import { GalaxyManager } from './GalaxyManager'
import type { StarDistribution } from './distribution/StarDistribution'
import { GaussianCloudDistribution } from './distribution/GaussianCloudDistribution'

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
  private readonly starDistribution: StarDistribution = new GaussianCloudDistribution()

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

  resetView() {
    this.manager?.resetView()
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
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) return
    context.globalCompositeOperation = 'lighter'
    const halo = context.createRadialGradient(78, 56, 2, 78, 56, 50)
    halo.addColorStop(0, 'rgba(255,255,255,1)')
    halo.addColorStop(0.12, 'rgba(231,249,255,.98)')
    halo.addColorStop(0.34, 'rgba(111,207,255,.72)')
    halo.addColorStop(0.7, 'rgba(62,157,255,.18)')
    halo.addColorStop(1, 'rgba(30,98,255,0)')
    context.fillStyle = halo
    context.beginPath()
    context.arc(78, 56, 50, 0, Math.PI * 2)
    context.fill()
    const core = context.createRadialGradient(76, 54, 0, 76, 54, 17)
    core.addColorStop(0, '#ffffff')
    core.addColorStop(0.35, 'rgba(255,255,255,.98)')
    core.addColorStop(1, 'rgba(182,235,255,0)')
    context.fillStyle = core
    context.beginPath()
    context.arc(76, 54, 17, 0, Math.PI * 2)
    context.fill()
    this.starTexture = new THREE.CanvasTexture(canvas)
    this.starTexture.colorSpace = THREE.SRGBColorSpace
  }

  private makeStars(count: number, radius: number, size: number, opacity: number) {
    const geometry = new THREE.BufferGeometry()
    const positions: number[] = []
    this.starDistribution.generate({ count, radius }).forEach((position) => {
      positions.push(position.x, position.y, position.z)
    })
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
    const distantStars = this.makeStars(4800, 980, 2.4, 0.78)
    const spiralStars = this.makeStars(2600, 520, 3.8, 0.92)
    const innerStars = this.makeStars(1000, 250, 5.2, 0.95)
    const starFields = [distantStars, spiralStars, innerStars]
    this.galaxy.add(distantStars, spiralStars, innerStars)
    this.scene.add(this.galaxy)
    this.manager = new GalaxyManager({
      host: this.host,
      renderer: this.renderer,
      camera: this.camera,
      galaxy: this.galaxy,
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
