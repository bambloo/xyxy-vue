import * as THREE from 'three'

export class GalaxyStar {
  readonly key: string
  readonly field: THREE.Points
  readonly index: number
  readonly position: THREE.Vector3
  color: string
  private readonly sprite: THREE.Sprite
  private readonly material: THREE.SpriteMaterial
  private readonly label?: THREE.Sprite
  private readonly labelMaterial?: THREE.SpriteMaterial
  private readonly size: number
  private readonly phase: number
  private readonly regularOpacity: number
  private readonly regularColor: THREE.Color
  private sentStarColor?: THREE.Color

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
    this.size = 3.2 + (((index * 37) % 100) / 100) * 4.8
    this.phase = (index * 2.417) % (Math.PI * 2)
    const fieldMaterial = field.material
    const pointMaterial = fieldMaterial instanceof THREE.PointsMaterial ? fieldMaterial : undefined
    this.regularOpacity = 0.38 + (pointMaterial?.opacity ?? 0.92) * 0.12
    this.regularColor = pointMaterial?.color.clone() ?? new THREE.Color(0xd8efff)
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
    this.sprite.material.rotation = this.phase
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

  update(time = 0) {
    const pulse = 1 + Math.sin(time * 0.004 + this.phase) * 0.14
    const isSentStar = Boolean(this.sentStarColor)
    const opacity = isSentStar
      ? 1
      : this.regularOpacity + Math.sin(time * 0.003 + this.phase) * 0.12
    this.sprite.scale.setScalar(this.size * pulse * (isSentStar ? 3.5 : 1))
    this.material.opacity = isSentStar ? 1 : opacity
    this.material.color.copy(this.sentStarColor ?? this.regularColor)
    if (this.label && this.labelMaterial) {
      this.labelMaterial.opacity = 0.48
      this.label.scale.set(72, 18, 1 + Math.sin(time * 0.004 + this.index) * 0.025)
    }
  }

  setColor(color: string) {
    this.color = color
    this.sentStarColor = new THREE.Color(color)
    this.material.color.copy(this.sentStarColor)
    this.material.opacity = 1
    this.sprite.scale.setScalar(this.size * 2.2)
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
}
