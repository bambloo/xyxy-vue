import * as THREE from 'three'
import type { GalaxyStar } from './GalaxyStar'

function addCameraDistanceFade(material: THREE.LineBasicMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCameraDistance;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvCameraDistance = length(mvPosition.xyz);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCameraDistance;')
      .replace(
        '#include <opaque_fragment>',
        `float cameraFade = pow(1.0 - smoothstep(80.0, 600.0, vCameraDistance), 2.0);
diffuseColor.rgb *= cameraFade;
diffuseColor.a *= cameraFade;
#include <opaque_fragment>`,
      )
  }
  material.customProgramCacheKey = () => 'galaxy-link-camera-distance-fade'
}

export class GalaxyLink {
  private readonly glow: THREE.Line
  private readonly core: THREE.Line
  private readonly lineGeometry: THREE.BufferGeometry
  private readonly glowMaterial: THREE.LineBasicMaterial
  private readonly coreMaterial: THREE.LineBasicMaterial
  private readonly curve: THREE.CubicBezierCurve3
  private readonly startColor: THREE.Color
  private readonly endColor: THREE.Color
  private readonly side: THREE.Vector3
  private readonly controlStart: THREE.Vector3
  private readonly controlEnd: THREE.Vector3
  private readonly amplitude: number
  private readonly phase = Math.random() * Math.PI * 2
  private targetConnectionCount: number
  private displayedConnectionCount: number
  private lastUpdateTime = performance.now()

  constructor(
    start: GalaxyStar,
    end: GalaxyStar,
    galaxy: THREE.Group,
    geometries: THREE.BufferGeometry[],
    materials: THREE.Material[],
    connectionCount = 1,
    animateIn = false,
  ) {
    const direction = end.position.clone().sub(start.position)
    this.side = new THREE.Vector3(-direction.z, direction.x, direction.y * 0.35)
    if (this.side.lengthSq() === 0) this.side.set(1, 0, 0)
    this.side.normalize()
    this.amplitude = Math.min(72, Math.max(18, direction.length() * (0.12 + Math.random() * 0.14)))
    const lift = (Math.random() - 0.5) * this.amplitude * 0.8
    this.controlStart = start.position
      .clone()
      .addScaledVector(direction, 0.28)
      .addScaledVector(this.side, this.amplitude)
      .add(new THREE.Vector3(0, lift, 0))
    this.controlEnd = end.position
      .clone()
      .addScaledVector(direction, -0.28)
      .addScaledVector(this.side, -this.amplitude * (0.55 + Math.random() * 0.35))
      .add(new THREE.Vector3(0, -lift * 0.7, 0))
    this.curve = new THREE.CubicBezierCurve3(
      start.position,
      this.controlStart,
      this.controlEnd,
      end.position,
    )
    this.targetConnectionCount = THREE.MathUtils.clamp(connectionCount, 0, 100)
    this.displayedConnectionCount = animateIn ? 0 : this.targetConnectionCount
    this.startColor = new THREE.Color(start.color)
    this.endColor = new THREE.Color(end.color)
    this.lineGeometry = this.createLineGeometry(this.getVisibleLineCount())

    this.glowMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    })
    this.coreMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    })
    addCameraDistanceFade(this.glowMaterial)
    addCameraDistanceFade(this.coreMaterial)
    this.glow = new THREE.LineSegments(this.lineGeometry, this.glowMaterial)
    this.core = new THREE.LineSegments(this.lineGeometry, this.coreMaterial)
    this.glow.frustumCulled = false
    this.core.frustumCulled = false
    galaxy.add(this.glow, this.core)
    geometries.push(this.lineGeometry)
    materials.push(this.glowMaterial, this.coreMaterial)
  }

  update(time: number) {
    const deltaSeconds = Math.min(0.05, Math.max(0, (time - this.lastUpdateTime) / 1000))
    this.lastUpdateTime = time
    const previousLineCount = this.getVisibleLineCount()
    this.displayedConnectionCount +=
      (this.targetConnectionCount - this.displayedConnectionCount) * Math.min(1, deltaSeconds * 2.5)
    if (Math.abs(this.targetConnectionCount - this.displayedConnectionCount) < 0.02) {
      this.displayedConnectionCount = this.targetConnectionCount
    }
    const visibleLineCount = this.getVisibleLineCount()
    if (visibleLineCount !== previousLineCount) this.updateLineGeometry(visibleLineCount)

    const pulse = 0.5 + Math.sin(time * 0.0028 + this.phase) * 0.5
    const visibility = Math.min(1, this.displayedConnectionCount)
    const bundleFade = 1 / Math.sqrt(Math.max(1, visibleLineCount))
    this.glowMaterial.opacity = (0.08 + pulse * 0.12) * visibility * bundleFade
    this.coreMaterial.opacity = (0.3 + pulse * 0.28) * visibility * bundleFade
  }

  destroy(galaxy: THREE.Group) {
    galaxy.remove(this.glow, this.core)
  }

  setConnectionCount(count: number) {
    this.targetConnectionCount = THREE.MathUtils.clamp(count, 0, 100)
  }

  private getVisibleLineCount() {
    return Math.ceil(this.displayedConnectionCount)
  }

  private createLineGeometry(connectionCount: number) {
    const geometry = new THREE.BufferGeometry()
    this.writeLineGeometry(geometry, connectionCount)
    return geometry
  }

  private updateLineGeometry(connectionCount: number) {
    this.writeLineGeometry(this.lineGeometry, connectionCount)
  }

  private writeLineGeometry(geometry: THREE.BufferGeometry, connectionCount: number) {
    const positions: number[] = []
    const colors: number[] = []
    const segments = 24
    for (let lane = 0; lane < connectionCount; lane += 1) {
      const laneOffset =
        connectionCount <= 1
          ? 0
          : ((lane / (connectionCount - 1)) * 2 - 1) * Math.min(18, this.amplitude * 0.18)
      const curve = new THREE.CubicBezierCurve3(
        this.curve.v0,
        this.controlStart.clone().addScaledVector(this.side, laneOffset),
        this.controlEnd.clone().addScaledVector(this.side, laneOffset),
        this.curve.v3,
      )
      const points = curve.getPoints(segments)
      for (let index = 0; index < segments; index += 1) {
        const startPoint = points[index]
        const endPoint = points[index + 1]
        if (!startPoint || !endPoint) continue
        positions.push(startPoint.x, startPoint.y, startPoint.z, endPoint.x, endPoint.y, endPoint.z)
        const startProgress = index / segments
        const endProgress = (index + 1) / segments
        const startColor = this.startColor.clone().lerp(this.endColor, startProgress)
        const endColor = this.startColor.clone().lerp(this.endColor, endProgress)
        colors.push(startColor.r, startColor.g, startColor.b, endColor.r, endColor.g, endColor.b)
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.computeBoundingSphere()
  }
}
