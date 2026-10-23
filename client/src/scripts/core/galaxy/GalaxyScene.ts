import * as THREE from 'three'
import type {
  GalaxyStarConnection,
  GalaxyStarView,
  SentGalaxyStar,
} from '../../../../../common/entity/galaxy-star'
import { GalaxyBlackHole } from './GalaxyBlackHole'
import { GalaxyMeteorEffect } from './GalaxyMeteorEffect'
import { GalaxyManager } from './GalaxyManager'
import type { StarDistribution } from './distribution/StarDistribution'
import { SpiralGalaxyDistribution } from './distribution/SpiralGalaxyDistribution'
import { createGalaxyStarTextureCanvas } from './starTexture'

const galaxyArmColors = ['#72d7ff', '#a78bfa', '#ff83ca', '#7dffe3', '#ffd27d']

export class GalaxyScene {
  private readonly host: HTMLElement
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly onBlackHoleClick: () => void
  private animationFrame = 0
  private renderer?: THREE.WebGLRenderer
  private resizeObserver?: ResizeObserver
  private scene?: THREE.Scene
  private camera?: THREE.PerspectiveCamera
  private galaxy?: THREE.Group
  private nebulaSky?: THREE.Mesh
  private starFields: THREE.Points[] = []
  private blackHoleView = false
  private manager?: GalaxyManager
  private blackHole?: GalaxyBlackHole
  private geometries: THREE.BufferGeometry[] = []
  private materials: THREE.Material[] = []
  private starTexture?: THREE.CanvasTexture
  private meteorEffect?: GalaxyMeteorEffect
  private readonly activeTouchPointers = new Set<number>()
  private readonly pointerStartPositions = new Map<number, THREE.Vector2>()
  private readonly starDistribution: StarDistribution = new SpiralGalaxyDistribution()

  constructor(
    host: HTMLElement,
    onSentStarClick: (star: SentGalaxyStar) => void,
    onBlackHoleClick: () => void,
    blackHoleView = false,
  ) {
    this.host = host
    this.onBlackHoleClick = onBlackHoleClick
    this.createGalaxy(onSentStarClick, blackHoleView)
  }

  setSentStars(stars: GalaxyStarView[]) {
    this.manager?.setSentStars(stars)
  }

  setDownvotedStarIds(ids: string[]) {
    this.manager?.setDownvotedStarIds(ids)
  }

  setBlackHoleView(enabled: boolean) {
    this.blackHoleView = enabled
    this.manager?.setBlackHoleView(enabled)
    this.blackHole?.setBlackHoleView(enabled)
    this.meteorEffect?.setEnabled(!enabled)
    this.starFields.forEach((field) => {
      field.visible = !enabled
    })
  }

  setConnections(connections: GalaxyStarConnection[]) {
    this.manager?.setConnections(connections)
  }

