import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calculateDefaultViewQuaternion } from '@/scripts/core/galaxy/GalaxyManager'

describe('galaxy manager default view', () => {
  it.each([
    ['desktop HD', 1920, 1080],
    ['laptop', 1366, 768],
    ['mobile portrait', 390, 844],
    ['tablet portrait', 768, 1024],
    ['ultrawide', 3440, 1440],
  ])('keeps the black hole inset from the upper-right at %s resolution', (_name, width, height) => {
    const aspect = width / height
    const fov = 52
    const cameraPosition = new THREE.Vector3(120, -45, -170)
    const orientation = calculateDefaultViewQuaternion(cameraPosition, aspect, fov)
    const blackHoleDirection = new THREE.Vector3(0, 0, 980 * 0.3)
      .sub(cameraPosition)
      .normalize()
    const cameraDirection = blackHoleDirection.applyQuaternion(orientation.clone().invert())
    const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(fov / 2))
    const projectedX = cameraDirection.x / (-cameraDirection.z * aspect * halfFovTangent)
    const projectedY = cameraDirection.y / (-cameraDirection.z * halfFovTangent)

    expect(projectedX).toBeCloseTo(0.56, 10)
    expect(projectedY).toBeCloseTo(0.56, 10)
    expect((1 - projectedX) / 2).toBeCloseTo(0.22, 10)
    expect((1 - projectedY) / 2).toBeCloseTo(0.22, 10)
  })
})
