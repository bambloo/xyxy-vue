import * as THREE from 'three'
import type { GalaxyStar } from './GalaxyStar'

export class GalaxyLink {
  private readonly glow: THREE.Line
  private readonly core: THREE.Line
  private readonly glowMaterial: THREE.LineBasicMaterial
  private readonly coreMaterial: THREE.LineBasicMaterial
  private readonly travelers: THREE.Mesh[] = []
  private readonly travelerMaterials: THREE.MeshBasicMaterial[] = []
  private readonly curve: THREE.CubicBezierCurve3
  private readonly startColor: THREE.Color
  private readonly endColor: THREE.Color
  private readonly travelerGeometry: THREE.ConeGeometry
  private readonly phase = Math.random() * Math.PI * 2

  constructor(
    start: GalaxyStar,
    end: GalaxyStar,
    galaxy: THREE.Group,
    geometries: THREE.BufferGeometry[],
    materials: THREE.Material[],
  ) {
    const direction = end.position.clone().sub(start.position)
    const side = new THREE.Vector3(-direction.z, direction.x, direction.y * 0.35)
    if (side.lengthSq() === 0) side.set(1, 0, 0)
    side.normalize()
    const amplitude = Math.min(72, Math.max(18, direction.length() * (0.12 + Math.random() * 0.14)))
    const lift = (Math.random() - 0.5) * amplitude * 0.8
    const controlStart = start.position
      .clone()
      .addScaledVector(direction, 0.28)
      .addScaledVector(side, amplitude)
      .add(new THREE.Vector3(0, lift, 0))
    const controlEnd = end.position
      .clone()
      .addScaledVector(direction, -0.28)
      .addScaledVector(side, -amplitude * (0.55 + Math.random() * 0.35))
      .add(new THREE.Vector3(0, -lift * 0.7, 0))
    this.curve = new THREE.CubicBezierCurve3(start.position, controlStart, controlEnd, end.position)
    const points = this.curve.getPoints(32)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    this.startColor = new THREE.Color(start.color)
    this.endColor = new THREE.Color(end.color)
    const colors: number[] = []
    points.forEach((_, index) => {
      const color = this.startColor.clone().lerp(this.endColor, index / (points.length - 1))
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

    this.travelerGeometry = new THREE.ConeGeometry(1.3, 4.5, 6)
    geometries.push(this.travelerGeometry)
    for (let index = 0; index < 2; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: this.startColor,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const traveler = new THREE.Mesh(this.travelerGeometry, material)
      galaxy.add(traveler)
      this.travelers.push(traveler)
      this.travelerMaterials.push(material)
      materials.push(material)
    }
  }

  update(time: number) {
    const pulse = 0.5 + Math.sin(time * 0.0028 + this.phase) * 0.5
    this.glowMaterial.opacity = 0.08 + pulse * 0.12
    this.coreMaterial.opacity = 0.3 + pulse * 0.28
    this.travelers.forEach((traveler, index) => {
      const cycle = (time * 0.00012 + this.phase / (Math.PI * 2) + index * 0.5) % 2
      const progress = cycle <= 1 ? cycle : 2 - cycle
      const position = this.curve.getPointAt(progress)
      const tangent = this.curve.getTangentAt(progress).normalize()
      if (cycle > 1) tangent.negate()
      traveler.position.copy(position)
      traveler.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
      this.travelerMaterials[index]?.color.copy(this.startColor).lerp(this.endColor, progress)
      traveler.scale.setScalar(0.65 + pulse * 0.24)
      if (this.travelerMaterials[index]) this.travelerMaterials[index].opacity = 0.55 + pulse * 0.4
    })
  }

  destroy(galaxy: THREE.Group) {
    galaxy.remove(this.glow, this.core, ...this.travelers)
  }
}
