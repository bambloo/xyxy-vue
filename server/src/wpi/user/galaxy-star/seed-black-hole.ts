import type { Response } from 'express'
import {
  getGalaxyStarCollection,
  requireGalaxyStarUser,
  seedGalaxyBlackHoleStars,
} from '../../../util/galaxy-star'
import type { WpiRequest } from '../../../util/wpi-access'

export const config = { access: 'protected' as const }

export default async function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const user = requireGalaxyStarUser(req)
  const collection = await getGalaxyStarCollection()
  return seedGalaxyBlackHoleStars(params, collection, user, res)
}
