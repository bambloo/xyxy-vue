import * as THREE from 'three'

const SYNODIC_MONTH_MS = 29.53058867 * 24 * 60 * 60 * 1000
const BASE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)

export function getMoonPhase(date = new Date()) {
  const elapsed = (date.getTime() - BASE_NEW_MOON + 24 * 60 * 60 * 1000 * 6) % SYNODIC_MONTH_MS
  return ((elapsed + SYNODIC_MONTH_MS) % SYNODIC_MONTH_MS) / SYNODIC_MONTH_MS
}

export function getMoonIllumination(phase: number) {
  return 1 - Math.abs(phase - 0.5) * 2
}

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
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_speed;
  uniform float u_opacity;
  uniform float u_premultiply;

  float snoise(vec3 uv, float resolution) {
    const vec3 scale = vec3(1.0, 1e2, 1e4);
    uv *= resolution;
    vec3 uv0 = floor(mod(uv, resolution)) * scale;
    vec3 uv1 = floor(mod(uv + vec3(1.0), resolution)) * scale;
    vec3 blend = fract(uv);
    blend = blend * blend * (3.0 - 2.0 * blend);
    vec4 corners = vec4(
      uv0.x + uv0.y + uv0.z,
      uv1.x + uv0.y + uv0.z,
      uv0.x + uv1.y + uv0.z,
      uv1.x + uv1.y + uv0.z
    );
    vec4 values = fract(sin(corners * 1e-3) * 1e5);
    float lower = mix(mix(values.x, values.y, blend.x), mix(values.z, values.w, blend.x), blend.y);
    values = fract(sin((corners + uv1.z - uv0.z) * 1e-3) * 1e5);
    float upper = mix(mix(values.x, values.y, blend.x), mix(values.z, values.w, blend.x), blend.y);
    return mix(lower, upper, blend.z) * 2.0 - 1.0;
  }

  void main() {
    float time = u_time * u_speed;
    float brightness = max(cos(time) * 0.25 + sin(time) * 0.25, 0.1);
    float radius = 0.24 + brightness * 0.2;
    vec3 orange = vec3(0.2, 0.65, 0.5);
    vec3 orangeRed = vec3(0.1, 0.25, 0.81);
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    float fade = pow(length(2.0 * p), 0.5);
    float value1 = 1.0 - fade;
    float value2 = value1;
    float angle = atan(p.x, p.y) / 6.2832;
    float distance = length(p);
    vec3 coordinate = vec3(angle, distance, time * 0.01);
    float newTime1 = abs(snoise(coordinate + vec3(0.0, -time * (0.35 + brightness * 0.001), time * 0.0015), 15.0));
    float newTime2 = abs(snoise(coordinate + vec3(0.0, -time * (0.15 + brightness * 0.001), time * 0.0015), 45.0));

    for (int i = 1; i <= 7; i++) {
      float octave = pow(2.0, float(i + 1));
      vec3 flow = coordinate + vec3(0.0, -time, time * 0.2);
      value1 += (0.5 / octave) * snoise(flow, octave * 10.0 * (newTime1 + 1.0));
      value2 += (0.5 / octave) * snoise(flow, octave * 25.0 * (newTime2 + 1.0));
    }

    float corona = pow(value1 * max(1.1 - fade, 0.0), 2.0) * 50.0;
    corona += pow(value2 * max(1.1 - fade, 0.0), 2.0) * 50.0;
    corona *= 1.2 - newTime1;

    vec2 spherePoint = (vUv - 0.5) * 2.0;
    spherePoint *= 2.0 - brightness;
    float sphereRadiusSquared = dot(spherePoint, spherePoint);
    float projection = sphereRadiusSquared > 1e-4
      ? (1.0 - sqrt(abs(1.0 - sphereRadiusSquared))) / sphereRadiusSquared + brightness * 0.5
      : 0.5 + brightness * 0.5;
    vec3 starSphere = vec3(0.0);

    if (distance < radius) {
      corona *= pow(distance / radius, 24.0);
      vec2 sphereUv = spherePoint * projection + vec2(time, 0.0);
      vec2 surfacePoint = spherePoint / max(2.0 - brightness, 0.001);
      float surfaceDepth = sqrt(max(1.0 - dot(surfacePoint, surfacePoint), 0.0));
      vec3 surface = vec3(surfacePoint, surfaceDepth);
      float baseNoise = snoise(surface + vec3(time * 0.03, 0.0, 0.0), 8.0);
      float detailNoise = snoise(surface * 2.7 + vec3(-time * 0.05, 0.0, 0.0), 19.0);
      float textureOffset = (baseNoise * 0.5 + 0.5) * brightness * 3.14 + time;
      float bands = snoise(vec3(sphereUv + vec2(textureOffset, 0.0), surfaceDepth * 2.0), 12.0);
      float filaments = snoise(surface * 5.0 + vec3(textureOffset, 0.0, 0.0), 24.0);
      starSphere = mix(orangeRed, orange, smoothstep(-0.35, 0.45, bands));
      starSphere *= 0.42 + 0.3 * (baseNoise * 0.5 + 0.5) + 0.18 * max(detailNoise, 0.0);
      starSphere += orange * max(filaments, 0.0) * 0.18;
    }

    float starGlow = clamp(1.0 - distance * (1.0 - brightness), 0.0, 1.0);
    vec3 color = vec3(projection * (0.75 + brightness * 0.3)) * orange
      + starSphere + corona * orange + starGlow * orangeRed;
    float bodyAlpha = 1.0 - smoothstep(radius * 0.96, radius * 1.04, distance);
    float haloAlpha = 1.0 - smoothstep(radius * 1.15, 0.42, distance);
    float alpha = max(bodyAlpha, max(haloAlpha * starGlow * 0.65, haloAlpha * clamp(corona * 0.08, 0.0, 1.0))) * u_opacity;
    vec3 outputColor = clamp(color, 0.0, 1.0) * u_opacity;
    outputColor *= mix(1.0, alpha, u_premultiply);
    gl_FragColor = vec4(outputColor, alpha);
  }
