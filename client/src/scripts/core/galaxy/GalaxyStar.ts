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
  private readonly label?: THREE.Sprite
  private readonly labelMaterial?: THREE.SpriteMaterial

  private static readonly labels = [
    '星河',
    '林夕',
    '远山',
    '青禾',
    '北辰',
    '晚风',
    '云川',
    '初晴',
    '南枝',
  ]

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
    if (index % 29 === 0) {
      const labelTexture = GalaxyStar.makeLabelTexture(
        GalaxyStar.labels[Math.floor(index / 29) % GalaxyStar.labels.length] ?? '星河',
      )
      this.labelMaterial = new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
      this.label = new THREE.Sprite(this.labelMaterial)
      this.label.position.copy(this.position).add(new THREE.Vector3(16, 12, 0))
      this.label.scale.set(72, 18, 1)
      galaxy.add(this.label)
      materials.push(this.labelMaterial)
    }
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
    if (this.label && this.labelMaterial) {
      this.labelMaterial.opacity = 0.48 + (tier > 0 ? 0.2 : 0)
      this.label.scale.set(72, 18, 1 + Math.sin(time * 0.004 + this.index) * 0.025)
    }
  }

  private static makeLabelTexture(text: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) return new THREE.CanvasTexture(canvas)
    context.font = '28px "Microsoft YaHei", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.shadowColor = 'rgba(90, 186, 255, .9)'
    context.shadowBlur = 12
    context.fillStyle = '#e9f7ff'
    context.fillText(text, 128, 32)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  private getTier() {
    if (this.connections === 0) return 0
    if (this.connections === 1) return 1
    if (this.connections === 2) return 2
    if (this.connections <= 4) return 3
    return 4
  }
}
