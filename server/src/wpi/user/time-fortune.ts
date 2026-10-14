import type { Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { trigger_fortune_generation } from '../../core/manager/daily-fortune'
import { current_time_name } from '../../util/daily-prompt-template'
import { mongo_helper } from '../../util/mongo-helper'
import { response } from '../../util/secretary'
import type { WpiRequest } from '../../util/wpi-access'
import { format_local_day } from '../../util/date-time'

export const config = { access: 'protected' as const }

interface TimeFortuneRecord {
  _id: string
  fortune?: { prompt: string; message: string }
  time_fortune?: Record<string, { prompt: string; message: string }>
}

export default function handler(params: Record<string, unknown>, req: WpiRequest, res: Response) {
  const userTag = req.auth?.userTag
  if (!userTag) {
    return response(res, BamblooStatusCode.Unauthorized, '需要登录后访问')
  }

  const now = new Date()
  const day = format_local_day(now)
  const timeName = current_time_name(now)
  const id = `${userTag}:${day}`

  return mongo_helper
    .ddo((db) => db.collection<TimeFortuneRecord>('daily_fortune').findOne({ _id: id }))
    .then((record) => {
      const fortune = record?.time_fortune?.[timeName]
      const ready = Boolean(fortune?.prompt && fortune.message)
      if (!ready && params.trigger === true) {
        trigger_fortune_generation(userTag, false, true)
      }
      return response(
        res,
        BamblooStatusCode.Success,
        undefined,
        params.details === true && ready
          ? {
              ready,
              timeName,
              dailyFortune: record?.fortune?.message ?? '',
              timeFortune: fortune?.message,
            }
          : { ready, timeName },
      )
    })
}
