import type { Response } from 'express'
import {
  getGalaxyStarCollection,
  requireGalaxyStarUser,
  sendGalaxyStar,
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
    sendGalaxyStar(params, collection, user, res),
  )
}
