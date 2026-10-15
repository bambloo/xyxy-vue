import type { Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { trigger_fortune_generation } from '../../core/manager/daily-fortune'
import { response } from '../../util/secretary'
import type { WpiRequest } from '../../util/wpi-access'
import { format_local_day } from '../../util/date-time'

export const config = { access: 'protected' as const }

export default function handler(params: Record<string, unknown>, req: WpiRequest, res: Response) {
  const user = req.user
  if (!user) {
    return response(res, BamblooStatusCode.Unauthorized, '需要登录后访问')
  }

  const now = new Date()
  const day = format_local_day(now)
  if (params.history === true) {
    return user.get_time_fortune_history(now).then((history) =>
      response(res, BamblooStatusCode.Success, undefined, history),
    )
  }

  return user.get_time_fortune(day, now).then((fortune) => {
    if (!fortune.ready && params.trigger === true) {
      trigger_fortune_generation(user.tag, false, true)
    }
    const data =
      params.details === true
        ? fortune
        : { ready: fortune.ready, timeName: fortune.timeName }
    return response(res, BamblooStatusCode.Success, undefined, data)
  })
}
