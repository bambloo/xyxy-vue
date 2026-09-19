import type { Request, Response } from 'express'
import { read, utils } from 'xlsx'
import { BamblooStatusCode } from '../../../../common/status'
import { user_manager } from '../../core/manager/user'
import { response } from '../../util/secretary'
import { refresh_session } from '../../util/session'

function parseIds(fileName: string, content: Buffer) {
  if (fileName.toLowerCase().endsWith('.txt')) {
    return content
      .toString('utf8')
      .split(/[\s,;，；]+/)
      .map((id) => id.trim())
      .filter((id) => id && !/^(id|user_?id|用户id)$/i.test(id))
  }

  const workbook = read(content, { type: 'buffer', cellDates: false })
  const values = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    return utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  })

  return values
    .flat()
    .map((value) => String(value).trim())
    .filter((id) => id && !/^(id|user_?id|用户id)$/i.test(id))
}

export default function handler(params: { [key: string]: unknown }, req: Request, res: Response) {
  const session = refresh_session(req, res)
  if (!session) return response(res, BamblooStatusCode.Unauthorized, '登录已失效')

  const fileName = typeof params.fileName === 'string' ? params.fileName : ''
  const contentBase64 = typeof params.contentBase64 === 'string' ? params.contentBase64 : ''
  if (!fileName || !contentBase64 || !/\.(txt|xls|xlsx)$/i.test(fileName)) {
    return response(res, BamblooStatusCode.FormatError, '仅支持 TXT、XLS 或 XLSX 文件')
  }

  let ids: string[]
  try {
    ids = parseIds(fileName, Buffer.from(contentBase64, 'base64'))
  } catch {
    return response(res, BamblooStatusCode.FormatError, '文件解析失败')
  }
  if (ids.length === 0) {
    return response(res, BamblooStatusCode.FormatError, '文件中没有找到用户 ID')
  }

  return user_manager
    .instance()
    .then((manager) =>
      manager.get({ id: session.payload.userId }).then((operator) => ({ manager, operator })),
    )
    .then(({ manager, operator }) => {
      if (!operator.isAdmin) {
        return response(res, BamblooStatusCode.Unauthorized, '只有管理员可以导入用户')
      }
      return manager.importInactiveIds(ids).then((users) =>
        response(res, BamblooStatusCode.Success, '用户导入成功', {
          users: users.map(({ passwordHash: _passwordHash, ...user }) => user),
          count: users.length,
        }),
      )
    })
    .catch(() => response(res, BamblooStatusCode.BadRequest, '用户导入失败'))
}
