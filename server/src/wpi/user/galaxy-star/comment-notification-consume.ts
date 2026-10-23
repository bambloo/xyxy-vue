import type { Response } from 'express'
import {
  consumeGalaxyStarCommentNotification,
  getGalaxyStarCollection,
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
    consumeGalaxyStarCommentNotification(collection, user, res),
  )
}
