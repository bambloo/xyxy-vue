import * as THREE from 'three'

const TEXTURE_SIZE = 256
const PAGE_DISTANCE = 20

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp float;

  varying vec2 vUv;
  uniform vec3 iResolution;
  uniform float iTime;
  uniform vec3 uStarColor;
  uniform sampler2D iChannel0;
  uniform sampler2D iChannel1;
  uniform vec3 iChannelResolution[2];

  const float RETICULATION = 3.0;
  const float NB_ARMS = 5.0;
  const float COMPR = 0.1;
  const float SPEED = 0.1;
  const float GALAXY_R = 0.5;
  const float BULB_R = 0.5;
  const vec3 GALAXY_COL = vec3(0.5, 0.46, 0.4) * 10.0;
  const vec3 BULB_COL = vec3(1.0, 0.8, 0.6);
  const float BULB_BLACK_R = 0.48;
  const vec3 SKY_COL = vec3(0.025, 0.045, 0.12);
  const float PI = 3.1415927;

  float noiseTexture(vec2 uv) {
    float n = texture2D(iChannel0, uv).r;
    return 1.0 - abs(2.0 * n - 1.0);
  }

  float turbulentNoise(vec2 uv) {
    float angle = -SPEED * iTime;
    float cosine = cos(angle);
    float sine = sin(angle);
    mat2 rotation = mat2(cosine, -sine, sine, cosine);
    float value = 0.0;
    float scale = 1.0;

    for (int octave = 0; octave < 7; octave++) {
      uv = rotation * uv;
      value += (1.0 / scale) * pow(noiseTexture(uv * scale), RETICULATION);
      scale *= 2.0;
    }

    return value / 2.0;
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    float screenScale = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / screenScale;

    float rho = length(uv);
    float angle = atan(uv.y, uv.x);
    float shear = 2.0 * log(max(rho, 0.0001));
    float cosine = cos(shear);
    float sine = sin(shear);
    mat2 spiralRotation = mat2(cosine, -sine, sine, cosine);

    float radius = rho / GALAXY_R;
    float density = exp(-radius * radius);
    radius = rho / BULB_R;
    float bulb = exp(-radius * radius);
    radius = rho / BULB_BLACK_R;
    float blackBulb = exp(-radius * radius);

    float phase = NB_ARMS * (angle - shear);
    angle = angle - COMPR * cos(phase) + SPEED * iTime;
    uv = rho * vec2(cos(angle), sin(angle));
    float spires = 1.0 + NB_ARMS * COMPR * sin(phase);
    density *= 0.7 * spires;

    float gas = turbulentNoise(0.09 * 1.2 * spiralRotation * uv);
    float gasTransparency = pow(1.0 - gas * density, 2.0);

    float textureRatio = 0.8 * iResolution.y / iChannelResolution[0].y;
    float starsTexture = texture2D(iChannel1, textureRatio * uv + 0.5).r;
    float noiseStars = texture2D(iChannel0, textureRatio * uv + 0.5).r;
    float stars = pow(1.0 - (1.0 - starsTexture) * (1.0 - noiseStars), 5.0);

    vec3 galaxyColor = mix(GALAXY_COL, uStarColor * 10.0, 0.72);
    vec3 bulbColor = mix(BULB_COL, uStarColor, 0.45);
    vec3 color = mix(
      SKY_COL,
      gasTransparency * (1.7 * galaxyColor) + 1.2 * stars,
      density
    );
    color = mix(color, 2.0 * bulbColor, 1.2 * bulb);
    color = mix(color, vec3(0.0), 2.0 * blackBulb);

    gl_FragColor = vec4(color, 1.0);
  }
