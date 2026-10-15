import * as THREE from 'three'

// const GRAVITY_RADIUS = 200
const MAX_PULL_DISTANCE = 100
// const STAR_RECOVERY_RATE = 5
const GALAXY_RADIUS = 980
const BLACK_HOLE_ORBIT_RADIUS = GALAXY_RADIUS * 0.3

export class GalaxyBlackHole {
  private readonly group = new THREE.Group()
  private readonly position = new THREE.Vector3()
  private readonly reducedMotion: boolean
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly blackHoleMaterial: THREE.ShaderMaterial
  private readonly camera: THREE.PerspectiveCamera
  private readonly affectedStarFields: {
    points: THREE.Points
    originalPositions: Float32Array
  }[] = []

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
               p = (F + F - r) / r.y / 0.7,
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
          float holeMask = 1.0 - smoothstep(0.56, 0.72, blackHoleRadius);
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
    const singularity = new THREE.Mesh(singularityGeometry, blackHoleMaterial)
    singularity.position.z = -4.5
    this.group.add(singularity)
    this.geometries.push(singularityGeometry)
    this.materials.push(blackHoleMaterial)

    galaxy.add(this.group)
    this.addGravityToStars(starFields)
  }

  update(time: number) {
    const seconds = time * 0.001
    const phase = this.reducedMotion ? 0 : seconds
    this.position.set(
      Math.sin(phase * 0.018) * BLACK_HOLE_ORBIT_RADIUS,
      0,
      Math.cos(phase * 0.018) * BLACK_HOLE_ORBIT_RADIUS,
    )
    this.group.position.copy(this.position)
    const galaxyQuaternion = this.group.parent?.getWorldQuaternion(new THREE.Quaternion())
    const cameraQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion())
    this.group.quaternion.copy(
      galaxyQuaternion ? galaxyQuaternion.invert().multiply(cameraQuaternion) : cameraQuaternion,
    )
    this.blackHoleMaterial.uniforms['iTime']!.value = this.reducedMotion ? 0 : seconds
    this.updateStarPositions()
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
