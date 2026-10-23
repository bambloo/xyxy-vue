import type { Response } from 'express'
import {
  getGalaxyStarCollection,
  getOptionalGalaxyStarUser,
  listGalaxyStars,
} from '../../../util/galaxy-star'
import type { WpiRequest } from '../../../util/wpi-access'

export const config = { access: 'public' as const }

export default function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  return getOptionalGalaxyStarUser(req, res).then((user) =>
    getGalaxyStarCollection().then((collection) =>
      listGalaxyStars(params, collection, user?.tag, res),
    ),
  )
}
