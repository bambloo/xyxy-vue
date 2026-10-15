function drawGalaxyStarTexture(context: CanvasRenderingContext2D) {
  context.globalCompositeOperation = 'lighter'
  const halo = context.createRadialGradient(64, 64, 2, 64, 64, 50)
  halo.addColorStop(0, 'rgba(255,255,255,1)')
  halo.addColorStop(0.12, 'rgba(231,249,255,.98)')
  halo.addColorStop(0.34, 'rgba(111,207,255,.72)')
  halo.addColorStop(0.7, 'rgba(62,157,255,.18)')
  halo.addColorStop(1, 'rgba(30,98,255,0)')
  context.fillStyle = halo
  context.beginPath()
  context.arc(64, 64, 50, 0, Math.PI * 2)
  context.fill()
  const core = context.createRadialGradient(64, 64, 0, 64, 64, 17)
  core.addColorStop(0, '#ffffff')
  core.addColorStop(0.35, 'rgba(255,255,255,.98)')
  core.addColorStop(1, 'rgba(182,235,255,0)')
  context.fillStyle = core
  context.beginPath()
  context.arc(64, 64, 17, 0, Math.PI * 2)
  context.fill()
}

export function createGalaxyStarTextureCanvas(color?: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to create galaxy star texture')
  drawGalaxyStarTexture(context)
  if (!color) return canvas

  const tintedCanvas = document.createElement('canvas')
  tintedCanvas.width = canvas.width
  tintedCanvas.height = canvas.height
  const tintedContext = tintedCanvas.getContext('2d')
  if (!tintedContext) throw new Error('Failed to tint galaxy star texture')
  tintedContext.drawImage(canvas, 0, 0)
  tintedContext.globalCompositeOperation = 'multiply'
  tintedContext.fillStyle = color
  tintedContext.fillRect(0, 0, canvas.width, canvas.height)
  tintedContext.globalCompositeOperation = 'destination-in'
  tintedContext.drawImage(canvas, 0, 0)
  return tintedCanvas
}

export function createGalaxyStarLabelCanvas(title: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to create galaxy star label')
  context.font = '30px "Microsoft YaHei", sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.shadowColor = color
  context.shadowBlur = 14
  context.fillStyle = '#ffffff'
  context.fillText(title, 192, 48, 360)
  return canvas
}
