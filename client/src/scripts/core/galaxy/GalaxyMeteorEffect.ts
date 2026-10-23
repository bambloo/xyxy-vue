import * as THREE from 'three'
import {
  TIME_FORTUNE_FIRST_VISIT_METEOR_ARRIVED_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_READY_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_STARTED_EVENT,
} from '@/events/time-fortune'

type ActiveMeteor = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  destination: DestinationStar
  end: THREE.Vector3
  start: THREE.Vector3
  rotations: number
  landsAtDestination: boolean
  destinationOffsetY: number
  startTime: number
  duration: number
  firstVisitSequenceId?: number
  firstVisitReady: boolean
  firstVisitProgress: number
  firstVisitSpeed: number
  firstVisitLastUpdate: number
  firstVisitTurnControl1?: THREE.Vector3
  firstVisitTurnControl2?: THREE.Vector3
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
const METEOR_START_DEPTH = 2200
const METEOR_END_DEPTH = 180
const FIRST_VISIT_METEOR_DEPTH = 2600
const FIRST_VISIT_METEOR_WAITING_TIME = 10000
const FIRST_VISIT_METEOR_WAITING_LIMIT = 0.94
const FIRST_VISIT_METEOR_WAITING_CREEP = 0.00025
const FIRST_VISIT_METEOR_ACCELERATION = 0.012
const FIRST_VISIT_METEOR_MAX_SPEED = 0.12
const METEOR_TRAIL_SEGMENTS = 160

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
    float bodyFade = 1.0 - smoothstep(0.84, 0.98, vUv.x);
    float haze = exp(-center * 3.0) * alongFade * bodyFade * 0.48;
    float core = exp(-center * 16.0) * alongFade * bodyFade * 0.72;
    vec2 headPoint = vec2((1.0 - vUv.x) * 42.0, center * 1.5);
    float head = exp(-dot(headPoint, headPoint) * 2.5);
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
  private enabled = true
  private readonly readyFirstVisitSequences = new Set<number>()
  private readonly handleFirstVisitMeteor = (event: Event) => {
    const sequenceId = (event as CustomEvent<number>).detail
    const destination = this.destinations.find((item) => item.revealsPortal)
    if (!destination || !this.enabled) {
      this.notifyFirstVisitMeteor(sequenceId, false)
      return
    }

    const existingMeteor = this.activeMeteors.find(
      (item) => item.firstVisitSequenceId === sequenceId,
    )
    if (existingMeteor) {
      this.notifyFirstVisitMeteorStarted(sequenceId)
      return
    }

    this.activeMeteors
      .filter((item) => item.destination === destination)
      .forEach((meteor) => this.removeMeteor(meteor))
    this.spawnFirstVisitMeteor(destination, sequenceId)
    this.notifyFirstVisitMeteorStarted(sequenceId)
  }
  private readonly handleFirstVisitMeteorReady = (event: Event) => {
    const sequenceId = (event as CustomEvent<number>).detail
    const destination = this.destinations.find((item) => item.revealsPortal)
    if (!destination || !this.enabled) {
      this.notifyFirstVisitMeteor(sequenceId, false)
      return
    }

    this.readyFirstVisitSequences.add(sequenceId)
    const meteor = this.activeMeteors.find((item) => item.firstVisitSequenceId === sequenceId)
    if (!meteor) {
      this.spawnFirstVisitMeteor(destination, sequenceId)
      return
    }
    this.redirectFirstVisitMeteor(meteor)
  }
  private readonly handleFirstVisitMeteorCancel = (event: Event) => {
    const sequenceId = (event as CustomEvent<number>).detail
    this.readyFirstVisitSequences.delete(sequenceId)
    const meteor = this.activeMeteors.find((item) => item.firstVisitSequenceId === sequenceId)
    if (!meteor) return
    this.removeMeteor(meteor)
  }

  private spawnFirstVisitMeteor(destination: DestinationStar, sequenceId: number) {
    const startTime = performance.now()
    const ready = this.readyFirstVisitSequences.has(sequenceId)
    const buttonTarget = this.mainStarBelowPosition()
    const end = this.destinationFromScreen(buttonTarget.x, buttonTarget.y, METEOR_END_DEPTH)
    const start = this.destinationFromScreen(0.88, 0.82, FIRST_VISIT_METEOR_DEPTH)
    this.spawnMeteor(
      destination,
      end,
      0,
      startTime,
      5600,
      ready,
      sequenceId,
      ready,
      start,
    )
    const meteor = this.activeMeteors.find((item) => item.firstVisitSequenceId === sequenceId)
    if (!meteor) return
    meteor.firstVisitTurnControl1 = this.destinationFromScreen(-1.02, 0.9, 1900)
    meteor.firstVisitTurnControl2 = this.firstVisitEndControl(start, end, buttonTarget)
    meteor.firstVisitSpeed = ready ? 0.02 : 0
  }

  private firstVisitEndControl(
    start: THREE.Vector3,
    end: THREE.Vector3,
    target: { x: number; y: number },
  ) {
    const cameraStart = this.camera.worldToLocal(start.clone())
    const cameraEnd = this.camera.worldToLocal(end.clone())
    const depth = THREE.MathUtils.lerp(-cameraStart.z, -cameraEnd.z, 0.68)
    return this.destinationFromScreen(-1.02, target.y - 0.18, depth)
  }

  private redirectFirstVisitMeteor(meteor: ActiveMeteor) {
    const now = performance.now()
    meteor.firstVisitProgress = this.waitingMeteorProgress(meteor, now)
    meteor.firstVisitSpeed = this.waitingMeteorSpeed(meteor, now)
    meteor.firstVisitLastUpdate = now
    meteor.landsAtDestination = true
    meteor.firstVisitReady = true
    meteor.destinationOffsetY = -0.12
  }

  private removeMeteor(meteor: ActiveMeteor) {
    const index = this.activeMeteors.indexOf(meteor)
    if (index < 0) return
    this.scene.remove(meteor.mesh)
    meteor.mesh.geometry.dispose()
    meteor.mesh.material.dispose()
    this.activeMeteors.splice(index, 1)
  }

  private notifyFirstVisitMeteor(sequenceId: number, arrived: boolean) {
    window.dispatchEvent(
      new CustomEvent(TIME_FORTUNE_FIRST_VISIT_METEOR_ARRIVED_EVENT, {
        detail: { sequenceId, arrived },
      }),
    )
  }

  private notifyFirstVisitMeteorStarted(sequenceId: number) {
    window.dispatchEvent(
      new CustomEvent(TIME_FORTUNE_FIRST_VISIT_METEOR_STARTED_EVENT, {
        detail: sequenceId,
      }),
    )
  }

  constructor(
    private readonly host: HTMLElement,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly reducedMotion: boolean,
  ) {
    window.addEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT, this.handleFirstVisitMeteor)
    window.addEventListener(
      TIME_FORTUNE_FIRST_VISIT_METEOR_READY_EVENT,
      this.handleFirstVisitMeteorReady,
    )
    window.addEventListener(
      TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT,
      this.handleFirstVisitMeteorCancel,
    )
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
    const mainStarPosition = this.mainStarScreenPosition()
    const endpoint = this.destinationFromScreen(
      mainStarPosition.x,
      mainStarPosition.y,
      METEOR_END_DEPTH,
    )
    this.destinations.push(
      this.createDestination(endpoint, mainStarPosition.x, mainStarPosition.y, true),
    )
  }

  pointerDown(event: PointerEvent) {
    if (!this.enabled) return
    this.pointerStart = new THREE.Vector2(event.clientX, event.clientY)
  }

  cancelPointer() {
    this.pointerStart = undefined
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    this.pointerStart = undefined
    if (!enabled) {
      this.activeMeteors.forEach((meteor) => {
        if (meteor.firstVisitSequenceId !== undefined) {
          this.notifyFirstVisitMeteor(meteor.firstVisitSequenceId, false)
        }
      })
      this.activeMeteors.forEach((meteor) => {
        this.scene.remove(meteor.mesh)
        meteor.mesh.geometry.dispose()
        meteor.mesh.material.dispose()
      })
      this.activeMeteors.length = 0
      this.readyFirstVisitSequences.clear()
      this.destinations.forEach((destination) => {
        destination.group.visible = false
        destination.ring.visible = false
      })
      return
    }

    const now = performance.now()
    this.destinations.forEach((destination) => {
      destination.group.visible = false
      if (this.reducedMotion || destination.revealsPortal) {
        destination.group.visible = false
      } else {
        this.spawnMeteor(
          destination,
          this.destinationFromScreen(
            destination.screenX,
            destination.screenY,
            METEOR_END_DEPTH,
          ),
          0.42,
          now,
          1800,
          true,
        )
      }
    })
  }

  pointerUp(event: PointerEvent) {
    if (!this.enabled) {
      this.pointerStart = undefined
      return false
    }
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
      if (Math.hypot(event.clientX - screenX, event.clientY - screenY) > 48) continue
      destination.selected = !destination.selected
      destination.ring.visible = destination.selected
      return true
    }
    return false
  }

  update(nowMs: number) {
    if (!this.enabled) return
    this.camera.updateMatrixWorld(true)
    const mainStarPosition = this.mainStarScreenPosition()
    this.destinations.forEach((destination, index) => {
      if (destination.revealsPortal) {
        destination.screenX = mainStarPosition.x
        destination.screenY = mainStarPosition.y
      }
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
      if (meteor.firstVisitSequenceId !== undefined) {
        const target = this.mainStarBelowPosition()
        meteor.end.copy(
          this.destinationFromScreen(target.x, target.y, METEOR_END_DEPTH),
        )
        if (meteor.firstVisitTurnControl2) {
          meteor.firstVisitTurnControl2.copy(
            this.firstVisitEndControl(meteor.start, meteor.end, target),
          )
        }
        if (!meteor.firstVisitReady) {
          const progress = this.waitingMeteorProgress(meteor, nowMs)
          meteor.firstVisitProgress = progress
          this.updateTrail(meteor, progress)
          meteor.mesh.material.uniforms.u_opacity!.value = 0.9
          continue
        }
      } else if (meteor.landsAtDestination) {
        const target =
          {
            x: meteor.destination.screenX,
            y: meteor.destination.screenY + meteor.destinationOffsetY,
          }
        meteor.end.copy(
          this.destinationFromScreen(target.x, target.y, METEOR_END_DEPTH),
        )
      }
      let progress: number
      if (meteor.firstVisitSequenceId !== undefined) {
        const deltaSeconds = Math.max(0, nowMs - meteor.firstVisitLastUpdate) / 1000
        const speed = Math.min(
          FIRST_VISIT_METEOR_MAX_SPEED,
          meteor.firstVisitSpeed + FIRST_VISIT_METEOR_ACCELERATION * deltaSeconds,
        )
        progress = Math.min(
          1,
          meteor.firstVisitProgress +
            meteor.firstVisitSpeed * deltaSeconds +
            0.5 * FIRST_VISIT_METEOR_ACCELERATION * deltaSeconds * deltaSeconds,
        )
        meteor.firstVisitProgress = progress
        meteor.firstVisitSpeed = speed
        meteor.firstVisitLastUpdate = nowMs
      } else {
        progress = (nowMs - meteor.startTime) / meteor.duration
      }
      if (progress >= 1) {
        this.scene.remove(meteor.mesh)
        meteor.mesh.geometry.dispose()
        meteor.mesh.material.dispose()
        meteor.destination.group.visible = !meteor.destination.revealsPortal
        meteor.destination.group.quaternion.copy(this.camera.quaternion)
        this.activeMeteors.splice(index, 1)
        if (meteor.firstVisitSequenceId !== undefined) {
          this.readyFirstVisitSequences.delete(meteor.firstVisitSequenceId)
          this.notifyFirstVisitMeteor(meteor.firstVisitSequenceId, true)
        }
        continue
      }

      const headProgress =
        meteor.firstVisitSequenceId !== undefined
          ? progress
          : THREE.MathUtils.smoothstep(progress, 0, 1)
      this.updateTrail(meteor, headProgress)
      meteor.mesh.material.uniforms.u_opacity!.value =
        meteor.firstVisitSequenceId !== undefined
          ? 0.9
          : Math.pow(Math.sin(progress * Math.PI), 0.8)
    }
  }

  destroy() {
    window.removeEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT, this.handleFirstVisitMeteor)
    window.removeEventListener(
      TIME_FORTUNE_FIRST_VISIT_METEOR_READY_EVENT,
      this.handleFirstVisitMeteorReady,
    )
    window.removeEventListener(
      TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT,
      this.handleFirstVisitMeteorCancel,
    )
    this.activeMeteors.forEach((meteor) => {
      this.scene.remove(meteor.mesh)
      meteor.mesh.geometry.dispose()
      meteor.mesh.material.dispose()
    })
    this.activeMeteors.length = 0
    this.readyFirstVisitSequences.clear()
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
    return {
      group,
      orb,
      ring,
      screenX,
      screenY,
      selected: false,
      revealsPortal,
    }
  }

  private spawnMeteor(
    destination: DestinationStar,
    end: THREE.Vector3,
    rotations: number,
    startTime: number,
    duration: number,
    landsAtDestination = false,
    firstVisitSequenceId?: number,
    firstVisitReady = false,
    startPosition?: THREE.Vector3,
  ) {
    const segments = METEOR_TRAIL_SEGMENTS
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
      start: startPosition ?? this.randomMeteorStart(end),
      rotations,
      landsAtDestination,
      destinationOffsetY: firstVisitReady ? -0.12 : 0,
      startTime,
      duration,
      firstVisitSequenceId,
      firstVisitReady,
      firstVisitProgress: 0,
      firstVisitSpeed: 0,
      firstVisitLastUpdate: startTime,
    })
  }

  private updateTrail(meteor: ActiveMeteor, progress: number) {
    const segments = METEOR_TRAIL_SEGMENTS
    const trailStart = progress - 0.12
    const positionAttribute = meteor.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const positions = positionAttribute.array as Float32Array
    for (let segment = 0; segment <= segments; segment++) {
      const along = segment / segments
      const pathProgress = THREE.MathUtils.lerp(trailStart, progress, along)
      const center = this.meteorPathPosition(meteor, pathProgress)
      const tangentStep = 0.002
      const before = this.meteorPathPosition(meteor, pathProgress - tangentStep)
      const after = this.meteorPathPosition(meteor, pathProgress + tangentStep)
      const tangent = after.sub(before).normalize()
      const viewDirection = center.clone().sub(this.camera.position).normalize()
      const side = new THREE.Vector3().crossVectors(tangent, viewDirection).normalize()
      const cameraCenter = this.camera.worldToLocal(center.clone())
      const depth = Math.max(this.camera.near, -cameraCenter.z)
      const viewHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
      const worldUnitsPerPixel = viewHeight / Math.max(1, this.host.clientHeight)
      const halfWidth = worldUnitsPerPixel * (1.4 + along * 1.2)
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

  private destinationFromScreen(x: number, y: number, depth = 900) {
    this.camera.updateMatrixWorld(true)
    const viewHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
    const viewWidth = viewHeight * this.camera.aspect
    const cameraPosition = new THREE.Vector3(x * viewWidth * 0.5, y * viewHeight * 0.5, -depth)
    return this.camera.localToWorld(cameraPosition)
  }

  private pathPosition(
    end: THREE.Vector3,
    progress: number,
    rotations: number,
    start: THREE.Vector3,
  ) {
    const inverseProgress = 1 - progress
    const direction = end.clone().sub(start)
    const distance = direction.length()
    const curveDirection = new THREE.Vector3().crossVectors(direction, this.orbitAxis).normalize()
    const control = start
      .clone()
      .add(end)
      .multiplyScalar(0.5)
      .addScaledVector(curveDirection, distance * rotations)
    return start
      .clone()
      .multiplyScalar(inverseProgress * inverseProgress)
      .addScaledVector(control, 2 * inverseProgress * progress)
      .addScaledVector(end, progress * progress)
  }

  private meteorPathPosition(meteor: ActiveMeteor, progress: number) {
    if (
      meteor.firstVisitSequenceId !== undefined &&
      meteor.firstVisitTurnControl1 &&
      meteor.firstVisitTurnControl2
    ) {
      const t = progress
      const inverseT = 1 - t
      return meteor.start
        .clone()
        .multiplyScalar(inverseT * inverseT * inverseT)
        .addScaledVector(meteor.firstVisitTurnControl1, 3 * inverseT * inverseT * t)
        .addScaledVector(meteor.firstVisitTurnControl2, 3 * inverseT * t * t)
        .addScaledVector(meteor.end, t * t * t)
    }
    return this.pathPosition(meteor.end, progress, meteor.rotations, meteor.start)
  }

  private waitingMeteorProgress(meteor: ActiveMeteor, nowMs: number) {
    const elapsed = Math.max(0, nowMs - meteor.startTime) / 1000
    const easingTime = FIRST_VISIT_METEOR_WAITING_TIME / 1000
    return Math.min(
      FIRST_VISIT_METEOR_WAITING_LIMIT,
      FIRST_VISIT_METEOR_WAITING_LIMIT * (1 - Math.exp(-elapsed / easingTime)) +
        FIRST_VISIT_METEOR_WAITING_CREEP * elapsed,
    )
  }

  private waitingMeteorSpeed(meteor: ActiveMeteor, nowMs: number) {
    const elapsed = Math.max(0, nowMs - meteor.startTime) / 1000
    const easingTime = FIRST_VISIT_METEOR_WAITING_TIME / 1000
    const progress =
      FIRST_VISIT_METEOR_WAITING_LIMIT * (1 - Math.exp(-elapsed / easingTime)) +
      FIRST_VISIT_METEOR_WAITING_CREEP * elapsed
    return progress >= FIRST_VISIT_METEOR_WAITING_LIMIT
      ? 0
      : (FIRST_VISIT_METEOR_WAITING_LIMIT / easingTime) *
          Math.exp(-elapsed / easingTime) +
          FIRST_VISIT_METEOR_WAITING_CREEP
  }

  private randomMeteorStart(end: THREE.Vector3) {
    const cameraEnd = this.camera.worldToLocal(end.clone())
    const endDepth = Math.max(this.camera.near, -cameraEnd.z)
    const screenX =
      cameraEnd.x /
      (endDepth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * this.camera.aspect)
    const screenY =
      cameraEnd.y / (endDepth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)))
    const offsetX = (Math.random() * 2 - 1) * 0.28
    const offsetY = (Math.random() * 2 - 1) * 0.28
    return this.destinationFromScreen(
      screenX + offsetX,
      screenY + offsetY,
      METEOR_START_DEPTH,
    )
  }

  private cameraBounds() {
    const { left, top, width, height } = this.host.getBoundingClientRect()
    return { left, top, width, height }
  }

  private mainStarScreenPosition() {
    const bounds = this.cameraBounds()
    const button = document.querySelector<HTMLElement>('.sun-portal-control')
    const buttonBounds = button?.getBoundingClientRect()
    if (buttonBounds && bounds.width > 0 && bounds.height > 0) {
      return {
        x: ((buttonBounds.left + buttonBounds.width / 2 - bounds.left) / bounds.width) * 2 - 1,
        y: 1 - ((buttonBounds.top + buttonBounds.height / 2 - bounds.top) / bounds.height) * 2,
      }
    }

    const bottom = THREE.MathUtils.clamp(this.host.clientHeight * 0.13, 112, 168)
    const centerY = this.host.clientHeight - bottom - 46.2
    return { x: 0, y: 1 - (2 * centerY) / Math.max(1, this.host.clientHeight) }
  }

  private mainStarBelowPosition() {
    const bounds = this.cameraBounds()
    const buttonBounds = document
      .querySelector<HTMLElement>('.sun-portal-control')
      ?.getBoundingClientRect()
    if (buttonBounds && bounds.width > 0 && bounds.height > 0) {
      return {
        x: ((buttonBounds.left + buttonBounds.width / 2 - bounds.left) / bounds.width) * 2 - 1,
        y: 1 - ((buttonBounds.top + buttonBounds.height / 2 - bounds.top) / bounds.height) * 2,
      }
    }

    const position = this.mainStarScreenPosition()
    return { x: position.x, y: position.y - 0.12 }
  }
}
