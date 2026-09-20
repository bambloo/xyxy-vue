import * as THREE from 'three'

export class GalaxyStar {
  readonly key: string
  readonly field: THREE.Points
  readonly index: number
  readonly position: THREE.Vector3
  readonly color: string
  private connections = 0
  private readonly sprite: THREE.Sprite
  private readonly material: THREE.SpriteMaterial

  constructor(
    field: THREE.Points,
    index: number,
    color: string,
    texture: THREE.CanvasTexture,
    galaxy: THREE.Group,
    materials: THREE.Material[],
  ) {
    this.key = `${field.uuid}:${index}`
    this.field = field
    this.index = index
    this.color = color
    this.position = new THREE.Vector3().fromBufferAttribute(
      field.geometry.attributes.position as THREE.BufferAttribute,
      index,
    )
    this.material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.sprite = new THREE.Sprite(this.material)
    this.sprite.position.copy(this.position)
    galaxy.add(this.sprite)
    materials.push(this.material)
    this.update()
  }

  connect() {
    this.connections += 1
    this.update()
  }

  update(time = 0) {
    const tier = this.getTier()
    const sizes = [4, 6, 8.5, 11.5, 15]
    const brightness = [0.28, 0.42, 0.58, 0.76, 0.98]
    const pulse = tier === 0 ? 1 : 1 + Math.sin(time * 0.006 + this.index) * 0.08
    const size = sizes[tier] ?? 4
    const opacity = brightness[tier] ?? 0.28
    this.sprite.scale.setScalar(size * pulse)
    this.material.opacity = opacity
    this.material.color.set(this.color)
  }

  private getTier() {
    if (this.connections === 0) return 0
    if (this.connections === 1) return 1
    if (this.connections === 2) return 2
    if (this.connections <= 4) return 3
    return 4
  }
}
