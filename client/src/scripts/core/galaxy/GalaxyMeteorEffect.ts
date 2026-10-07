import * as THREE from 'three'

type ActiveMeteor = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  destination: DestinationStar
  end: THREE.Vector3
  rotations: number
  startTime: number
  duration: number
}

type DestinationStar = {
  group: THREE.Group
  orb: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  ring: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  screenX: number
  screenY: number
  selected: boolean
  revealsPortal: boolean
}

const DESTINATION_STAR_PIXELS = 500
const RIPPLE_REFERENCE_PIXELS = 144

const meteorVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const meteorFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_opacity;

  void main() {
    float center = abs(vUv.y * 2.0 - 1.0);
    float alongFade = pow(clamp(vUv.x, 0.0, 1.0), 1.35);
    float haze = exp(-center * 3.0) * alongFade * 0.48;
    float core = exp(-center * 16.0) * alongFade * 0.72;
    float head = exp(-center * 7.0) * pow(vUv.x, 16.0);
    float alpha = (haze + core + head) * u_opacity;
    vec3 color = mix(vec3(0.72, 0.82, 0.94), vec3(1.0), pow(vUv.x, 12.0));
    gl_FragColor = vec4(color, alpha);
  }
`

const destinationVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const destinationFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_rippleScale;
  void main() {
    vec2 point = (vUv - 0.5) * 2.0;
    float radius = length(point);
    float halo = exp(-radius * 4.2) * 0.46;
    float core = exp(-radius * 34.0) * 1.35;
    float rayAngle = atan(point.y, point.x);
    float rayPhase = rayAngle * 4.0 + u_time * 0.35 + sin(u_time * 1.7) * 0.12;
    float taper = smoothstep(0.08, 0.95, radius);
    float primaryRays = pow(abs(cos(rayPhase)), mix(5.0, 46.0, taper));
    float secondaryRays = pow(abs(cos(rayAngle * 7.0 - u_time * 0.22)), mix(7.0, 42.0, taper)) * 0.35;
    float rayPulse = 0.35 + 0.65 * (0.5 + 0.5 * sin(u_time * 4.5 + rayAngle * 4.0));
    float starbursts = (primaryRays + secondaryRays) * exp(-radius * 12.0) * rayPulse * 0.56;
    float phase = fract(u_time * 0.42);
    float secondPhase = fract(u_time * 0.42 + 0.5);
    float rippleRadius = (0.08 + phase * 1.18) * u_rippleScale;
    float secondRippleRadius = (0.08 + secondPhase * 1.18) * u_rippleScale;
    float ripple = exp(-pow((radius - rippleRadius) / u_rippleScale * 32.0, 2.0))
      * (1.0 - phase) * 0.8;
    float secondRipple = exp(-pow((radius - secondRippleRadius) / u_rippleScale * 32.0, 2.0))
      * (1.0 - secondPhase) * 0.52;
    float flicker = 0.82 + 0.18 * (0.5 + 0.5 * sin(u_time * 8.0 + sin(u_time * 2.7)));
    float alpha = clamp((halo + core + starbursts + ripple + secondRipple) * flicker, 0.0, 1.0);
    vec3 color = mix(vec3(0.72, 0.86, 1.0), vec3(1.0), clamp(core + starbursts, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
  }
`

const selectionRingFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_time;
  void main() {
    vec2 point = (vUv - 0.5) * 2.0;
    float radius = length(point);
    float angle = atan(point.y, point.x) + u_time * 0.12;
    float dash = smoothstep(0.08, 0.2, sin(angle * 8.0));
    float ring = exp(-abs(radius - 0.73) * 48.0) * dash;
    float halo = exp(-abs(radius - 0.73) * 13.0) * dash * 0.18;
    float alpha = clamp(ring * 0.78 + halo, 0.0, 1.0);
    gl_FragColor = vec4(vec3(0.68, 0.84, 1.0), alpha);
  }
