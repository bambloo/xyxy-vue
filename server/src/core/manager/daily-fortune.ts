import type { UserProfile } from '../entity/user'
import { errout, logout } from '../../util/logger-helper'
import { mongo_helper } from '../../util/mongo-helper'
import { AiAstrologer } from '../../util/ai-astrologer'

interface DailyFortune {
  _id: string
  userTag: string
  day: string
  fortune: string
  createdAt: string
}

const astrologer = new AiAstrologer()
let running = false
let started = false

export function generate_missing_daily_fortunes(now = new Date()): Promise<void> {
  if (running) return Promise.resolve()
  running = true

  const day = now.toISOString().slice(0, 10)
  const processedTags = new Set<string>()

  const processNextUser = (): Promise<void> =>
    mongo_helper
      .ddo((db) =>
        db.collection<UserProfile>('user').findOne({
          isActive: { $ne: false },
          tag: { $nin: [...processedTags] },
        }),
      )
      .then((user) => {
        if (!user) return

        const id = `${user.tag}:${day}`
        return mongo_helper
          .ddo((db) => db.collection<DailyFortune>('daily_fortune').findOne({ _id: id }))
          .then((existing) => {
            if (existing) {
              processedTags.add(user.tag)
              return processNextUser()
            }

            const question = [
              `请为用户生成 ${day} 的今日运势。`,
              user.name ? `称呼：${user.name}` : '',
              user.birthday ? `出生日期：${user.birthday}` : '',
              user.hobbies ? `兴趣：${user.hobbies}` : '',
              '请简洁给出整体运势、感情、事业与一条温和的今日建议，并明确这是娱乐和自我探索参考。',
            ]
              .filter(Boolean)
              .join('\n')

            return astrologer
              .ask(question)
              .then((fortune) =>
                mongo_helper.ddo((db) =>
                  db.collection<DailyFortune>('daily_fortune').updateOne(
                    { _id: id },
                    {
                      $setOnInsert: {
                        _id: id,
                        userTag: user.tag,
                        day,
                        fortune,
                        createdAt: new Date().toISOString(),
                      },
                    },
                    { upsert: true },
                  ),
                ),
              )
              .then(() => {
                processedTags.add(user.tag)
                logout(`已生成用户 ${user.tag} 的 ${day} 今日运势`)
                return processNextUser()
              })
              .catch((error) => {
                errout(`生成用户 ${user.tag} 的今日运势失败`, error)
                throw error
              })
          })
      })

  return processNextUser().finally(() => {
    running = false
  })
}

export function start_daily_fortune_schedule() {
  if (started) return
  started = true

  const runAndSchedule = () => {
    generate_missing_daily_fortunes()
      .then(() => {
        const now = new Date()
        const nextRun = new Date(now)
        nextRun.setUTCHours(0, 5, 0, 0)
        if (nextRun.getTime() <= now.getTime()) nextRun.setUTCDate(nextRun.getUTCDate() + 1)
        setTimeout(runAndSchedule, nextRun.getTime() - Date.now())
      })
      .catch((error) => {
        errout('每日运势任务执行失败，将在一分钟后重试', error)
        setTimeout(runAndSchedule, 60_000)
      })
  }

  runAndSchedule()
}
