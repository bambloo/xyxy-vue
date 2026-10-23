import type { Response } from 'express'
import {
  getGalaxyStarCollection,
  getGalaxyStarStatus,
  requireGalaxyStarUser,
} from '../../../util/galaxy-star'
import type { WpiRequest } from '../../../util/wpi-access'

export const config = { access: 'protected' as const }

export default async function handler(
  _params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const user = requireGalaxyStarUser(req)
  const collection = await getGalaxyStarCollection()
  return getGalaxyStarStatus(collection, user, res)
}
