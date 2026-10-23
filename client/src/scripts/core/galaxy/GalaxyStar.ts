import * as THREE from 'three'

export class GalaxyStar {
  readonly key: string
  readonly field: THREE.Points
  readonly index: number
  readonly position: THREE.Vector3
  color: string
  private readonly sprite: THREE.Sprite
  private readonly material: THREE.SpriteMaterial
  private readonly size: number
  private readonly phase: number
  private readonly regularOpacity: number
  private readonly regularColor: THREE.Color
  private readonly fieldColor: THREE.Color
  private sentStarColor?: THREE.Color
  private connectionCount = 0
  private isVisible = true

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
    this.regularColor = new THREE.Color(color)
    const fieldColors = field.geometry.getAttribute('color')
    this.fieldColor = fieldColors
      ? new THREE.Color().fromBufferAttribute(fieldColors, index)
      : new THREE.Color(1, 1, 1)
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
    this.update()
  }

  update(time = 0) {
    const pulse = 1 + Math.sin(time * 0.004 + this.phase) * 0.14
    const isSentStar = Boolean(this.sentStarColor)
    const interactionGlow = Math.min(1, Math.log2(this.connectionCount + 1) / 5)
    const brightness = 1 + interactionGlow * 1.2
    const opacity = isSentStar
      ? 1
      : this.regularOpacity + Math.sin(time * 0.003 + this.phase) * 0.12 + interactionGlow * 0.18
    this.sprite.scale.setScalar(this.size * pulse * (isSentStar ? 3.5 : 1))
    this.material.opacity = isSentStar ? 1 : opacity
    this.material.color.copy(this.sentStarColor ?? this.regularColor).multiplyScalar(brightness)
  }

  setColor(color: string) {
    this.color = color
    this.sentStarColor = new THREE.Color(color)
    this.material.color.copy(this.sentStarColor)
    this.material.opacity = 1
    this.sprite.scale.setScalar(this.size * 2.2)
  }

  setConnectionCount(count: number) {
    this.connectionCount = Math.max(0, Math.min(100, count))
  }

  setVisible(visible: boolean) {
    if (this.isVisible === visible) return
    this.isVisible = visible
    this.sprite.visible = visible

    const fieldColors = this.field.geometry.getAttribute('color')
    if (!fieldColors) return
    const color = visible ? this.fieldColor : new THREE.Color(0, 0, 0)
    fieldColors.setXYZ(this.index, color.r, color.g, color.b)
    fieldColors.needsUpdate = true
  }

}
