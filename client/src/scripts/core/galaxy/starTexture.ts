function drawGalaxyStarTexture(context: CanvasRenderingContext2D) {
  context.globalCompositeOperation = 'lighter'
  const halo = context.createRadialGradient(64, 64, 2, 64, 64, 40)
  halo.addColorStop(0, 'rgba(205,235,255,.78)')
  halo.addColorStop(0.12, 'rgba(195,232,255,.72)')
  halo.addColorStop(0.34, 'rgba(111,207,255,.72)')
  halo.addColorStop(0.7, 'rgba(62,157,255,.18)')
  halo.addColorStop(1, 'rgba(30,98,255,0)')
  context.fillStyle = halo
  context.beginPath()
  context.arc(64, 64, 50, 0, Math.PI * 2)
  context.fill()
  const core = context.createRadialGradient(64, 64, 0, 64, 64, 32)
  core.addColorStop(0, 'rgba(215,240,255,.68)')
  core.addColorStop(0.35, 'rgba(195,232,255,.58)')
  core.addColorStop(1, 'rgba(182,235,255,0)')
  context.fillStyle = core
  context.beginPath()
  context.arc(64, 64, 17, 0, Math.PI * 2)
  context.fill()
  // const sharpCore = context.createRadialGradient(64, 64, 0, 64, 64, 5)
  // sharpCore.addColorStop(0, 'rgba(255,255,255,.98)')
  // sharpCore.addColorStop(0.55, 'rgba(235,248,255,.92)')
  // sharpCore.addColorStop(0.82, 'rgba(205,235,255,.62)')
  // sharpCore.addColorStop(1, 'rgba(182,235,255,0)')
  // context.fillStyle = sharpCore
  // context.beginPath()
  // context.arc(64, 64, 5, 0, Math.PI * 2)
  // context.fill()
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

export function createGalaxyStarLabelSdfCanvas(title: string) {
  const width = 512
  const height = 128
  const spread = 16
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true })
  if (!maskContext) throw new Error('Failed to create galaxy star label mask')
  maskContext.fillStyle = '#ffffff'
  maskContext.font = '76px "Microsoft YaHei", sans-serif'
  maskContext.textAlign = 'center'
  maskContext.textBaseline = 'middle'
  maskContext.fillText(title, width / 2, height / 2, width - spread * 4)
  const mask = maskContext.getImageData(0, 0, width, height).data
  const distanceToInside = new Float32Array(width * height)
  const distanceToOutside = new Float32Array(width * height)
  const maximumDistance = spread + 1

  for (let index = 0; index < width * height; index++) {
    const inside = mask[index * 4 + 3]! >= 128
    distanceToInside[index] = inside ? 0 : maximumDistance
    distanceToOutside[index] = inside ? maximumDistance : 0
  }
  computeChamferDistance(distanceToInside, width, height, maximumDistance)
  computeChamferDistance(distanceToOutside, width, height, maximumDistance)

  const sdfCanvas = document.createElement('canvas')
  sdfCanvas.width = width
  sdfCanvas.height = height
  const sdfContext = sdfCanvas.getContext('2d')
  if (!sdfContext) throw new Error('Failed to create galaxy star label SDF')
  const sdf = sdfContext.createImageData(width, height)
  for (let index = 0; index < width * height; index++) {
    const signedDistance = distanceToOutside[index]! - distanceToInside[index]!
    const value = Math.round(Math.max(0, Math.min(1, 0.5 + signedDistance / (spread * 2))) * 255)
    const offset = index * 4
    sdf.data[offset] = value
    sdf.data[offset + 1] = value
    sdf.data[offset + 2] = value
    sdf.data[offset + 3] = 255
  }
  sdfContext.putImageData(sdf, 0, 0)
  return sdfCanvas
}

function computeChamferDistance(
  distances: Float32Array,
  width: number,
  height: number,
  maximumDistance: number,
) {
  const diagonal = Math.SQRT2
  const update = (x: number, y: number, offsetX: number, offsetY: number, cost: number) => {
    const neighborX = x + offsetX
    const neighborY = y + offsetY
    if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) return
    const index = y * width + x
    const neighborIndex = neighborY * width + neighborX
    distances[index] = Math.min(
      distances[index]!,
      distances[neighborIndex]! + cost,
      maximumDistance,
    )
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      update(x, y, -1, 0, 1)
      update(x, y, 0, -1, 1)
      update(x, y, -1, -1, diagonal)
      update(x, y, 1, -1, diagonal)
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      update(x, y, 1, 0, 1)
      update(x, y, 0, 1, 1)
      update(x, y, 1, 1, diagonal)
      update(x, y, -1, 1, diagonal)
    }
  }
}
