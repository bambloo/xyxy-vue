import * as THREE from 'three'
import type { StarDistribution, StarDistributionOptions } from './StarDistribution'

export class SpiralGalaxyDistribution implements StarDistribution {
  generate({ count, radius }: StarDistributionOptions) {
    const positions: THREE.Vector3[] = []
    const arms = 5
    for (let index = 0; index < count; index += 1) {
      const distance = Math.pow(Math.random(), 0.72) * radius
      const arm = index % arms
      const angle = arm * ((Math.PI * 2) / arms) + distance * 0.014 + (Math.random() - 0.5) * 0.58
      const width = radius * (0.025 + (distance / radius) * 0.12)
      const offset = (Math.random() - 0.5) * width
      positions.push(
        new THREE.Vector3(
          Math.cos(angle) * distance + offset,
          this.randomNormal() * radius * 0.045,
          Math.sin(angle) * distance + offset,
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
