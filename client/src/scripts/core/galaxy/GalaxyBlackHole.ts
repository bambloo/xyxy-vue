import * as THREE from 'three'

// const GRAVITY_RADIUS = 200
const MAX_PULL_DISTANCE = 150
// const STAR_RECOVERY_RATE = 5
const GALAXY_RADIUS = 980
const BLACK_HOLE_ORBIT_RADIUS = GALAXY_RADIUS * 0.3
const BLACK_HOLE_VIEW_DIAMETER = 0.9
const BLACK_HOLE_HORIZON_DIAMETER_RATIO = 0.7 * 0.56
const BLACK_HOLE_SHADER_COORDINATE_SCALE = 0.7
const BLACK_HOLE_CORE_RADIUS = 0.56

export class GalaxyBlackHole {
  private readonly group = new THREE.Group()
  private readonly position = new THREE.Vector3()
  private readonly reducedMotion: boolean
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly blackHoleMaterial: THREE.ShaderMaterial
  private readonly camera: THREE.PerspectiveCamera
  private readonly singularity: THREE.Mesh
  private readonly affectedStarFields: {
    points: THREE.Points
    originalPositions: Float32Array
  }[] = []
  private blackHoleView = false

  constructor(
    galaxy: THREE.Group,
    starFields: THREE.Points[],
    reducedMotion: boolean,
    camera: THREE.PerspectiveCamera,
  ) {
    this.reducedMotion = reducedMotion
    this.camera = camera

    const singularityGeometry = new THREE.PlaneGeometry(112, 112)
    const blackHoleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector3(256, 256, 1) },
        iTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 v_uv;
        void main() {
          v_uv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 v_uv;
        uniform vec3 iResolution;
        uniform float iTime;

        void mainImage(out vec4 O, vec2 F) {
          float i = 0.2, a;
          vec2 r = iResolution.xy,
               p = (F + F - r) / r.y / ${BLACK_HOLE_SHADER_COORDINATE_SCALE},
               d = vec2(-1.0, 1.0),
               b = p - i * d,
               c = p * mat2(1.0, 1.0, d / (0.1 + i / dot(b, b))),
               v;
          a = max(dot(c, c), 0.0001);
          v = c * mat2(cos(0.5 * log(a) + iTime * i + vec4(0.0, 33.0, 11.0, 0.0))) / i;
          vec2 w = vec2(0.0);
          for (; i++ < 9.0; w += 1.0 + sin(v)) {
            v += 0.7 * sin(v.yx * i + iTime) / i + 0.5;
          }
          i = length(sin(v / 0.3) * 0.4 + c * (3.0 + d));
          O = 1.0 - exp(
            -exp(c.x * vec4(0.6, -0.4, -1.0, 0.0))
            / w.xyyx
            / (2.0 + i * i / 4.0 - i)
            / (0.5 + 1.0 / a)
            / (0.03 + abs(length(p) - 0.7))
          );
          float radius = length(p);
          float blackHoleRadius = length(p);
          float holeMask = 1.0 - smoothstep(${BLACK_HOLE_CORE_RADIUS}, 0.72, blackHoleRadius);
          O.rgb *= 1.0 - holeMask;
          float photonRing = exp(-pow((blackHoleRadius - 0.68) / 0.065, 2.0));
          O.rgb += vec3(0.72, 0.84, 1.0) * photonRing * 0.22;
          O.a = holeMask + O.a * (1.0 - holeMask);
          O.a *= 1.0 - smoothstep(1.0, 1.42, radius);
          if (O.a <= 0.0) discard;
        }

        void main() {
          vec2 fragmentPosition = v_uv * iResolution.xy;
          vec4 color;
          mainImage(color, fragmentPosition);
          gl_FragColor = color;
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    this.blackHoleMaterial = blackHoleMaterial
    this.singularity = new THREE.Mesh(singularityGeometry, blackHoleMaterial)
    this.singularity.position.z = -4.5
    this.group.add(this.singularity)
    this.geometries.push(singularityGeometry)
    this.materials.push(blackHoleMaterial)

    galaxy.add(this.group)
    this.addGravityToStars(starFields)
  }

  update(time: number) {
    const seconds = time * 0.001
    const phase = this.reducedMotion ? 0 : seconds
    if (this.blackHoleView) {
      const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3())
      const cameraDirection = this.camera.getWorldDirection(new THREE.Vector3())
      const worldPosition = cameraPosition.addScaledVector(cameraDirection, 230)
      this.group.parent?.updateMatrixWorld(true)
      this.position.copy(this.group.parent?.worldToLocal(worldPosition) ?? worldPosition)
    } else {
      this.position.set(
        Math.sin(phase * 0.018) * BLACK_HOLE_ORBIT_RADIUS,
        0,
        Math.cos(phase * 0.018) * BLACK_HOLE_ORBIT_RADIUS,
      )
    }
    this.group.position.copy(this.position)
    const galaxyQuaternion = this.group.parent?.getWorldQuaternion(new THREE.Quaternion())
    const cameraQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion())
    this.group.quaternion.copy(
      galaxyQuaternion ? galaxyQuaternion.invert().multiply(cameraQuaternion) : cameraQuaternion,
    )
    if (this.blackHoleView) {
      this.updateBlackHoleViewScale()
    } else {
      this.singularity.scale.set(1, 1, 1)
    }
    this.blackHoleMaterial.uniforms['iTime']!.value = this.reducedMotion ? 0 : seconds
    this.updateStarPositions()
  }

  setBlackHoleView(enabled: boolean) {
    this.blackHoleView = enabled
    if (!enabled) this.singularity.scale.set(1, 1, 1)
  }

  hitTest(event: PointerEvent, camera: THREE.Camera, element: HTMLElement) {
    const bounds = element.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return false

    const pointer = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(pointer, camera)
    this.group.updateMatrixWorld(true)
    const aspect =
      this.blackHoleMaterial.uniforms['iResolution']!.value.x /
      this.blackHoleMaterial.uniforms['iResolution']!.value.y
    return raycaster.intersectObject(this.singularity, false).some(({ uv }) => {
      if (!uv) return false
      const shaderX = ((uv.x * 2 - 1) * aspect) / BLACK_HOLE_SHADER_COORDINATE_SCALE
      const shaderY = (uv.y * 2 - 1) / BLACK_HOLE_SHADER_COORDINATE_SCALE
      return Math.hypot(shaderX, shaderY) <= BLACK_HOLE_CORE_RADIUS
    })
  }

  destroy(galaxy: THREE.Group) {
    galaxy.remove(this.group)
    this.geometries.forEach((geometry) => geometry.dispose())
    this.materials.forEach((material) => material.dispose())
  }

  private addGravityToStars(starFields: THREE.Points[]) {
    starFields.forEach((field) => {
      const positionAttribute = field.geometry.getAttribute('position')
      if (!positionAttribute) return

      field.geometry.computeBoundingSphere()
      if (field.geometry.boundingSphere) {
        field.geometry.boundingSphere.radius += MAX_PULL_DISTANCE
      }
      this.affectedStarFields.push({
        points: field,
        originalPositions: Float32Array.from(positionAttribute.array),
      })
    })
  }

  private updateBlackHoleViewScale() {
    const aspect = Math.max(this.camera.aspect, 0.01)
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3())
    this.group.updateMatrixWorld(true)
    const holePosition = this.singularity.getWorldPosition(new THREE.Vector3())
    const distance = cameraPosition.distanceTo(holePosition)
    const viewportHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const targetDiameter = viewportHeight * Math.min(1, aspect) * BLACK_HOLE_VIEW_DIAMETER
    const planeHeight = targetDiameter / BLACK_HOLE_HORIZON_DIAMETER_RATIO
    const planeWidth = planeHeight * aspect
    this.singularity.scale.set(planeWidth / 112, planeHeight / 112, 1)
    this.blackHoleMaterial.uniforms['iResolution']!.value.set(256 * aspect, 256, 1)
  }

  private updateStarPositions() {
    this.affectedStarFields.forEach(({ points, originalPositions }) => {
      const attribute = points.geometry.getAttribute('position')
      const starCount = originalPositions.length / 3

      for (let index = 0; index < starCount; index++) {
        const offset = index * 3
        const originalX = originalPositions[offset]!
        const originalY = originalPositions[offset + 1]!
        const originalZ = originalPositions[offset + 2]!
        const deltaX = this.position.x - originalX
        const deltaY = this.position.y - originalY
        const deltaZ = this.position.z - originalZ

        const distance = Math.hypot(deltaX, deltaY, deltaZ)
        if (distance > MAX_PULL_DISTANCE) {
          attribute.setXYZ(index, originalX, originalY, originalZ)
          continue
        }

        const distanceRatio = distance / MAX_PULL_DISTANCE
        const pullStrength = (1 - distanceRatio) ** 0.2
        const pullX = deltaX * pullStrength
        const pullY = deltaY * pullStrength
        const pullZ = deltaZ * pullStrength

        attribute.setXYZ(index, originalX + pullX, originalY + pullY, originalZ + pullZ)
      }
      attribute.needsUpdate = true
      attribute.needsUpdate = true
    })
  }
}
