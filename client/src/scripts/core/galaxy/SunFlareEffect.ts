export class SunFlareEffect {
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly resolutionLocation: WebGLUniformLocation
  private readonly timeLocation: WebGLUniformLocation
  private readonly speedLocation: WebGLUniformLocation
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private frame = 0
  private readonly startTime = performance.now()

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
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

      uniform vec2 u_res;
      uniform float u_time;
      uniform float u_speed;

      void main() {
        vec2 FC = gl_FragCoord.xy;
        float t = u_time * u_speed;
        vec2 r = u_res;
        vec2 p = (FC * 2.0 - r) / r.y;
        vec3 c = vec3(0.0);
                  float a = i / 1.5 + t * 0.5;
          vec2 q = p;
          q.x = q.x + sin(q.y * 19.0 + t * 2.0 + i)
            * 29.0 * (1.0 - smoothstep(-2.0, 0.0, q.y));

          float d = length(q - vec2(cos(a), sin(a))
            * (0.4 * smoothstep(0.0, 0.5, -q.y)));

        for (float i = 0.0; i < 42.0; i++) {

          c += vec3(0.34, 0.30, 0.24) * (0.015 / d);
        }

        vec3 col = c * c + 0.05;
        float edgeFade = 1.0 - smoothstep(0.62, 0.88, length(p));
        float alpha = clamp(max(max(col.r, col.g), col.b) - 0.05, 0.0, 1.0) * edgeFade;
        gl_FragColor = vec4(col * alpha, alpha);
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
      throw new Error(gl.getProgramInfoLog(program) ?? 'Unable to link WebGL program')
    }
    this.program = program

    const resolutionLocation = gl.getUniformLocation(program, 'u_res')
    const timeLocation = gl.getUniformLocation(program, 'u_time')
    const speedLocation = gl.getUniformLocation(program, 'u_speed')
    if (!resolutionLocation || !timeLocation || !speedLocation) {
      throw new Error('Unable to locate shader uniforms')
    }
    this.resolutionLocation = resolutionLocation
    this.timeLocation = timeLocation
    this.speedLocation = speedLocation

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = 220 * pixelRatio
    canvas.height = 220 * pixelRatio
    gl.viewport(0, 0, canvas.width, canvas.height)

    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('Unable to create WebGL buffer')
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.useProgram(program)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.clearColor(0, 0, 0, 0)
    this.render()
    if (!this.reducedMotion) this.frame = requestAnimationFrame(this.animate)
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
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
    const { gl } = this
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.timeLocation, (performance.now() - this.startTime) * 0.001)
    gl.uniform1f(this.speedLocation, 1.0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
