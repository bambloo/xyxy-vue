import * as THREE from 'three'
import type { StarDistribution, StarDistributionOptions } from './StarDistribution'

export class UniformSphereDistribution implements StarDistribution {
  generate({ count, radius }: StarDistributionOptions) {
    const positions: THREE.Vector3[] = []
    for (let index = 0; index < count; index += 1) {
      const distance = Math.cbrt(Math.random()) * radius
      const polarAngle = Math.acos(1 - Math.random() * 2)
      const azimuth = Math.random() * Math.PI * 2
      const sinPolar = Math.sin(polarAngle)
      positions.push(
        new THREE.Vector3(
          Math.cos(azimuth) * sinPolar * distance,
          Math.cos(polarAngle) * distance,
          Math.sin(azimuth) * sinPolar * distance,
        ),
      )
    }
    return positions
  }
}
