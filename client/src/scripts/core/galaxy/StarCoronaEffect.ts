import * as THREE from 'three'

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
  uniform float u_time;

  vec4 hash4(vec4 value) {
    return fract(sin(value) * 1399763.5453123);
  }

  float noise4q(vec4 point) {
    vec4 offsets = vec4(0.0, 0.25, 0.5, 0.75);
    vec4 wCell = floor(point.wwww + offsets);
    vec4 base = floor(point.xxxx + offsets)
      + floor(point.yyyy + offsets) * 157.0
      + floor(point.zzzz + offsets) * 113.0;
    vec4 p1 = base + fract(wCell * 0.00390625) * vec4(164352.0, -164352.0, 163840.0, -163840.0);
    vec4 p2 = base + fract((wCell + 1.0) * 0.00390625) * vec4(164352.0, -164352.0, 163840.0, -163840.0);
    vec4 blendX = fract(point.xxxx + offsets);
    vec4 blendY = fract(point.yyyy + offsets);
    blendX = blendX * blendX * (3.0 - 2.0 * blendX);
    blendY = blendY * blendY * (3.0 - 2.0 * blendY);
    vec4 n1 = vec4(0.0, 1.0, 157.0, 158.0);
    vec4 n2 = vec4(113.0, 114.0, 270.0, 271.0);
    vec4 lowerA = mix(hash4(p1), hash4(n1.yyyy + p1), blendX);
    vec4 lowerB = mix(hash4(n1.zzzz + p1), hash4(n1.wwww + p1), blendX);
    vec4 upperA = mix(hash4(p2), hash4(n1.yyyy + p2), blendX);
    vec4 upperB = mix(hash4(n1.zzzz + p2), hash4(n1.wwww + p2), blendX);
    lowerA = mix(lowerA, lowerB, blendY);
    upperA = mix(upperA, upperB, blendY);
    lowerB = mix(hash4(n2.xxxx + p1), hash4(n2.yyyy + p1), blendX);
    upperB = mix(hash4(n2.zzzz + p1), hash4(n2.wwww + p1), blendX);
    lowerB = mix(lowerB, upperB, blendY);
    upperB = mix(hash4(n2.xxxx + p2), hash4(n2.yyyy + p2), blendX);
    vec4 upperC = mix(hash4(n2.zzzz + p2), hash4(n2.wwww + p2), blendX);
    upperB = mix(upperB, upperC, blendY);
    blendX = fract(point.zzzz + offsets);
    blendY = fract(point.wwww + offsets);
    blendX = blendX * blendX * (3.0 - 2.0 * blendX);
    blendY = blendY * blendY * (3.0 - 2.0 * blendY);
    lowerA = mix(lowerA, lowerB, blendX);
    upperA = mix(upperA, upperB, blendX);
    lowerA = mix(lowerA, upperA, blendY);
    float value = dot(lowerA, vec4(0.25));
    return value * value * (3.0 - 2.0 * value);
  }

  float noiseSphere(vec3 ray, vec3 position, float radius, mat3 rotation, float zoom, vec3 offset, float anim) {
    float projection = dot(ray, position);
    float distanceSquared = dot(position, position) - projection * projection;
    float sum = 0.0;
    float stepSize = 0.03125;
    float scale = zoom / (stepSize * stepSize);
    float amplitude = 5.0;
    for (int index = 0; index < 3; index++) {
      float radiusSquared = radius * radius;
      if (distanceSquared < radiusSquared) {
        float depth = sqrt(radiusSquared - distanceSquared);
        vec3 surfacePoint = (ray * (projection - depth) - position) * rotation;
        sum += abs(noise4q(vec4(surfacePoint * scale + offset * amplitude, anim * amplitude)) * stepSize);
      }
      amplitude -= 2.0;
      stepSize *= 4.0;
      scale *= 0.0625;
      radius -= radius * 0.02;
    }
    return sum;
  }

  float ring(vec3 ray, vec3 position, float radius, float size) {
    float projection = dot(ray, position);
    float distanceSquared = dot(position, position) - projection * projection;
    return max(0.0, 1.0 - size * abs(radius - sqrt(distanceSquared)));
  }

  float ringRayNoise(vec3 ray, vec3 position, float radius, float size, mat3 rotation, float anim) {
    float projection = dot(ray, position);
    vec3 projected = ray * projection - position;
    float distanceToCenter = length(projected);
    projected = normalize(projected * rotation);
    float band = max(0.0, 1.0 - size * abs(radius - distanceToCenter));
    float detail = pow(noise4q(vec4(projected, -anim + distanceToCenter)) * 2.0, 2.0);
    float noise = 0.4;
    float secondary = 1.0;
    if (distanceToCenter > radius) {
      noise = noise4q(vec4(projected * 10.0, -anim + distanceToCenter));
      secondary = noise4q(vec4(projected * 50.0, -anim * 2.5 + distanceToCenter * 2.0)) * 2.0;
    }
    noise = noise * noise * detail * secondary;
    return pow(band, 4.0) + band * band * noise;
  }

  vec4 noiseSpace(vec3 ray, vec3 position, float radius, mat3 rotation, float zoom, vec3 offset) {
    float projection = dot(ray, position);
    float distanceSquared = dot(position, position) - projection * projection;
    float depth = sqrt(abs(radius * radius - distanceSquared));
    vec3 surfacePoint = (ray * (projection - depth) - position) * rotation * (zoom / 0.09375);
    float base = abs(noise4q(vec4(surfacePoint + offset, 0.0)) * 0.09375);
    base += abs(noise4q(vec4(surfacePoint * 0.5 + offset, 0.0)) * 0.1875);
    base += abs(noise4q(vec4(surfacePoint * 0.25 + offset, 0.0)) * 0.375);
    return vec4(
      base * 2.0,
      abs(noise4q(vec4(surfacePoint * 0.1 + offset, 0.0))),
      abs(noise4q(vec4(surfacePoint * 0.1 + offset * 6.0, 0.0))),
      abs(noise4q(vec4(surfacePoint * 0.1 + offset * 13.0, 0.0)))
    );
  }

  float sphereZero(vec3 ray, vec3 position, float radius) {
    float projection = dot(ray, position);
    float distanceSquared = dot(position, position) - projection * projection;
    return distanceSquared < radius * radius ? 0.0 : 1.0;
  }

  void main() {
    vec2 point = (vUv * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);
    float time = u_time;
    float rotationX = time * 0.025;
    float rotationY = -0.6;
    vec2 sine = sin(vec2(rotationX, rotationY));
    vec2 cosine = cos(vec2(rotationX, rotationY));
    mat3 rotation = mat3(
      vec3(cosine.x, 0.0, sine.x), vec3(0.0, 1.0, 0.0), vec3(-sine.x, 0.0, cosine.x)
    );
    rotation = mat3(
      vec3(1.0, 0.0, 0.0), vec3(0.0, cosine.y, sine.y), vec3(0.0, -sine.y, cosine.y)
    ) * rotation;
    vec3 ray = normalize(vec3(point, 2.0));
    vec3 position = vec3(0.0, 0.0, 3.0);
    float body = pow(min(1.0, noiseSphere(ray, position, 1.0, rotation, 0.5, vec3(0.0), time) * 2.4), 2.0);
    float detail = min(1.0, noiseSphere(ray, position, 1.0, rotation, 4.0, vec3(83.23, 34.34, 67.453), time) * 2.2);
    vec3 color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0), pow(body, 60.0)) * body;
    color += mix(mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 1.0), pow(detail, 2.0)), vec3(1.0), pow(detail, 10.0)) * detail;
    color -= vec3(ring(ray, position, 1.03, 11.0)) * 2.0;
    color = max(color, vec3(0.0));
    float rays = ringRayNoise(ray, position, 0.96, 1.0, rotation, time);
    color += mix(vec3(1.0, 0.6, 0.1), vec3(1.0, 0.95, 1.0), pow(rays, 3.0)) * rays;
    float outside = sphereZero(ray, position, 0.9);
    if (outside > 0.0) {
      vec4 space = noiseSpace(ray, position, 100.0, rotation, 0.05, vec3(1.0, 2.0, 4.0));
      space.x = pow(space.x, 3.0);
      color += mix(mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), space.y * 1.9), vec3(0.9, 1.0, 0.1), space.w * 0.75)
        * space.x * pow(space.z * 2.5, 3.0) * 0.2 * outside;
    }
    color = clamp(color, 0.0, 1.0);
    float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0);
    float radialFade = 1.0 - smoothstep(0.48, 1.06, length(point));
    alpha *= radialFade;
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
  private readonly timeLocation: WebGLUniformLocation
  private frame = 0
  private readonly startTime = performance.now()

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
    const timeLocation = gl.getUniformLocation(program, 'u_time')
    if (resolutionLocation === null || timeLocation === null) {
      throw new Error('Unable to locate shader uniforms')
    }
    this.resolutionLocation = resolutionLocation
    this.timeLocation = timeLocation
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
    this.gl.uniform1f(this.timeLocation, (performance.now() - this.startTime) * 0.001)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
  }
}
