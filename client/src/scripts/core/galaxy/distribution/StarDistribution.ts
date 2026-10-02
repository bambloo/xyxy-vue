import * as THREE from 'three'

export type StarDistributionOptions = {
  count: number
  radius: number
}

export interface StarDistribution {
  generate(options: StarDistributionOptions): THREE.Vector3[]
}
