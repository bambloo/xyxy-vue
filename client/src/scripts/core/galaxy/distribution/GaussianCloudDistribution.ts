import * as THREE from 'three'
import type { StarDistribution, StarDistributionOptions } from './StarDistribution'

export class GaussianCloudDistribution implements StarDistribution {
  generate({ count, radius }: StarDistributionOptions) {
    const positions: THREE.Vector3[] = []
    const deviation = radius * 0.28
    for (let index = 0; index < count; index += 1) {
      positions.push(
        new THREE.Vector3(
          this.randomNormal() * deviation,
          this.randomNormal() * deviation * 0.34,
          this.randomNormal() * deviation,
        ),
      )
    }
    return positions
  }

  private randomNormal() {
    const first = Math.max(Math.random(), Number.EPSILON)
    const second = Math.random()
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * second)
  }
}
