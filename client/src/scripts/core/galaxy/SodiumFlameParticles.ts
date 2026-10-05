type FlameParticle = {
  progress: number
  speed: number
  offset: number
  phase: number
  size: number
  heat: number
}

export class SodiumFlameParticles {
  private readonly context: CanvasRenderingContext2D
  private readonly canvasSize = 144
  private readonly center = this.canvasSize / 2
  private readonly baseY = 54
  private readonly particles: FlameParticle[] = []
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private frame = 0
  private previousTime = performance.now()

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')
    this.context = context

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = this.canvasSize * pixelRatio
    canvas.height = this.canvasSize * pixelRatio
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    for (let index = 0; index < 46; index += 1) this.particles.push(this.createParticle(true))
    this.render(this.previousTime, 0)
    if (!this.reducedMotion) this.frame = requestAnimationFrame(this.animate)
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.context.clearRect(0, 0, this.canvasSize, this.canvasSize)
  }

  private readonly animate = (time: number) => {
    const delta = Math.min((time - this.previousTime) / 16.67, 2)
    this.previousTime = time
    this.render(time, delta)
    this.frame = requestAnimationFrame(this.animate)
  }

  private render(time: number, delta: number) {
    const { context, canvasSize, center, baseY } = this
    context.clearRect(0, 0, canvasSize, canvasSize)
    context.globalCompositeOperation = 'lighter'

    const flicker = Math.sin(time * 0.006) * 2.1 + Math.sin(time * 0.011) * 1.2
    const tipX = center + Math.sin(time * 0.0032) * 3.2
    const topY = 11 + Math.sin(time * 0.0045) * 2

    const glow = context.createRadialGradient(center, baseY - 15, 2, center, baseY - 15, 44)
    glow.addColorStop(0, 'rgba(255,234,73,0.24)')
    glow.addColorStop(0.48, 'rgba(255,181,0,0.12)')
    glow.addColorStop(1, 'rgba(255,128,0,0)')
    context.fillStyle = glow
    context.fillRect(center - 48, topY - 8, 96, baseY - topY + 24)

    this.drawFlameLayer(
      tipX,
      baseY,
      topY,
      17 + flicker,
      'rgba(255,146,0,0.04)',
      'rgba(255,187,0,0.38)',
      'rgba(255,110,0,0.01)',
    )
    this.drawFlameLayer(
      tipX + flicker * 0.3,
      baseY,
      topY + 10,
      10 + flicker * 0.5,
      'rgba(255,255,124,0.25)',
      'rgba(255,232,22,0.8)',
      'rgba(255,169,0,0.04)',
    )
    this.drawFlameLayer(
      tipX - flicker * 0.18,
      baseY,
      topY + 23,
      5.5,
      'rgba(255,255,225,0.82)',
      'rgba(255,245,102,0.65)',
      'rgba(255,212,0,0)',
    )

    this.particles.forEach((particle, index) => {
      particle.progress += particle.speed * delta
      if (particle.progress >= 1) this.particles[index] = this.createParticle()
      const current = this.particles[index]
      if (!current) return

      const progress = current.progress
      const width = Math.pow(Math.sin(Math.PI * Math.min(progress, 0.98)), 0.72) * 9
      const sway = Math.sin(time * 0.0035 + current.phase + progress * 5) * width
      const x = center + sway + current.offset * (0.25 + progress * 0.75)
      const y = baseY - progress * (baseY - topY - 2)
      const alpha = Math.sin(Math.PI * progress) ** 0.7 * current.heat
      const radius = current.size * (0.52 + (1 - progress) * 0.42)

      context.globalAlpha = alpha * 0.72
      context.shadowColor = 'rgba(255,204,0,0.68)'
      context.shadowBlur = radius * 5
      const particleGlow = context.createRadialGradient(x, y, 0, x, y, radius * 2.8)
      particleGlow.addColorStop(0, 'rgba(255,255,196,0.94)')
      particleGlow.addColorStop(0.32, 'rgba(255,229,28,0.78)')
      particleGlow.addColorStop(1, 'rgba(255,166,0,0)')
      context.fillStyle = particleGlow
      context.beginPath()
      context.ellipse(x, y, radius * 0.72, radius * 1.7, sway * 0.035, 0, Math.PI * 2)
      context.fill()
    })

    context.globalAlpha = 1
    context.shadowBlur = 0
  }

  private drawFlameLayer(
    tipX: number,
    baseY: number,
    topY: number,
    halfWidth: number,
    baseColor: string,
    middleColor: string,
    tipColor: string,
  ) {
    const { context, center } = this
    const gradient = context.createLinearGradient(0, baseY, 0, topY)
    gradient.addColorStop(0, baseColor)
    gradient.addColorStop(0.48, middleColor)
    gradient.addColorStop(1, tipColor)
    context.globalAlpha = 0.88
    context.fillStyle = gradient
    context.shadowColor = 'rgba(255,201,0,0.52)'
    context.shadowBlur = halfWidth * 1.4
    context.beginPath()
    context.moveTo(center - halfWidth * 0.72, baseY)
    context.bezierCurveTo(
      center - halfWidth * 1.2,
      baseY - 12,
      tipX - halfWidth * 0.58,
      topY + 10,
      tipX,
      topY,
    )
    context.bezierCurveTo(
      tipX + halfWidth * 0.55,
      topY + 12,
      center + halfWidth * 1.3,
      baseY - 10,
      center + halfWidth * 0.72,
      baseY,
    )
    context.closePath()
    context.fill()
    context.shadowBlur = 0
  }

  private createParticle(initial = false): FlameParticle {
    return {
      progress: initial ? Math.random() * 0.96 : 0,
      speed: 0.006 + Math.random() * 0.009,
      offset: (Math.random() - 0.5) * 8,
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 2,
      heat: 0.54 + Math.random() * 0.46,
    }
  }
}