`

function createTexture(data: Uint8Array, size: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function createNoiseTexture() {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  let seed = 0x6d2b79f5

  for (let index = 0; index < TEXTURE_SIZE * TEXTURE_SIZE; index++) {
    seed = (Math.imul(seed ^ (seed >>> 15), seed | 1) + 0x6d2b79f5) | 0
    let value = seed
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    const noise = ((value ^ (value >>> 14)) >>> 0) & 0xff
    const offset = index * 4
    data[offset] = noise
    data[offset + 1] = noise
    data[offset + 2] = noise
    data[offset + 3] = 255
  }

  return createTexture(data, TEXTURE_SIZE)
}

function createStarTexture() {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  let seed = 0x1234abcd

  for (let index = 0; index < TEXTURE_SIZE * TEXTURE_SIZE; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const chance = seed / 0x100000000
    const brightness = chance > 0.992 ? 150 + (seed & 0x6f) : 0
    const offset = index * 4
    data[offset] = brightness
    data[offset + 1] = brightness
    data[offset + 2] = brightness
    data[offset + 3] = 255
  }

  return createTexture(data, TEXTURE_SIZE)
}

export class GalaxyBlackHolePageEffect {
  private readonly camera: THREE.PerspectiveCamera
  private readonly host: HTMLElement
  private readonly reducedMotion: boolean
  private readonly plane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private readonly material: THREE.ShaderMaterial
  private readonly geometry: THREE.PlaneGeometry
  private readonly textures: THREE.DataTexture[]
  private readonly cameraPosition = new THREE.Vector3()
  private readonly cameraDirection = new THREE.Vector3()
  private readonly cameraQuaternion = new THREE.Quaternion()
  private previousWidth = 0
  private previousHeight = 0

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    host: HTMLElement,
    reducedMotion: boolean,
  ) {
    this.camera = camera
    this.host = host
    this.reducedMotion = reducedMotion
    const noiseTexture = createNoiseTexture()
    const starTexture = createStarTexture()
    this.textures = [noiseTexture, starTexture]
    this.geometry = new THREE.PlaneGeometry(2, 2)
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector3(1, 1, 1) },
        iTime: { value: 0 },
        uStarColor: { value: new THREE.Color('#ffd27d') },
        iChannel0: { value: noiseTexture },
        iChannel1: { value: starTexture },
        iChannelResolution: {
          value: [
            new THREE.Vector3(TEXTURE_SIZE, TEXTURE_SIZE, 1),
            new THREE.Vector3(TEXTURE_SIZE, TEXTURE_SIZE, 1),
          ],
        },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    this.plane = new THREE.Mesh(this.geometry, this.material)
    this.plane.frustumCulled = false
    this.plane.renderOrder = 1
    scene.add(this.plane)
    this.resize()
  }

  update(time: number) {
    this.material.uniforms['iTime']!.value = this.reducedMotion ? 0 : time * 0.001
    this.resize()

    this.camera.getWorldPosition(this.cameraPosition)
    this.camera.getWorldDirection(this.cameraDirection)
    this.plane.position
      .copy(this.cameraPosition)
      .addScaledVector(this.cameraDirection, PAGE_DISTANCE)
    this.camera.getWorldQuaternion(this.cameraQuaternion)
    this.plane.quaternion.copy(this.cameraQuaternion)
    if (this.previousHeight > 0) {
      const height = 2 * PAGE_DISTANCE * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
      this.plane.scale.set((height * this.camera.aspect) / 2, height / 2, 1)
    }
  }

  setEnabled(enabled: boolean) {
    this.plane.visible = enabled
  }

  setStarColor(color: string | undefined) {
    if (!color || !/^#[\da-f]{6}$/i.test(color)) return
    const starColor = this.material.uniforms['uStarColor']!.value as THREE.Color
    starColor.set(color)
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.plane)
    this.geometry.dispose()
    this.material.dispose()
    this.textures.forEach((texture) => texture.dispose())
  }

  private resize() {
    const width = this.host.clientWidth
    const height = this.host.clientHeight
    if (
      width <= 0 ||
      height <= 0 ||
      (width === this.previousWidth && height === this.previousHeight)
    )
      return
    this.previousWidth = width
    this.previousHeight = height
    const resolution = this.material.uniforms['iResolution']!.value as THREE.Vector3
    resolution.set(width, height, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    const planeHeight = 2 * PAGE_DISTANCE * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    this.plane.scale.set((planeHeight * this.camera.aspect) / 2, planeHeight / 2, 1)
  }
}
