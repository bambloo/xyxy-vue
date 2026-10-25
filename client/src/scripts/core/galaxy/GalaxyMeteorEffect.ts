import * as THREE from 'three'
import {
  TIME_FORTUNE_FIRST_VISIT_METEOR_ARRIVED_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_READY_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_STARTED_EVENT,
  type FirstVisitMeteorRequest,
} from '@/events/time-fortune'

type ActiveMeteor = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  head: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  companions: Array<{
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
    head: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
    progressOffset: number
    lateralOffset: number
    size: number
  }>
  end: THREE.Vector3
  start: THREE.Vector3
  rotations: number
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
    float alpha = (haze + core) * u_opacity;
    vec3 color = mix(vec3(0.72, 0.82, 0.94), vec3(1.0), pow(vUv.x, 12.0));
    gl_FragColor = vec4(color, alpha);
  }
`

const meteorHeadFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float u_opacity;

  void main() {
    vec2 point = (vUv - 0.5) * 2.0;
    float radius = length(point);
    float halo = exp(-radius * 3.2) * 1.05;
    float glow = exp(-radius * 9.0) * 1.2;
    float core = exp(-radius * 30.0) * 2.4;
    float alpha = clamp((halo + glow + core) * u_opacity * 1.25, 0.0, 1.0);
    vec3 color = mix(vec3(0.62, 0.78, 1.0), vec3(1.0), clamp(core, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
  }
`

export class GalaxyMeteorEffect {
  private readonly activeMeteors: ActiveMeteor[] = []
  private readonly orbitAxis = new THREE.Vector3()
  private readonly headGeometry = new THREE.PlaneGeometry(1, 1)
  private readonly firstVisitMeteorCounts = new Map<number, number>()

  private enabled = true
  private readonly readyFirstVisitSequences = new Set<number>()
  private readonly handleFirstVisitMeteor = (event: Event) => {
    const { sequenceId, meteorCount } = (event as CustomEvent<FirstVisitMeteorRequest>).detail
    const count = Number.isFinite(meteorCount)
      ? THREE.MathUtils.clamp(Math.floor(meteorCount), 1, 7)
      : 1
    this.firstVisitMeteorCounts.set(sequenceId, count)
    if (!this.enabled) {
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
      .filter((item) => item.firstVisitSequenceId !== undefined)
      .forEach((meteor) => this.removeMeteor(meteor))
    this.spawnFirstVisitMeteor(sequenceId)
    this.notifyFirstVisitMeteorStarted(sequenceId)
  }
  private readonly handleFirstVisitMeteorReady = (event: Event) => {
    const sequenceId = (event as CustomEvent<number>).detail
    if (!this.enabled) {
      this.notifyFirstVisitMeteor(sequenceId, false)
      return
    }

    this.readyFirstVisitSequences.add(sequenceId)
    const meteor = this.activeMeteors.find((item) => item.firstVisitSequenceId === sequenceId)
    if (!meteor) {
      this.spawnFirstVisitMeteor(sequenceId)
      return
    }
    this.redirectFirstVisitMeteor(meteor)
  }
  private readonly handleFirstVisitMeteorCancel = (event: Event) => {
    const sequenceId = (event as CustomEvent<number>).detail
    this.readyFirstVisitSequences.delete(sequenceId)
    this.firstVisitMeteorCounts.delete(sequenceId)
    const meteor = this.activeMeteors.find((item) => item.firstVisitSequenceId === sequenceId)
    if (!meteor) return
    this.removeMeteor(meteor)
  }

  private spawnFirstVisitMeteor(sequenceId: number) {
    const startTime = performance.now()
    const ready = this.readyFirstVisitSequences.has(sequenceId)
    const buttonTarget = this.mainStarBelowPosition()
    const end = this.destinationFromScreen(buttonTarget.x, buttonTarget.y, METEOR_END_DEPTH)
    const start = this.destinationFromScreen(0.88, 0.82, FIRST_VISIT_METEOR_DEPTH)
    this.spawnMeteor(
      end,
      0,
      startTime,
      5600,
      sequenceId,
      ready,
      start,
      this.firstVisitMeteorCounts.get(sequenceId) ?? 1,
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
    meteor.firstVisitReady = true
  }

  private removeMeteor(meteor: ActiveMeteor) {
    const index = this.activeMeteors.indexOf(meteor)
    if (index < 0) return
    this.disposeMeteor(meteor)
    this.activeMeteors.splice(index, 1)
  }

  private disposeMeteor(meteor: ActiveMeteor) {
    this.scene.remove(meteor.mesh, meteor.head)
    meteor.mesh.geometry.dispose()
    meteor.mesh.material.dispose()
    meteor.head.material.dispose()
    meteor.companions.forEach(({ mesh, head }) => {
      this.scene.remove(mesh, head)
      mesh.geometry.dispose()
      mesh.material.dispose()
      head.material.dispose()
    })
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
    this.camera.getWorldDirection(this.orbitAxis)
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (!enabled) {
      this.activeMeteors.forEach((meteor) => {
        if (meteor.firstVisitSequenceId !== undefined) {
          this.notifyFirstVisitMeteor(meteor.firstVisitSequenceId, false)
        }
      })
      this.activeMeteors.forEach((meteor) => {
        this.disposeMeteor(meteor)
      })
      this.activeMeteors.length = 0
      this.readyFirstVisitSequences.clear()
      this.firstVisitMeteorCounts.clear()
    }
  }

  update(nowMs: number) {
    if (!this.enabled) return
    this.camera.updateMatrixWorld(true)
    for (let index = this.activeMeteors.length - 1; index >= 0; index--) {
      const meteor = this.activeMeteors[index]!
      if (nowMs < meteor.startTime) continue
      if (meteor.firstVisitSequenceId !== undefined) {
        const target = this.mainStarBelowPosition()
        meteor.end.copy(this.destinationFromScreen(target.x, target.y, METEOR_END_DEPTH))
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
          this.updateMeteorHead(meteor, progress, 0.9)
          this.updateMeteorCompanions(meteor, progress, 0.9)
          continue
        }
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
        this.disposeMeteor(meteor)
        this.activeMeteors.splice(index, 1)
        if (meteor.firstVisitSequenceId !== undefined) {
          this.readyFirstVisitSequences.delete(meteor.firstVisitSequenceId)
          this.firstVisitMeteorCounts.delete(meteor.firstVisitSequenceId)
          this.notifyFirstVisitMeteor(meteor.firstVisitSequenceId, true)
        }
        continue
      }

      const headProgress =
        meteor.firstVisitSequenceId !== undefined
          ? progress
          : THREE.MathUtils.smoothstep(progress, 0, 1)
      this.updateTrail(meteor, headProgress)
      const opacity =
        meteor.firstVisitSequenceId !== undefined
          ? 0.9
          : Math.pow(Math.sin(progress * Math.PI), 0.8)
      meteor.mesh.material.uniforms.u_opacity!.value = opacity
      this.updateMeteorHead(meteor, headProgress, opacity)
      this.updateMeteorCompanions(meteor, headProgress, opacity)
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
      this.disposeMeteor(meteor)
    })
    this.activeMeteors.length = 0
    this.readyFirstVisitSequences.clear()
    this.firstVisitMeteorCounts.clear()
    this.headGeometry.dispose()
  }