`

export class GalaxyMeteorEffect {
  private readonly activeMeteors: ActiveMeteor[] = []
  private readonly destinations: DestinationStar[] = []
  private readonly orbitAxis = new THREE.Vector3()
  private readonly starGeometry = new THREE.PlaneGeometry(1, 1)
  private readonly ringGeometry = new THREE.PlaneGeometry(1, 1)
  private readonly starMaterial: THREE.ShaderMaterial
  private readonly ringMaterial: THREE.ShaderMaterial

  private pointerStart?: THREE.Vector2

  constructor(
    private readonly host: HTMLElement,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly reducedMotion: boolean,
  ) {
    this.starMaterial = new THREE.ShaderMaterial({
      vertexShader: destinationVertexShader,
      fragmentShader: destinationFragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_rippleScale: { value: RIPPLE_REFERENCE_PIXELS / DESTINATION_STAR_PIXELS },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    this.ringMaterial = new THREE.ShaderMaterial({
      vertexShader: destinationVertexShader,
      fragmentShader: selectionRingFragmentShader,
      uniforms: { u_time: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    this.camera.getWorldDirection(this.orbitAxis)
    const homeSunBottom = THREE.MathUtils.clamp(this.host.clientHeight * 0.13, 112, 168)
    const homeSunCenterY = this.host.clientHeight - homeSunBottom - 46.2
    const homeSunNdcY = 1 - (2 * homeSunCenterY) / Math.max(1, this.host.clientHeight)
    const targets = [
      { x: -0.86, y: 0.78, rotations: 0.34, delay: 0, duration: 3900, revealsPortal: false },
      { x: 0.86, y: 0.0, rotations: -0.38, delay: 520, duration: 4200, revealsPortal: false },
      { x: 0.0, y: homeSunNdcY, rotations: 0.42, delay: 1040, duration: 4500, revealsPortal: true },
    ]
    const now = performance.now()
    targets.forEach((target) => {
      const endpoint = this.destinationFromScreen(target.x, target.y)
      const destination = this.createDestination(endpoint, target.x, target.y, target.revealsPortal)
      this.destinations.push(destination)
      destination.group.visible = this.reducedMotion && !target.revealsPortal
      if (!this.reducedMotion) {
        this.spawnMeteor(
          destination,
          endpoint,
          target.rotations,
          now + target.delay,
          target.duration,
        )
      }
    })
  }

  pointerDown(event: PointerEvent) {
    this.pointerStart = new THREE.Vector2(event.clientX, event.clientY)
  }

  pointerUp(event: PointerEvent) {
    const start = this.pointerStart
    this.pointerStart = undefined
    if (!start || start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 6)
      return false

    const bounds = this.cameraBounds()
    for (const destination of this.destinations) {
      if (!destination.group.visible) continue
      const projected = destination.group.position.clone().project(this.camera)
      const screenX = bounds.left + (projected.x + 1) * 0.5 * bounds.width
      const screenY = bounds.top + (1 - projected.y) * 0.5 * bounds.height
      if (Math.hypot(event.clientX - screenX, event.clientY - screenY) > 30) continue
      destination.selected = !destination.selected
      destination.ring.visible = destination.selected
      return true
    }
    return false
  }

  update(nowMs: number) {
    this.camera.updateMatrixWorld(true)
    this.destinations.forEach((destination, index) => {
      destination.group.position.copy(
        this.destinationFromScreen(destination.screenX, destination.screenY),
      )
      destination.group.quaternion.copy(this.camera.quaternion)
      const cameraPosition = this.camera.worldToLocal(destination.group.position.clone())
      const depth = Math.max(this.camera.near, -cameraPosition.z)
      const viewHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
      const worldUnitsPerPixel = viewHeight / Math.max(1, this.host.clientHeight)
      const starSize = worldUnitsPerPixel * DESTINATION_STAR_PIXELS
      destination.orb.scale.set(starSize, starSize, 1)
      destination.ring.scale.set(worldUnitsPerPixel * 132, worldUnitsPerPixel * 132, 1)
      destination.orb.material.uniforms.u_time!.value = nowMs * 0.001 + index * 1.7
      destination.ring.material.uniforms.u_time!.value = nowMs * 0.001
    })
    for (let index = this.activeMeteors.length - 1; index >= 0; index--) {
      const meteor = this.activeMeteors[index]!
      if (nowMs < meteor.startTime) continue
      meteor.end.copy(
        this.destinationFromScreen(meteor.destination.screenX, meteor.destination.screenY),
      )
      const progress = (nowMs - meteor.startTime) / meteor.duration
      if (progress >= 1) {
        this.scene.remove(meteor.mesh)
        meteor.mesh.geometry.dispose()
        meteor.mesh.material.dispose()
        meteor.destination.group.visible = !meteor.destination.revealsPortal
        meteor.destination.group.quaternion.copy(this.camera.quaternion)
        this.activeMeteors.splice(index, 1)
        continue
      }

      const headProgress = THREE.MathUtils.smoothstep(progress, 0, 1)
      this.updateTrail(meteor, headProgress)
      meteor.mesh.material.uniforms.u_opacity!.value = Math.pow(Math.sin(progress * Math.PI), 0.8)
    }
  }

  destroy() {
    this.activeMeteors.forEach((meteor) => {
      this.scene.remove(meteor.mesh)
      meteor.mesh.geometry.dispose()
      meteor.mesh.material.dispose()
    })
    this.activeMeteors.length = 0
    this.destinations.forEach((destination) => this.scene.remove(destination.group))
    this.destinations.length = 0
    this.starGeometry.dispose()
    this.ringGeometry.dispose()
    this.starMaterial.dispose()
    this.ringMaterial.dispose()
  }

  private createDestination(
    position: THREE.Vector3,
    screenX: number,
    screenY: number,
    revealsPortal: boolean,
  ): DestinationStar {
    const group = new THREE.Group()
    group.position.copy(position)
    group.quaternion.copy(this.camera.quaternion)
    const orb = new THREE.Mesh(this.starGeometry, this.starMaterial)
    orb.visible = !revealsPortal
    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial)
    ring.visible = false
    ring.renderOrder = 21
    group.add(orb, ring)
    this.scene.add(group)
    return { group, orb, ring, screenX, screenY, selected: false, revealsPortal }
  }

  private spawnMeteor(
    destination: DestinationStar,
    end: THREE.Vector3,
    rotations: number,
    startTime: number,
    duration: number,
  ) {
    const segments = 40
    const positions = new Float32Array((segments + 1) * 2 * 3)
    const uvs = new Float32Array((segments + 1) * 2 * 2)
    const indices: number[] = []
    for (let segment = 0; segment <= segments; segment++) {
      const along = segment / segments
      const vertex = segment * 2
      uvs.set([along, 0, along, 1], vertex * 2)
      if (segment < segments) {
        indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    )
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    const material = new THREE.ShaderMaterial({
      vertexShader: meteorVertexShader,
      fragmentShader: meteorFragmentShader,
      uniforms: { u_opacity: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = 10
    this.scene.add(mesh)
    this.activeMeteors.push({
      mesh,
      destination,
      end,
      rotations,
      startTime,
      duration,
    })
  }

  private updateTrail(meteor: ActiveMeteor, progress: number) {
    const segments = 40
    const trailStart = Math.max(0, progress - 0.12)
    const positionAttribute = meteor.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const positions = positionAttribute.array as Float32Array
    for (let segment = 0; segment <= segments; segment++) {
      const along = segment / segments
      const pathProgress = THREE.MathUtils.lerp(trailStart, progress, along)
      const center = this.pathPosition(meteor.end, pathProgress, meteor.rotations)
      const tangentStep = 0.002
      const before = this.pathPosition(
        meteor.end,
        Math.max(0, pathProgress - tangentStep),
        meteor.rotations,
      )
      const after = this.pathPosition(
        meteor.end,
        Math.min(1, pathProgress + tangentStep),
        meteor.rotations,
      )
      const tangent = after.sub(before).normalize()
      const viewDirection = center.clone().sub(this.camera.position).normalize()
      const side = new THREE.Vector3().crossVectors(tangent, viewDirection).normalize()
      const viewHeight =
        2 *
        center.distanceTo(this.camera.position) *
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
      const halfWidth = viewHeight * 0.018 * (0.12 + along * 0.88)
      const offset = segment * 6
      positions[offset] = center.x + side.x * halfWidth
      positions[offset + 1] = center.y + side.y * halfWidth
      positions[offset + 2] = center.z + side.z * halfWidth
      positions[offset + 3] = center.x - side.x * halfWidth
      positions[offset + 4] = center.y - side.y * halfWidth
      positions[offset + 5] = center.z - side.z * halfWidth
    }
    positionAttribute.needsUpdate = true
    meteor.mesh.geometry.computeBoundingSphere()
  }

  private destinationFromScreen(x: number, y: number) {
    this.camera.updateMatrixWorld(true)
    const depth = 900
    const viewHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
    const viewWidth = viewHeight * this.camera.aspect
    const cameraPosition = new THREE.Vector3(x * viewWidth * 0.5, y * viewHeight * 0.5, -depth)
    return this.camera.localToWorld(cameraPosition)
  }

  private pathPosition(end: THREE.Vector3, progress: number, rotations: number) {
    return end
      .clone()
      .applyAxisAngle(this.orbitAxis, (1 - progress) * rotations * Math.PI * 2)
      .multiplyScalar(progress)
  }

  private cameraBounds() {
    const { left, top, width, height } = this.host.getBoundingClientRect()
    return { left, top, width, height }
  }
}
