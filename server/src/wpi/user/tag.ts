import type { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'

export const config = { access: 'public' as const }

export default function handler(params: { [key: string]: string }, _req: Request, res: Response) {
  if (!params.tag) {
    response(res, BamblooStatusCode.BadRequest, '缺少 Tag')
    return
  }

  user_manager
    .instance()
    .then((manager) => manager.get({ tag: params.tag }))
    .then(() => response(res, BamblooStatusCode.Success))
    .catch(() => response(res, BamblooStatusCode.EntityNonexist, 'Tag 不存在'))
}
