import type { Response } from 'express'
import {
  getGalaxyStarCollection,
  requireGalaxyStarUser,
  seedGalaxyBlackHoleStars,
} from '../../../util/galaxy-star'
import type { WpiRequest } from '../../../util/wpi-access'

export const config = { access: 'protected' as const }

export default function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const user = requireGalaxyStarUser(req)
  return getGalaxyStarCollection().then((collection) =>
    seedGalaxyBlackHoleStars(params, collection, user, res),
  )
}
