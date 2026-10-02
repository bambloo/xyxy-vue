import * as THREE from 'three'
import type { GalaxyStar } from './GalaxyStar'

export class GalaxyLink {
  private readonly glow: THREE.Line
  private readonly core: THREE.Line
  private readonly glowMaterial: THREE.LineBasicMaterial
  private readonly coreMaterial: THREE.LineBasicMaterial
  private readonly phase = Math.random() * Math.PI * 2

  constructor(
    start: GalaxyStar,
    end: GalaxyStar,
    galaxy: THREE.Group,
    geometries: THREE.BufferGeometry[],
    materials: THREE.Material[],
  ) {
    const direction = end.position.clone().sub(start.position)
    const bend = new THREE.Vector3(-direction.z, direction.y * 0.15, direction.x)
    if (bend.lengthSq() === 0) bend.set(0, 1, 0)
    bend.normalize().multiplyScalar(Math.min(42, direction.length() * 0.18))
    const control = start.position.clone().add(end.position).multiplyScalar(0.5).add(bend)
    const curve = new THREE.QuadraticBezierCurve3(start.position, control, end.position)
    const points = curve.getPoints(28)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const startColor = new THREE.Color(start.color)
    const endColor = new THREE.Color(end.color)
    const colors: number[] = []
    points.forEach((_, index) => {
      const color = startColor.clone().lerp(endColor, index / (points.length - 1))
      colors.push(color.r, color.g, color.b)
    })
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

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
    this.glow = new THREE.Line(geometry, this.glowMaterial)
    this.core = new THREE.Line(geometry, this.coreMaterial)
    galaxy.add(this.glow, this.core)
    geometries.push(geometry)
    materials.push(this.glowMaterial, this.coreMaterial)
  }

  update(time: number) {
    const pulse = 0.5 + Math.sin(time * 0.006 + this.phase) * 0.5
    this.glowMaterial.opacity = 0.08 + pulse * 0.12
    this.coreMaterial.opacity = 0.3 + pulse * 0.28
  }

  destroy(galaxy: THREE.Group) {
    galaxy.remove(this.glow, this.core)
  }
}
