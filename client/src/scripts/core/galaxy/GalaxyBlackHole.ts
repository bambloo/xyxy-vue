import * as THREE from 'three'

// const GRAVITY_RADIUS = 200
const MAX_PULL_DISTANCE = 150
// const STAR_RECOVERY_RATE = 5
const GALAXY_RADIUS = 980
const BLACK_HOLE_ORBIT_RADIUS = GALAXY_RADIUS * 0.3
const BLACK_HOLE_SHADER_COORDINATE_SCALE = 0.7
const BLACK_HOLE_VIEW_DIAMETER = 0.9
const BLACK_HOLE_PAGE_CORE_RADIUS = 0.56
const BLACK_HOLE_HORIZON_DIAMETER_RATIO =
  BLACK_HOLE_SHADER_COORDINATE_SCALE * BLACK_HOLE_PAGE_CORE_RADIUS
const GALAXY_BLACK_HOLE_VIEW_SCALE = 1.55
const GALAXY_BLACK_HOLE_HIT_RADIUS = 1.45
const BLACK_HOLE_PAGE_HIT_RADIUS = 1.42

function smoothRandom(time: number, seed: number) {
  const segment = Math.floor(time)
  const fraction = time - segment
  const eased = fraction * fraction * (3 - 2 * fraction)
  const sample = (index: number) => {
    const value = Math.sin((index + seed) * 127.1 + seed * 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  return THREE.MathUtils.lerp(sample(segment), sample(segment + 1), eased) * 2 - 1
}

function createAccretionTexture() {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  const valueNoise = (x: number, y: number, cells: number) => {
    const gridX = x * cells
    const gridY = y * cells
    const x0 = Math.floor(gridX)
    const y0 = Math.floor(gridY)
    const fx = gridX - x0
    const fy = gridY - y0
    const smoothX = fx * fx * (3 - 2 * fx)
    const smoothY = fy * fy * (3 - 2 * fy)
    const hash = (gx: number, gy: number) => {
      const wrappedX = ((gx % cells) + cells) % cells
      const wrappedY = ((gy % cells) + cells) % cells
      const value = Math.sin(wrappedX * 127.1 + wrappedY * 311.7) * 43758.5453
      return value - Math.floor(value)
    }
    const top = THREE.MathUtils.lerp(hash(x0, y0), hash(x0 + 1, y0), smoothX)
    const bottom = THREE.MathUtils.lerp(hash(x0, y0 + 1), hash(x0 + 1, y0 + 1), smoothX)
    return THREE.MathUtils.lerp(top, bottom, smoothY)
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const noise =
        valueNoise(u, v, 8) * 0.5 +
        valueNoise(u, v, 16) * 0.28 +
        valueNoise(u, v, 32) * 0.15 +
        valueNoise(u, v, 64) * 0.07
      const value = Math.round(255 * (0.18 + noise * 0.82))
      const offset = (y * size + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export class GalaxyBlackHole {
  private readonly group = new THREE.Group()
  private readonly position = new THREE.Vector3()
  private readonly viewDirection = new THREE.Vector3()
  private readonly cameraPosition = new THREE.Vector3()
  private readonly reducedMotion: boolean
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly textures: THREE.Texture[] = []
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
    const accretionTexture = createAccretionTexture()
    const blackHoleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        iResolution: { value: new THREE.Vector3(256, 256, 1) },
        iTime: { value: 0 },
        iBlackHoleView: { value: 0 },
        iViewDirection: { value: new THREE.Vector3(0, 0, 1) },
        iDiskNormal: { value: new THREE.Vector3(0, 1, 0) },
        iDiskRotation: { value: 0 },
        iChannel1: { value: accretionTexture },
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
        uniform float iBlackHoleView;
        uniform vec3 iViewDirection;
        uniform vec3 iDiskNormal;
        uniform float iDiskRotation;
        uniform sampler2D iChannel1;

        const float pi = 3.1415927;

        float sdSphere(vec3 p, float s) {
          return length(p) - s;
        }

        float sdTorus(vec3 p, vec2 t) {
          vec2 q = vec2(length(p.xz) - t.x, p.y);
          return length(q) - t.y;
        }

        void renderOriginalBlackHole(out vec4 color, vec2 p) {
          float i = 0.2;
          float a;
          vec2 d = vec2(-1.0, 1.0);
          vec2 b = p - i * d;
          vec2 c = p * mat2(1.0, 1.0, d / (0.1 + i / dot(b, b)));
          vec2 v;
          a = max(dot(c, c), 0.0001);
          v = c * mat2(cos(0.5 * log(a) + iTime * i + vec4(0.0, 33.0, 11.0, 0.0))) / i;
          vec2 w = vec2(0.0);
          for (; i++ < 9.0; w += 1.0 + sin(v)) {
            v += 0.7 * sin(v.yx * i + iTime) / i + 0.5;
          }
          i = length(sin(v / 0.3) * 0.4 + c * (3.0 + d));
          color = 1.0 - exp(
            -exp(c.x * vec4(0.6, -0.4, -1.0, 0.0))
            / w.xyyx
            / (2.0 + i * i / 4.0 - i)
            / (0.5 + 1.0 / a)
            / (0.03 + abs(length(p) - 0.7))
          );
          float radius = length(p);
          float holeMask = 1.0 - smoothstep(${BLACK_HOLE_PAGE_CORE_RADIUS}, 0.72, radius);
          color.rgb *= 1.0 - holeMask;
          float photonRing = exp(-pow((radius - 0.68) / 0.065, 2.0));
          color.rgb += vec3(0.72, 0.84, 1.0) * photonRing * 0.22;
          color.a = holeMask + color.a * (1.0 - holeMask);
          color.a *= 1.0 - smoothstep(1.0, 1.42, radius);
        }

        void mainImage(out vec4 fragColor, in vec2 fragCoord) {
          vec2 pp = fragCoord.xy / iResolution.xy;
          pp = -1.0 + 2.0 * pp;
          pp.x *= iResolution.x / iResolution.y;

          if (iBlackHoleView > 0.5) {
            vec2 p = pp / ${BLACK_HOLE_SHADER_COORDINATE_SCALE};
            renderOriginalBlackHole(fragColor, p);
            return;
          }

          pp *= ${GALAXY_BLACK_HOLE_VIEW_SCALE};
          vec3 ro = normalize(iViewDirection) * 2.0;
          vec3 front = -normalize(iViewDirection);
          vec3 worldUp = abs(front.y) > 0.98 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
          vec3 right = normalize(cross(front, worldUp));
          vec3 up = normalize(cross(right, front));
          vec3 rd = normalize(front * 1.5 + right * pp.x + up * pp.y);

          vec3 diskNormal = normalize(iDiskNormal);
          vec3 diskReference = abs(diskNormal.y) < 0.95
            ? vec3(0.0, 1.0, 0.0)
            : vec3(1.0, 0.0, 0.0);
          vec3 diskRight = normalize(cross(diskReference, diskNormal));
          vec3 diskForward = normalize(cross(diskNormal, diskRight));
          float rotationCos = cos(iDiskRotation);
          float rotationSin = sin(iDiskRotation);
          vec3 rotatedDiskRight = diskRight * rotationCos + diskForward * rotationSin;
          vec3 rotatedDiskForward = diskForward * rotationCos - diskRight * rotationSin;
          ro = vec3(
            dot(ro, rotatedDiskRight),
            dot(ro, diskNormal),
            dot(ro, rotatedDiskForward)
          );
          rd = vec3(
            dot(rd, rotatedDiskRight),
            dot(rd, diskNormal),
            dot(rd, rotatedDiskForward)
          );

          vec3 bh = vec3(0.0);
          float bhr = 0.15;
          float bhmass = 0.005;
          vec3 p = ro;
          vec3 pv = rd;
          float dt = 0.02;
          vec3 col = vec3(0.0);
          float noncaptured = 1.0;
          float holeAlpha = 0.0;
          vec3 c1 = vec3(0.5, 0.46, 0.4);
          vec3 c2 = vec3(1.0, 0.8, 0.6);

          for (float t = 0.0; t < 1.0; t += 0.005) {
            p += pv * dt * noncaptured;

            vec3 bhv = bh - p;
            float r = max(dot(bhv, bhv), 0.0001);
            pv += bhv * inversesqrt(r) * (bhmass / r);
            noncaptured = smoothstep(0.0, 0.666, sdSphere(p - bh, bhr));
            holeAlpha = max(
              holeAlpha,
              (1.0 - smoothstep(bhr * 0.85, bhr * 1.25, length(p - bh)))
            );

            float dr = length(bhv.xz);
            float da = atan(bhv.x, bhv.z);
            float angleTurns = da / (2.0 * pi);
            float textureAngle = angleTurns * 2.0 + dr * (0.03 + max(dr - bhr, 0.0) * 0.006) + iTime * 0.005;
            vec2 ra = vec2(dr, textureAngle);

            float distanceToHole = length(bhv);
            vec3 dcol =
              mix(c2, c1, pow(max(distanceToHole - bhr, 0.0), 2.0)) *
              max(0.0, texture2D(iChannel1, ra).r + 0.05) *
              (4.0 / (0.001 + (distanceToHole - bhr) * 50.0));

            float discMask = smoothstep(
              0.0,
              1.0,
              -sdTorus((p * vec3(1.0, 25.0, 1.0)) - bh, vec2(0.7, 0.8))
            );
            col += max(vec3(0.0), dcol * 4.8 * discMask * noncaptured);
          }

          float edgeDistance = min(
            min(v_uv.x, 1.0 - v_uv.x),
            min(v_uv.y, 1.0 - v_uv.y)
          );
          float edgeFade = smoothstep(0.0, 0.12, edgeDistance);
          float diskBrightness = max(col.r, max(col.g, col.b));
          float diskAlpha = smoothstep(0.00, 0.24, diskBrightness);
          col *= 1.0 - holeAlpha;
          // float alpha = holeAlpha + diskAlpha * (1.0 - holeAlpha);
          float alpha = holeAlpha + diskAlpha * diskAlpha * diskAlpha;
          // float alpha = holeAlpha;
          fragColor = vec4(col, alpha * edgeFade);
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
    this.textures.push(accretionTexture)

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
    this.camera.getWorldPosition(this.cameraPosition)
    this.group.parent?.updateMatrixWorld(true)
    this.viewDirection
      .copy(this.group.parent?.worldToLocal(this.cameraPosition) ?? this.cameraPosition)
      .sub(this.position)
      .normalize()
    this.blackHoleMaterial.uniforms['iViewDirection']!.value.copy(this.viewDirection)
    const rotationTime = this.reducedMotion ? 0 : seconds
    const diskNormal = this.blackHoleMaterial.uniforms['iDiskNormal']!.value as THREE.Vector3
    diskNormal
      .set(
        this.viewDirection.x * 0.35 + smoothRandom(rotationTime / 6.2, 2) * 0.45,
        1 + this.viewDirection.y * 0.35 + smoothRandom(rotationTime / 8.1, 5) * 0.35,
        this.viewDirection.z * 0.35 + smoothRandom(rotationTime / 7.3, 9) * 0.45,
      )
      .normalize()
    this.blackHoleMaterial.uniforms['iDiskRotation']!.value =
      smoothRandom(rotationTime / 5.4, 13) * Math.PI
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
    this.blackHoleMaterial.uniforms['iBlackHoleView']!.value = enabled ? 1 : 0
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
      const shaderScale = this.blackHoleView
        ? 1 / BLACK_HOLE_SHADER_COORDINATE_SCALE
        : GALAXY_BLACK_HOLE_VIEW_SCALE
      const shaderX = (uv.x * 2 - 1) * aspect * shaderScale
      const shaderY = (uv.y * 2 - 1) * shaderScale
      const hitRadius = this.blackHoleView
        ? BLACK_HOLE_PAGE_HIT_RADIUS
        : GALAXY_BLACK_HOLE_HIT_RADIUS
      return Math.hypot(shaderX, shaderY) <= hitRadius
    })
  }

  destroy(galaxy: THREE.Group) {
    galaxy.remove(this.group)
    this.geometries.forEach((geometry) => geometry.dispose())
    this.materials.forEach((material) => material.dispose())
    this.textures.forEach((texture) => texture.dispose())
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