`

const sunButtonFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 u_resolution;
  uniform float u_moon_phase;

  void main() {
    vec2 pos = (vUv - 0.5) * u_resolution;
    float radius = u_resolution.y / 3.0;
    float radiusSquared = dot(pos, pos);
    float zIn = sqrt(max(radius * radius - radiusSquared, 0.0));
    float zOut = sqrt(max(-radius * radius + radiusSquared, 0.0));

    vec3 normal = normalize(vec3(pos, zIn));
    vec3 normalOut = normalize(vec3(pos, zOut) + vec3(0.0, 0.0, 0.0001));
    float insideSphere = 1.0 - smoothstep(radius - 1.0, radius + 1.0, length(pos));
    float outsideSphere = 1.0 - insideSphere;
    float innerAtmosphere = max(0.0, (radius * 0.2) / max(zIn, 0.001) - 0.2) * insideSphere;
    float outerAtmosphere = max(0.0, (radius * 0.2) / max(zOut, 0.001) - 0.4) * outsideSphere;
    float phaseAngle = u_moon_phase * 6.28318530718;
    vec3 lightDirection = normalize(vec3(sin(phaseAngle), 0.0, -cos(phaseAngle)));
    float diffuse = max(0.0, dot(normal, lightDirection));
    float diffuseOut = max(0.0, dot(normalOut, lightDirection) + 0.1);

    float illumination = 0.5 - 0.5 * cos(phaseAngle);
    float earthshine = (1.0 - diffuse) * mix(0.015, 0.12, 1.0 - illumination);
    float luminance = earthshine + diffuse * 1.0
      + innerAtmosphere * diffuse + outerAtmosphere * diffuseOut;
    vec3 moonColor = vec3(1.0, 0.78, 0.28) ;
    vec3 color = moonColor * clamp(luminance, 0.15, 0.8);
    float atmosphereAlpha = clamp(
      innerAtmosphere * diffuse + outerAtmosphere * diffuseOut,
      0.0,
      1.0
    );
    float halo = exp(-max(length(pos) - radius, 0.0) * 0.08) * illumination * 0.3;
    float alpha = max(insideSphere, max(atmosphereAlpha, halo) * outsideSphere);
    color += vec3(1.0, 0.78, 0.28) * halo;
    gl_FragColor = vec4(color * alpha, alpha);
  }
`

export class StarCoronaEffect extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor(size = 1) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_time: { value: 0 },
        u_speed: { value: 0.6 },
        u_opacity: { value: 1 },
        u_premultiply: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    super(new THREE.PlaneGeometry(size, size), material)
    this.renderOrder = 20
  }

  update(time: number, opacity = 1) {
    this.material.uniforms.u_time!.value = time
    this.material.uniforms.u_opacity!.value = opacity
  }
}

export class StarCoronaCanvasEffect {
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly resolutionLocation: WebGLUniformLocation
  private readonly moonPhaseLocation: WebGLUniformLocation
  private frame = 0

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
    if (!gl) throw new Error('WebGL is unavailable')
    this.gl = gl
    const canvasVertexShader = `
      attribute vec2 pos;
      varying vec2 vUv;
      void main() {
        vUv = pos * 0.5 + 0.5;
        gl_Position = vec4(pos, 0.0, 1.0);
      }
    `
    const compiledVertex = this.compileShader(gl.VERTEX_SHADER, canvasVertexShader)
    const compiledFragment = this.compileShader(gl.FRAGMENT_SHADER, sunButtonFragmentShader)
    const program = gl.createProgram()
    if (!program) throw new Error('Unable to create WebGL program')
    gl.attachShader(program, compiledVertex)
    gl.attachShader(program, compiledFragment)
    gl.bindAttribLocation(program, 0, 'pos')
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'Unable to link shader program')
    }
    this.program = program

    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
    const moonPhaseLocation = gl.getUniformLocation(program, 'u_moon_phase')
    if (resolutionLocation === null) throw new Error('Unable to locate shader uniform u_resolution')
    if (moonPhaseLocation === null) throw new Error('Unable to locate shader uniform u_moon_phase')
    this.resolutionLocation = resolutionLocation
    this.moonPhaseLocation = moonPhaseLocation
    canvas.width = 220 * Math.min(window.devicePixelRatio || 1, 2)
    canvas.height = canvas.width
    gl.viewport(0, 0, canvas.width, canvas.height)

    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('Unable to create WebGL buffer')
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.useProgram(program)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    this.render()
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.frame = requestAnimationFrame(this.animate)
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.gl.deleteProgram(this.program)
  }

  private compileShader(type: number, source: string) {
    const shader = this.gl.createShader(type)
    if (!shader) throw new Error('Unable to create WebGL shader')
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const message = this.gl.getShaderInfoLog(shader) ?? 'Unable to compile WebGL shader'
      this.gl.deleteShader(shader)
      throw new Error(message)
    }
    return shader
  }

  private readonly animate = () => {
    this.render()
    this.frame = requestAnimationFrame(this.animate)
  }

  private render() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.useProgram(this.program)
    this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height)
    const phase = getMoonPhase()
    this.gl.uniform1f(this.moonPhaseLocation, phase)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
  }
}