  private spawnMeteor(
    end: THREE.Vector3,
    rotations: number,
    startTime: number,
    duration: number,
    firstVisitSequenceId?: number,
    firstVisitReady = false,
    startPosition?: THREE.Vector3,
    meteorCount = 1,
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
    const head = new THREE.Mesh(
      this.headGeometry,
      new THREE.ShaderMaterial({
        vertexShader: meteorVertexShader,
        fragmentShader: meteorHeadFragmentShader,
        uniforms: { u_opacity: { value: 0 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    )
    head.frustumCulled = false
    head.renderOrder = 11
    this.scene.add(head)
    const companionSettings: Array<{
      progressOffset: number
      lateralOffset: number
      size: number
    }> = []
    let progressOffset = 0
    for (let index = 0; index < meteorCount - 1; index++) {
      progressOffset += 0.018 + Math.random() * 0.032
      let lateralOffset = 0
      for (let attempt = 0; attempt < 12; attempt++) {
        lateralOffset = (Math.random() * 2 - 1) * 36
        if (companionSettings.every((item) => Math.abs(item.lateralOffset - lateralOffset) >= 8)) {
          break
        }
      }
      companionSettings.push({
        progressOffset,
        lateralOffset,
        size: 8 + Math.random() * 10,
      })
    }
    const companions = companionSettings.slice(0, meteorCount - 1).map((companion, index) => {
      const companionGeometry = geometry.clone()
      const companionMaterial = material.clone()
      companionMaterial.uniforms.u_opacity!.value = 0
      const companionMesh = new THREE.Mesh(companionGeometry, companionMaterial)
      companionMesh.frustumCulled = false
      companionMesh.renderOrder = 9 + index
      this.scene.add(companionMesh)

      const companionHeadMaterial = head.material.clone()
      companionHeadMaterial.uniforms.u_opacity!.value = 0
      const companionHead = new THREE.Mesh(this.headGeometry, companionHeadMaterial)
      companionHead.frustumCulled = false
      companionHead.renderOrder = 11 + index
      this.scene.add(companionHead)
      return { ...companion, mesh: companionMesh, head: companionHead }
    })
    this.activeMeteors.push({
      mesh,
      head,
      companions,
      end,
      start: startPosition ?? this.randomMeteorStart(end),
      rotations,
      startTime,
      duration,
      firstVisitSequenceId,
      firstVisitReady,
      firstVisitProgress: 0,
      firstVisitSpeed: 0,
      firstVisitLastUpdate: startTime,
    })
  }

  private updateMeteorHead(
    meteor: ActiveMeteor,
    progress: number,
    opacity: number,
    head: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> = meteor.head,
    size = 32,
    lateralOffset = 0,
  ) {
    const position = this.meteorPathPosition(meteor, progress)
    const before = this.meteorPathPosition(meteor, progress - 0.002)
    const after = this.meteorPathPosition(meteor, progress + 0.002)
    const tangent = after.sub(before).normalize()
    const viewDirection = position.clone().sub(this.camera.position).normalize()
    const side = new THREE.Vector3().crossVectors(tangent, viewDirection).normalize()
    const cameraPosition = this.camera.worldToLocal(position.clone())
    const depth = Math.max(this.camera.near, -cameraPosition.z)
    const viewHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
    const worldUnitsPerPixel = viewHeight / Math.max(1, this.host.clientHeight)
    position.addScaledVector(side, worldUnitsPerPixel * lateralOffset)
    const diameter = worldUnitsPerPixel * size
    head.position.copy(position)
    head.quaternion.copy(this.camera.quaternion)
    head.scale.set(diameter, diameter, 1)
    head.material.uniforms.u_opacity!.value = opacity
  }

  private updateMeteorCompanions(meteor: ActiveMeteor, progress: number, opacity: number) {
    meteor.companions.forEach((companion) => {
      const companionProgress = Math.max(0, progress - companion.progressOffset)
      const companionOpacity = opacity * 0.78
      this.updateTrail(
        meteor,
        companionProgress,
        0.038,
        0.55,
        companion.lateralOffset,
        companion.mesh,
      )
      companion.mesh.material.uniforms.u_opacity!.value = companionOpacity
      this.updateMeteorHead(
        meteor,
        companionProgress,
        companionOpacity,
        companion.head,
        companion.size,
        companion.lateralOffset,
      )
    })
  }

  private updateTrail(
    meteor: ActiveMeteor,
    progress: number,
    trailLength = 0.12,
    widthScale = 1,
    lateralOffset = 0,
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> = meteor.mesh,
  ) {
    const segments = METEOR_TRAIL_SEGMENTS
    const trailStart = progress - trailLength
    const positionAttribute = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
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
      center.addScaledVector(side, worldUnitsPerPixel * lateralOffset)
      const halfWidth = worldUnitsPerPixel * (1.4 + along * 1.2) * widthScale
      const offset = segment * 6
      positions[offset] = center.x + side.x * halfWidth
      positions[offset + 1] = center.y + side.y * halfWidth
      positions[offset + 2] = center.z + side.z * halfWidth
      positions[offset + 3] = center.x - side.x * halfWidth
      positions[offset + 4] = center.y - side.y * halfWidth
      positions[offset + 5] = center.z - side.z * halfWidth
    }
    positionAttribute.needsUpdate = true
    mesh.geometry.computeBoundingSphere()
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
      : (FIRST_VISIT_METEOR_WAITING_LIMIT / easingTime) * Math.exp(-elapsed / easingTime) +
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
    return this.destinationFromScreen(screenX + offsetX, screenY + offsetY, METEOR_START_DEPTH)
  }

  private mainStarBelowPosition() {
    const bounds = this.host.getBoundingClientRect()
    const buttonBounds = document
      .querySelector<HTMLElement>('.sun-portal-control')
      ?.getBoundingClientRect()
    if (buttonBounds && bounds.width > 0 && bounds.height > 0) {
      const targetY = buttonBounds.bottom + 20
      return {
        x: ((buttonBounds.left + buttonBounds.width / 2 - bounds.left) / bounds.width) * 2 - 1,
        y: 1 - ((targetY - bounds.top) / bounds.height) * 2,
      }
    }

    const bottom = THREE.MathUtils.clamp(this.host.clientHeight * 0.13, 112, 168)
    const targetY = this.host.clientHeight - bottom + 20
    return { x: 0, y: 1 - (targetY / Math.max(1, this.host.clientHeight)) * 2 }
  }
}
