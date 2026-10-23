import type { Response } from 'express'
import {
  getGalaxyStarCollection,
  getOptionalGalaxyStarUser,
  listGalaxyStars,
} from '../../../util/galaxy-star'
import type { WpiRequest } from '../../../util/wpi-access'

export const config = { access: 'public' as const }

export default async function handler(
  params: Record<string, unknown>,
  req: WpiRequest,
  res: Response,
) {
  const user = await getOptionalGalaxyStarUser(req, res)
  const collection = await getGalaxyStarCollection()
  return listGalaxyStars(params, collection, user?.tag, res)
}