  pointerDown(event: PointerEvent) {
    this.pointerStartPositions.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY))
    if (event.pointerType === 'touch') {
      this.activeTouchPointers.add(event.pointerId)
      if (this.activeTouchPointers.size === 1) {
        this.meteorEffect?.pointerDown(event)
      } else {
        this.meteorEffect?.cancelPointer()
      }
    } else {
      this.meteorEffect?.pointerDown(event)
    }
    this.manager?.pointerDown(event)
  }

  pointerMove(event: PointerEvent) {
    this.manager?.pointerMove(event)
  }

  pointerUp(event: PointerEvent) {
    const isMultiTouch = event.pointerType === 'touch' && this.activeTouchPointers.size > 1
    const pointerStart = this.pointerStartPositions.get(event.pointerId)
    this.pointerStartPositions.delete(event.pointerId)
    const isTap =
      event.type !== 'pointercancel' &&
      !isMultiTouch &&
      pointerStart !== undefined &&
      pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 6
    const hitBlackHole =
      isTap && this.camera
        ? (this.blackHole?.hitTest(event, this.camera, this.host) ?? false)
        : false
    if (event.pointerType === 'touch') this.activeTouchPointers.delete(event.pointerId)
    const hitDestination =
      isMultiTouch || hitBlackHole
        ? (this.meteorEffect?.cancelPointer(), false)
        : (this.meteorEffect?.pointerUp(event) ?? false)
    this.manager?.pointerUp(event, hitDestination || isMultiTouch || hitBlackHole)
    if (hitBlackHole) this.onBlackHoleClick()
  }

  wheel(event: WheelEvent) {
    this.manager?.wheel(event)
  }

  resetView() {
    this.manager?.resetView()
  }

  zoomOut() {
    this.manager?.zoomOut()
  }

  navigateToSentStar(starId: string) {
    return this.manager?.navigateToSentStar(starId) ?? false
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver?.disconnect()
    this.manager?.destroy()
    if (this.blackHole && this.galaxy) this.blackHole.destroy(this.galaxy)
    this.meteorEffect?.destroy()
    this.geometries.forEach((geometry) => geometry.dispose())
    this.materials.forEach((material) => material.dispose())
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
    this.starTexture?.dispose()
    this.geometries = []
    this.materials = []
    this.activeTouchPointers.clear()
    this.pointerStartPositions.clear()
    this.manager = undefined
    this.blackHole = undefined
    this.nebulaSky = undefined
    this.starFields = []
    this.renderer = undefined
    this.scene = undefined
    this.camera = undefined
    this.galaxy = undefined
    this.starTexture = undefined
    this.meteorEffect = undefined
  }

  private makeStarTexture() {
    this.starTexture = new THREE.CanvasTexture(createGalaxyStarTextureCanvas())
    this.starTexture.colorSpace = THREE.SRGBColorSpace
  }

  private makeStars(count: number, radius: number, size: number, opacity: number) {
    const geometry = new THREE.BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []
    this.starDistribution.generate({ count, radius }).forEach((position) => {
      positions.push(position.x, position.y, position.z)
      const distance = Math.hypot(position.x, position.z)
      const armAngle = Math.atan2(position.z, position.x) - distance * 0.014
      const colorPosition =
        THREE.MathUtils.euclideanModulo(armAngle / (Math.PI * 2), 1) * galaxyArmColors.length
      const colorIndex = Math.floor(colorPosition)
      const colorBlend = colorPosition - colorIndex
      const smoothColorBlend = colorBlend * colorBlend * (3 - 2 * colorBlend)
      const color = new THREE.Color(
        galaxyArmColors[colorIndex] ?? galaxyArmColors[0] ?? '#72d7ff',
      ).lerp(
        new THREE.Color(
          galaxyArmColors[(colorIndex + 1) % galaxyArmColors.length] ??
            galaxyArmColors[0] ??
            '#72d7ff',
        ),
        smoothColorBlend,
      )
      color.multiplyScalar(0.38 + Math.random() * 0.18)
      colors.push(color.r, color.g, color.b)
    })
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const options: THREE.PointsMaterialParameters = {
      color: 0xffffff,
      size,
      alphaTest: 0.01,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }
    if (this.starTexture) options.map = this.starTexture
    const material = new THREE.PointsMaterial(options)
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (dot(diffuseColor.rgb, diffuseColor.rgb) < 1e-8) discard;`,
      )
    }
    material.customProgramCacheKey = () => 'hide-black-galaxy-points'
    this.geometries.push(geometry)
    this.materials.push(material)
    return new THREE.Points(geometry, material)
  }

  private makeNebulaSky() {
    const geometry = new THREE.SphereGeometry(1800, 48, 32)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_seed: { value: Math.random() * 1000 },
      },
      vertexShader: `
        varying vec3 v_direction;
        void main() {
          v_direction = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 v_direction;
        uniform float u_time;
        uniform float u_seed;

        float hash31(vec3 point) {
          point = fract(point * 0.3183099 + 0.1);
          point *= 17.0;
          return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
        }

        float noise3D(vec3 point) {
          vec3 cell = floor(point);
          vec3 blend = fract(point);
          blend = blend * blend * (3.0 - 2.0 * blend);
          float a = hash31(cell);
          float b = hash31(cell + vec3(1.0, 0.0, 0.0));
          float c = hash31(cell + vec3(0.0, 1.0, 0.0));
          float d = hash31(cell + vec3(1.0, 1.0, 0.0));
          float e = hash31(cell + vec3(0.0, 0.0, 1.0));
          float f = hash31(cell + vec3(1.0, 0.0, 1.0));
          float g = hash31(cell + vec3(0.0, 1.0, 1.0));
          float h = hash31(cell + vec3(1.0, 1.0, 1.0));
          return mix(
            mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y),
            mix(mix(e, f, blend.x), mix(g, h, blend.x), blend.y),
            blend.z
          );
        }

        float fbm(vec3 point) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int octave = 0; octave < 4; octave++) {
            value += noise3D(point) * amplitude;
            point = point * 2.03 + 13.7;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec3 direction = normalize(v_direction);
          vec3 seedOffset = vec3(u_seed, u_seed * 1.73, u_seed * 2.41);
          vec3 drift = vec3(u_time * 0.003, -u_time * 0.002, u_time * 0.001);
          vec3 warp = vec3(
            noise3D(direction * 5.2 + seedOffset + drift),
            noise3D(direction * 5.2 + seedOffset + vec3(17.2, 4.8, 9.1) - drift * 0.8),
            noise3D(direction * 5.2 + seedOffset + vec3(3.7, 21.4, 11.6) + drift * 0.6)
          ) - 0.5;
          vec3 perturbedDirection = direction + warp * 0.12;
          float broadClouds = fbm(perturbedDirection * 3.1 + drift);
          float fineClouds = fbm(perturbedDirection * 8.0 - drift * 1.7);
          float colorNoise = noise3D(perturbedDirection * 2.3 + seedOffset);
          float cloudField = broadClouds * 0.68 + fineClouds * 0.32;
          float cloudShape = smoothstep(0.3, 0.7, cloudField);
          float wisps = smoothstep(0.4, 0.72, fineClouds) * cloudShape;
          float colorFlow = smoothstep(0.18, 0.88, colorNoise + fineClouds * 0.32);

          vec3 color = vec3(0.014, 0.018, 0.065);
          color += mix(vec3(0.34, 0.035, 0.68), vec3(0.08, 0.34, 0.88), colorFlow)
            * (0.18 + cloudShape * 0.62);
          color += vec3(0.02, 0.58, 0.78) * wisps * (0.38 + colorNoise * 0.62);
          color += vec3(0.95, 0.08, 0.42) * cloudShape
            * smoothstep(0.34, 0.8, colorNoise) * 0.72;
          color += vec3(1.0, 0.38, 0.09) * wisps
            * smoothstep(0.62, 0.9, fineClouds) * 0.5;
          color += vec3(0.32, 0.76, 1.0) * pow(wisps, 2.0) * 0.42;
          gl_FragColor = vec4(color * 0.32, 0.16);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    this.geometries.push(geometry)
    this.materials.push(material)
    return new THREE.Mesh(geometry, material)
  }

  private createGalaxy(
    onSentStarClick: (star: SentGalaxyStar) => void,
    blackHoleView: boolean,
  ) {
    this.scene = new THREE.Scene()
    this.makeStarTexture()
    this.camera = new THREE.PerspectiveCamera(52, 1, 1, 3000)
    this.camera.position.set(0, 0, 0)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(0, 0, 0)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.host.appendChild(this.renderer.domElement)
    const nebulaSky = this.makeNebulaSky()
    const nebulaTimeUniform = nebulaSky.material.uniforms['u_time']
    if (!nebulaTimeUniform) throw new Error('Nebula shader time uniform is missing')
    nebulaSky.renderOrder = -1
    nebulaSky.visible = true
    this.nebulaSky = nebulaSky
    this.scene.add(nebulaSky)
    this.galaxy = new THREE.Group()
    const distantStars = this.makeStars(4800, 980, 2.4, 0.78)
    const spiralStars = this.makeStars(2600, 520, 3.8, 0.92)
    const innerStars = this.makeStars(1000, 250, 5.2, 0.95)
    const starFields = [distantStars, spiralStars, innerStars]
    this.starFields = starFields
    this.blackHoleView = blackHoleView
    starFields.forEach((field) => {
      field.visible = !blackHoleView
    })
    this.galaxy.add(distantStars, spiralStars, innerStars)
    this.scene.add(this.galaxy)
    this.blackHole = new GalaxyBlackHole(this.galaxy, starFields, this.reducedMotion, this.camera)
    this.meteorEffect = new GalaxyMeteorEffect(
      this.host,
      this.scene,
      this.camera,
      this.reducedMotion,
    )
    this.meteorEffect.setEnabled(!blackHoleView)
    this.manager = new GalaxyManager({
      host: this.host,
      renderer: this.renderer,
      camera: this.camera,
      galaxy: this.galaxy,
      starFields,
      starTexture: this.starTexture!,
      geometries: this.geometries,
      materials: this.materials,
      onSentStarClick,
    })
    this.manager.setBlackHoleView(blackHoleView)
    this.blackHole.setBlackHoleView(blackHoleView)

    const resize = () => {
      if (!this.camera || !this.renderer) return
      this.camera.aspect = this.host.clientWidth / this.host.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.host.clientWidth, this.host.clientHeight)
    }
    this.resizeObserver = new ResizeObserver(resize)
    this.resizeObserver.observe(this.host)
    resize()

    const animate = (timestamp: number) => {
      if (!this.galaxy || !this.camera || !this.renderer || !this.scene || !this.manager) return
      nebulaTimeUniform.value = timestamp * 0.001
      nebulaSky.position.copy(this.camera.position)
      this.meteorEffect?.update(timestamp)
      this.manager.update(performance.now())
      this.blackHole?.update(timestamp)
      this.renderer.render(this.scene, this.camera)
      this.animationFrame = requestAnimationFrame(animate)
    }
    animate(performance.now())
  }
}
