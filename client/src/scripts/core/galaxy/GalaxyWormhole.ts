import * as THREE from 'three'
import type { GalaxyStar } from './GalaxyStar'

type WormholeOptions = {
  geometry: THREE.CylinderGeometry
  geometries: THREE.BufferGeometry[]
  materials: THREE.Material[]
}

export class GalaxyWormhole {
  private readonly rayGeometries: THREE.BufferGeometry[] = []
  private readonly glow: THREE.LineBasicMaterial[] = []
  private readonly core: THREE.LineBasicMaterial[] = []
  private readonly tube: THREE.MeshBasicMaterial[] = []
  private readonly glowSegments: THREE.Mesh[] = []
  private readonly rayFans: THREE.Vector3[] = []
  private readonly start: THREE.Vector3
  private readonly end: THREE.Vector3
  private readonly phase = Math.random() * 8
  private readonly strength: number
  private readonly glowWidth: number

  constructor(
    start: THREE.Vector3,
    end: THREE.Vector3,
    rayCount: number,
    group: THREE.Group,
    options: WormholeOptions,
    startStar?: GalaxyStar,
    endStar?: GalaxyStar,
  ) {
    const direction = end.clone().sub(start).normalize()
    const spreadAxis = new THREE.Vector3(0, 1, 0).cross(direction).normalize()
    if (spreadAxis.lengthSq() === 0) spreadAxis.set(1, 0, 0)
    this.start = start.clone()
    this.end = end.clone()
    this.strength = rayCount === 1 ? 0.3 : 1
    this.glowWidth = rayCount === 1 ? 0.55 : 2.2

    for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
      const spread = (rayIndex - (rayCount - 1) / 2) * 1.5
      const rayGeometry = new THREE.BufferGeometry()
      rayGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3))
      const glow = new THREE.LineBasicMaterial({
        color: 0xff5d86,
        transparent: true,
        opacity: rayCount === 1 ? 0.045 : 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const core = new THREE.LineBasicMaterial({
        color: 0xffe1df,
        transparent: true,
        opacity: rayCount === 1 ? 0.24 : 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const tube = new THREE.MeshBasicMaterial({
        color: 0xff315f,
        transparent: true,
        opacity: rayCount === 1 ? 0.025 : 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const ray = new THREE.Group()
      ray.add(new THREE.Line(rayGeometry, glow), new THREE.Line(rayGeometry, core))
      for (let segment = 0; segment < 7; segment += 1) {
        const glowSegment = new THREE.Mesh(options.geometry, tube)
        this.glowSegments.push(glowSegment)
        ray.add(glowSegment)
      }
      group.add(ray)
      options.geometries.push(rayGeometry)
      options.materials.push(glow, core, tube)
      this.rayGeometries.push(rayGeometry)
      this.rayFans.push(spreadAxis.clone().multiplyScalar(spread))
      this.glow.push(glow)
      this.core.push(core)
      this.tube.push(tube)
    }

    if (startStar && endStar) {
      startStar.connect()
      endStar.connect()
    }
  }

  update(time: number) {
    const pulse = 0.5 + Math.sin(time * 0.012 + this.phase) * 0.5
    this.rayGeometries.forEach((geometry, rayIndex) => {
      const position = geometry.getAttribute('position') as THREE.BufferAttribute
      const points: THREE.Vector3[] = []
      const fan = new THREE.Vector3().copy(this.rayFans[rayIndex] ?? new THREE.Vector3())
      const core = this.core[rayIndex] ?? this.core[0]
      const glow = this.glow[rayIndex] ?? this.glow[0]
      const tube = this.tube[rayIndex] ?? this.tube[0]
      if (!core || !glow || !tube) return
      for (let index = 0; index < 8; index += 1) {
        const progress = index / 7
        const point = this.start.clone().lerp(this.end, progress)
        if (index > 0 && index < 7) {
          const envelope = Math.sin(progress * Math.PI)
          point.addScaledVector(fan, envelope)
          const amplitude = Math.min(12, this.start.distanceTo(this.end) * 0.025)
          point.x += Math.sin(time * 0.018 + this.phase + index * 2.1) * amplitude * envelope
          point.y += Math.cos(time * 0.022 + this.phase * 1.4 + index) * amplitude * envelope
          point.z += Math.sin(time * 0.027 + this.phase * 0.7 + index * 1.6) * amplitude * envelope
        }
        points.push(point)
        position.setXYZ(index, point.x, point.y, point.z)
      }
      position.needsUpdate = true
      core.opacity = this.strength * (0.55 + pulse * 0.4)
      glow.opacity = this.strength * (0.1 + pulse * 0.18)
      tube.opacity = this.strength * (0.06 + pulse * 0.16)
      for (let segmentIndex = 0; segmentIndex < 7; segmentIndex += 1) {
        const segment = this.glowSegments[rayIndex * 7 + segmentIndex]
        const start = points[segmentIndex]
        const end = points[segmentIndex + 1]
        if (!segment || !start || !end) continue
        const segmentDirection = end.clone().sub(start)
        segment.position.copy(start).add(end).multiplyScalar(0.5)
        const glowWidth = this.glowWidth + pulse * this.glowWidth * 0.45
        segment.scale.set(glowWidth, segmentDirection.length(), glowWidth)
        segment.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          segmentDirection.normalize(),
        )
      }
    })
  }
}
