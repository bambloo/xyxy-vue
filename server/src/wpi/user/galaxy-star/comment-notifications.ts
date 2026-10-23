import type { Response } from 'express'
import {
  getGalaxyStarCollection,
  getGalaxyStarCommentNotifications,
  requireGalaxyStarUser,
} from '../../../util/galaxy-star'
import type { WpiRequest } from '../../../util/wpi-access'

export const config = { access: 'protected' as const }

export default function handler(
  _params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const user = requireGalaxyStarUser(req)
  return getGalaxyStarCollection().then((collection) =>
    getGalaxyStarCommentNotifications(collection, user, res),
  )
}
