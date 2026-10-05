type Ember = {
  angle: number
  radius: number
  speed: number
  spin: number
  age: number
  lifetime: number
  size: number
  heat: number
}

type ColorStop = {
  at: number
  color: [number, number, number]
}

export class FireballEffect {
  private readonly context: CanvasRenderingContext2D
  private readonly size = 240
  private readonly center = this.size / 2
  private readonly orbRadius = 65
  private readonly surfaceTexture: HTMLCanvasElement
  private readonly embers = Array.from({ length: 12 }, () => this.createEmber(true))
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private frame = 0
  private previousTime = performance.now()

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')
    this.context = context
    this.surfaceTexture = this.createSurfaceTexture()

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = this.size * pixelRatio
    canvas.height = this.size * pixelRatio
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    this.render(this.previousTime, 0)
    if (!this.reducedMotion) this.frame = requestAnimationFrame(this.animate)
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.context.clearRect(0, 0, this.size, this.size)
  }

  private readonly animate = (time: number) => {
    const delta = Math.min((time - this.previousTime) / 16.67, 2)
    this.previousTime = time
    this.render(time, delta)
    this.frame = requestAnimationFrame(this.animate)
  }

  private render(time: number, delta: number) {
    const { context, size, center, orbRadius } = this
    context.clearRect(0, 0, size, size)

    const pulse = 1 + Math.sin(time * 0.0022) * 0.018
    const halo = context.createRadialGradient(
      center,
      center,
      orbRadius * 0.48,
      center,
      center,
      orbRadius + 27,
    )
    halo.addColorStop(0, 'rgba(255,211,24,0.24)')
    halo.addColorStop(0.55, 'rgba(255,111,0,0.17)')
    halo.addColorStop(1, 'rgba(235,44,0,0)')
    context.globalCompositeOperation = 'lighter'
    context.fillStyle = halo
    context.fillRect(0, 0, size, size)
    this.drawCorona(time)

    const boundary = this.traceOrb(time, pulse)
    context.save()
    context.clip(boundary)

    const diameter = orbRadius * 2 * pulse
    const driftX = Math.sin(time * 0.00012) * 2
    const driftY = Math.cos(time * 0.0001) * 1.5
    context.translate(center + driftX, center + driftY)
    context.rotate(Math.sin(time * 0.00016) * 0.025)
    context.drawImage(this.surfaceTexture, -diameter / 2, -diameter / 2, diameter, diameter)
    context.setTransform(
      Math.min(window.devicePixelRatio || 1, 2),
      0,
      0,
      Math.min(window.devicePixelRatio || 1, 2),
      0,
      0,
    )

    const sphericalShade = context.createRadialGradient(
      center - 24,
      center - 27,
      4,
      center - 3,
      center - 2,
      orbRadius * 1.12,
    )
    sphericalShade.addColorStop(0, 'rgba(255,255,221,0.38)')
    sphericalShade.addColorStop(0.48, 'rgba(255,221,67,0.12)')
    sphericalShade.addColorStop(0.86, 'rgba(255,122,0,0.04)')
    sphericalShade.addColorStop(1, 'rgba(177,38,0,0.16)')
    context.globalCompositeOperation = 'screen'
    context.fillStyle = sphericalShade
    context.fill(boundary)

    const hotRegion = context.createRadialGradient(
      center - 24,
      center - 25,
      0,
      center - 19,
      center - 18,
      48,
    )
    hotRegion.addColorStop(0, 'rgba(255,255,190,0.72)')
    hotRegion.addColorStop(0.35, 'rgba(255,236,44,0.38)')
    hotRegion.addColorStop(1, 'rgba(255,177,0,0)')
    context.globalCompositeOperation = 'screen'
    context.fillStyle = hotRegion
    context.fill(boundary)
    context.restore()

    context.globalCompositeOperation = 'lighter'
    this.drawRimFlicker(time)
    this.drawEmbers(delta)
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
  }

  private createSurfaceTexture() {
    const textureSize = 256
    const texture = document.createElement('canvas')
    texture.width = textureSize
    texture.height = textureSize
    const context = texture.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')

    const image = context.createImageData(textureSize, textureSize)
    const stops: ColorStop[] = [
      { at: 0, color: [130, 25, 0] },
      { at: 0.2, color: [194, 46, 0] },
      { at: 0.38, color: [239, 88, 0] },
      { at: 0.56, color: [255, 145, 0] },
      { at: 0.7, color: [255, 190, 5] },
      { at: 0.83, color: [255, 222, 35] },
      { at: 0.94, color: [255, 241, 119] },
      { at: 1, color: [255, 255, 222] },
    ]

    for (let y = 0; y < textureSize; y += 1) {
      for (let x = 0; x < textureSize; x += 1) {
        const u = x / textureSize
        const v = y / textureSize
        const warpX = this.valueNoise(u, v, 3, 11) - 0.5
        const warpY = this.valueNoise(u, v, 3, 23) - 0.5
        const warpedU = u + warpX * 0.12
        const warpedV = v + warpY * 0.12
        const broad = this.valueNoise(warpedU, warpedV, 4, 5)
        const cloud = this.valueNoise(warpedU, warpedV, 9, 17)
        const turbulent = this.valueNoise(warpedU, warpedV, 20, 31)
        const fine = this.valueNoise(warpedU, warpedV, 43, 47)
        const ridges = 1 - Math.abs(this.valueNoise(warpedU, warpedV, 67, 59) * 2 - 1)
        const heat = Math.max(
          0,
          Math.min(1, broad * 0.25 + cloud * 0.29 + turbulent * 0.22 + fine * 0.12 + ridges * 0.12),
        )
        const color = this.samplePalette(stops, heat)
        const offset = (y * textureSize + x) * 4
        image.data[offset] = color[0]
        image.data[offset + 1] = color[1]
        image.data[offset + 2] = color[2]
        image.data[offset + 3] = 255
      }
    }

    context.putImageData(image, 0, 0)
    return texture
  }

  private valueNoise(u: number, v: number, frequency: number, seed: number) {
    const x = u * frequency
    const y = v * frequency
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = this.smooth(x - x0)
    const ty = this.smooth(y - y0)
    const top = this.lerp(this.hash(x0, y0, seed), this.hash(x0 + 1, y0, seed), tx)
    const bottom = this.lerp(this.hash(x0, y0 + 1, seed), this.hash(x0 + 1, y0 + 1, seed), tx)
    return this.lerp(top, bottom, ty)
  }

  private hash(x: number, y: number, seed: number) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return value - Math.floor(value)
  }

  private smooth(value: number) {
    return value * value * (3 - 2 * value)
  }

  private lerp(start: number, end: number, amount: number) {
    return start + (end - start) * amount
  }

  private samplePalette(stops: ColorStop[], value: number): [number, number, number] {
    for (let index = 1; index < stops.length; index += 1) {
      const previous = stops[index - 1]
      const current = stops[index]
      if (!previous || !current || value > current.at) continue
      const amount = (value - previous.at) / (current.at - previous.at)
      return [
        this.lerp(previous.color[0], current.color[0], amount),
        this.lerp(previous.color[1], current.color[1], amount),
        this.lerp(previous.color[2], current.color[2], amount),
      ]
    }
    return stops[stops.length - 1]?.color ?? [255, 255, 255]
  }

  private traceOrb(time: number, pulse: number) {
    const path = new Path2D()
    const pointCount = 128
    for (let index = 0; index <= pointCount; index += 1) {
      const angle = (index / pointCount) * Math.PI * 2
      const ripple =
        Math.sin(angle * 7 + time * 0.0011) * 1.6 +
        Math.sin(angle * 13 - time * 0.0008) * 0.75 +
        Math.sin(angle * 21 + time * 0.0016) * 0.28
      const radius = this.orbRadius * pulse + ripple
      const x = this.center + Math.cos(angle) * radius
      const y = this.center + Math.sin(angle) * radius
      if (index === 0) path.moveTo(x, y)
      else path.lineTo(x, y)
    }
    path.closePath()
    return path
  }

  private drawRimFlicker(time: number) {
    const { context, center, orbRadius } = this
    for (let index = 0; index < 12; index += 1) {
      const phase = index * 2.37
      const angle = phase + Math.sin(time * 0.001 + phase) * 0.13
      const radius = orbRadius + Math.sin(time * 0.0018 + phase) * 2.5
      const x = center + Math.cos(angle) * radius
      const y = center + Math.sin(angle) * radius
      const size = 1.2 + (Math.sin(time * 0.003 + phase) + 1) * 1.1
      const glow = context.createRadialGradient(x, y, 0, x, y, size * 2.6)
      glow.addColorStop(0, 'rgba(255,248,154,0.82)')
      glow.addColorStop(0.4, 'rgba(255,175,0,0.48)')
      glow.addColorStop(1, 'rgba(255,75,0,0)')
      context.fillStyle = glow
      context.fillRect(x - size * 3, y - size * 3, size * 6, size * 6)
    }
  }

  private drawCorona(time: number) {
    const { context, center, orbRadius } = this
    context.save()
    context.globalCompositeOperation = 'lighter'

    for (let index = 0; index < 48; index += 1) {
      const angle = (index / 48) * Math.PI * 2
      const wave = (Math.sin(time * 0.0014 + index * 2.3) + 1) / 2
      const length = 4 + wave * (index % 4 === 0 ? 18 : 9)
      const startX = center + Math.cos(angle) * (orbRadius - 1)
      const startY = center + Math.sin(angle) * (orbRadius - 1)
      const endX = center + Math.cos(angle) * (orbRadius + length)
      const endY = center + Math.sin(angle) * (orbRadius + length)
      const gradient = context.createLinearGradient(startX, startY, endX, endY)
      gradient.addColorStop(0, 'rgba(255,245,167,0.62)')
      gradient.addColorStop(0.45, 'rgba(255,183,32,0.3)')
      gradient.addColorStop(1, 'rgba(255,117,0,0)')
      context.strokeStyle = gradient
      context.lineWidth = index % 4 === 0 ? 1.5 : 0.8
      context.beginPath()
      context.moveTo(startX, startY)
      context.lineTo(endX, endY)
      context.stroke()
    }

    for (let index = 0; index < 4; index += 1) {
      const angle = time * 0.00022 + index * ((Math.PI * 2) / 3)
      const spread = 0.78
      const startAngle = angle - spread / 2
      const endAngle = angle + spread / 2
      const controlRadius = orbRadius + 47 + Math.sin(time * 0.001 + index) * 9
      const startX = center + Math.cos(startAngle) * orbRadius
      const startY = center + Math.sin(startAngle) * orbRadius
      const endX = center + Math.cos(endAngle) * orbRadius
      const endY = center + Math.sin(endAngle) * orbRadius
      const control1X = center + Math.cos(angle - 0.28) * controlRadius
      const control1Y = center + Math.sin(angle - 0.28) * controlRadius
      const control2X = center + Math.cos(angle + 0.28) * controlRadius
      const control2Y = center + Math.sin(angle + 0.28) * controlRadius

      context.beginPath()
      context.moveTo(startX, startY)
      context.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY)
      context.strokeStyle = 'rgba(255,214,74,0.72)'
      context.lineWidth = 2.8
      context.shadowColor = 'rgba(255,137,0,0.9)'
      context.shadowBlur = 8
      context.stroke()
      context.shadowBlur = 0
    }

    context.restore()
  }

  private drawEmbers(delta: number) {
    const { context, center, embers } = this
    embers.forEach((ember, index) => {
      ember.age += delta
      ember.radius += ember.speed * delta
      ember.angle += ember.spin * delta
      if (ember.age >= ember.lifetime || ember.radius > this.orbRadius + 24)
        embers[index] = this.createEmber()
      const current = embers[index]
      if (!current) return
      const life = 1 - current.age / current.lifetime
      const x = center + Math.cos(current.angle) * current.radius
      const y = center + Math.sin(current.angle) * current.radius - current.age * 0.035
      const radius = current.size * life
      const spark = context.createRadialGradient(x, y, 0, x, y, radius * 3)
      spark.addColorStop(0, `rgba(255,255,203,${current.heat})`)
      spark.addColorStop(0.32, `rgba(255,196,0,${current.heat * 0.65})`)
      spark.addColorStop(1, 'rgba(255,102,0,0)')
      context.fillStyle = spark
      context.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6)
    })
  }

  private createEmber(initial = false): Ember {
    return {
      angle: Math.random() * Math.PI * 2,
      radius: initial ? this.orbRadius - 2 + Math.random() * 8 : this.orbRadius + Math.random() * 5,
      speed: 0.04 + Math.random() * 0.12,
      spin: (Math.random() - 0.5) * 0.03,
      age: initial ? Math.random() * 40 : 0,
      lifetime: 35 + Math.random() * 54,
      size: 0.6 + Math.random() * 1.5,
      heat: 0.32 + Math.random() * 0.68,
    }
  }
}
