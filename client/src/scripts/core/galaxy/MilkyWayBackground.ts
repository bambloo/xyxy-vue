export class MilkyWayBackground {
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly resolutionLocation: WebGLUniformLocation
  private readonly timeLocation: WebGLUniformLocation
  private readonly resizeObserver: ResizeObserver
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private frame = 0
  private lastFrameTime = 0
  private readonly startTime = performance.now()

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    })
    if (!gl) throw new Error('WebGL is unavailable')
    this.gl = gl

    const vertexSource = `
      attribute vec2 pos;
      void main() {
        gl_Position = vec4(pos, 0.0, 1.0);
      }
    `
    const fragmentSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      float random2(vec2 point) {
        return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise2D(vec2 point) {
        vec2 cell = floor(point);
        vec2 blend = fract(point);
        blend = blend * blend * (3.0 - 2.0 * blend);
        float lower = mix(random2(cell), random2(cell + vec2(1.0, 0.0)), blend.x);
        float upper = mix(random2(cell + vec2(0.0, 1.0)), random2(cell + vec2(1.0, 1.0)), blend.x);
        return mix(lower, upper, blend.y);
      }

      float computeFBM(vec2 point) {
        float amplitude = 0.75;
        float sum = 0.0;
        float maxAmplitude = 0.0;
        for (int octave = 0; octave < 6; octave++) {
          sum += noise2D(point) * amplitude;
          maxAmplitude += amplitude;
          amplitude *= 0.5;
          point *= 2.2;
        }
        return sum / maxAmplitude;
      }

      float computeFBMStars(vec2 point) {
        float amplitude = 0.75;
        float sum = 0.0;
        float maxAmplitude = 0.0;
        for (int octave = 0; octave < 5; octave++) {
          sum += noise2D(point) * amplitude;
          maxAmplitude += amplitude;
          amplitude *= 0.5;
          point *= 2.0;
        }
        return sum / maxAmplitude * 1.15;
      }

      vec3 backgroundColor(vec2 uv) {
        float noise1 = computeFBMStars(uv * 5.0);
        float noise2 = computeFBMStars(uv * vec2(15.125, 25.7));
        float noise3 = computeFBMStars((uv + vec2(0.5, 0.1)) * 4.0 + u_time * 0.35);
        float starShape = noise1 * noise2 * noise3;
        starShape = clamp(starShape - 0.6 + 0.2, 0.0, 1.0);
        starShape = pow(starShape, 1.25);
        float weight = starShape / 0.4;
        return weight * vec3(noise1 * 0.55, noise2 * 0.4, noise3) * 6.0;
      }

      float palette(float a, float b, float c, float d, float x) {
        return a + b * cos(6.28318 * (c * x + d));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 screenPoint = uv * 2.0 - 1.0;
        float galaxyOffset = (cos(screenPoint.x * 5.0) * sin(screenPoint.x * 2.0) * 0.5 + 0.5) * 0.0;
        float theta = length(screenPoint) * 0.25;
        float cosine = cos(theta);
        float sine = sin(theta);
        vec2 rotatedPoint = vec2(
          cosine * screenPoint.x - sine * screenPoint.y,
          sine * screenPoint.x + cosine * screenPoint.y
        );

        float noiseValue = computeFBM(rotatedPoint * 5.0 + 50.0 + u_time * 0.0234375);
        rotatedPoint += vec2(noiseValue) * 0.3;
        float centralFalloff = clamp(1.0 - abs(screenPoint.y + galaxyOffset), 0.0, 1.0);
        float xFalloff = cos(screenPoint.x * 2.0) * 0.5 + 0.5;
        float rotatedFalloff = max(1.0 - abs(rotatedPoint.y + galaxyOffset), 0.0);
        float rotatedXFalloff = cos(rotatedPoint.x * 2.0) * 0.5 + 0.5;
        float lowFrequencyNoise = computeFBM(rotatedPoint * 4.0 - u_time * 0.0234375);
        float galaxyShape = clamp(pow(rotatedFalloff, 3.0) - lowFrequencyNoise * 0.5, 0.0, 1.0) * rotatedXFalloff;

        vec3 galaxyColor;
        galaxyColor.r = palette(0.5, -1.08159265, 0.79840735, 0.0, galaxyShape);
        galaxyColor.g = palette(0.5, 0.65840735, 0.90840735, 0.26840735, galaxyShape);
        galaxyColor.b = palette(0.5, -0.20159265, 0.31840735, -0.00159265, galaxyShape);
        float removeColor = (pow(galaxyShape, 10.0) + lowFrequencyNoise * 0.1) * 5.0;
        galaxyColor -= vec3(removeColor);

        vec3 background = backgroundColor(gl_FragCoord.xy * 0.125)
          * pow(centralFalloff, 0.5) * pow(xFalloff, 0.5);
        background += vec3(0.2, 0.2, 0.4) * (5.0 - galaxyShape)
          * pow(rotatedFalloff, 2.0) * lowFrequencyNoise * pow(xFalloff, 0.75);
        background += vec3(0.5, 1.0, 0.85) * 0.95
          * pow(centralFalloff, 1.5) * lowFrequencyNoise * pow(xFalloff, 2.0);

        vec3 color = mix(background, galaxyColor, galaxyShape);
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
    `

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()
    if (!program) throw new Error('Unable to create WebGL program')
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
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

    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('Unable to create WebGL buffer')
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.useProgram(program)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.disable(gl.DEPTH_TEST)

    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(canvas)
    this.resize()
    this.render()
    if (!this.reducedMotion) this.frame = requestAnimationFrame(this.animate)
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
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

  private readonly resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1) * 0.8
    const width = Math.max(1, Math.round(this.canvas.clientWidth * pixelRatio))
    const height = Math.max(1, Math.round(this.canvas.clientHeight * pixelRatio))
    if (this.canvas.width === width && this.canvas.height === height) return
    this.canvas.width = width
    this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
    this.render()
  }

  private readonly animate = (timestamp: number) => {
    if (timestamp - this.lastFrameTime >= 33) {
      this.lastFrameTime = timestamp
      this.render()
    }
    this.frame = requestAnimationFrame(this.animate)
  }

  private render() {
    const { gl } = this
    gl.useProgram(this.program)
    gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.timeLocation, (performance.now() - this.startTime) * 0.001)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
