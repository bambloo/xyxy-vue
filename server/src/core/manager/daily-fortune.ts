import { user_manager } from './user'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { errout, logout } from '../../util/logger-helper'
import { AiAstrologer } from '../../util/ai-astrologer'
import { mongo_helper } from '../../util/mongo-helper'
import type { User } from '../entity/user'

export interface DailyFortune {
  _id: string
  userTag: string
  day: string
  fortune: string
  time_fortune: Map<number, string>
  createdAt: string
}

// export function generate_daily_fortune_for_user(user: UserProfile, day: string): Promise<void> {
//   const id = `${user.tag}:${day}`
//   return mongo_helper
//     .ddo((db) => db.collection<DailyFortune>('daily_fortune').findOne({ _id: id }))
//     .then((existing) => {
//       if (existing) return

//       const question = build_daily_prompt(user, day)
//       return astrologer
//         .ask(question)
//         .then((fortune) =>
//           mongo_helper.ddo((db) =>
//             db.collection<DailyFortune>('daily_fortune').updateOne(
//               { _id: id },
//               {
//                 $setOnInsert: {
//                   _id: id,
//                   userTag: user.tag,
//                   day,
//                   fortune,
//                   createdAt: new Date().toISOString(),
//                 },
//               },
//               { upsert: true },
//             ),
//           ),
//         )
//         .then(() => {
//           logout(`已生成用户 ${user.tag} 的 ${day} 今日运势`)
//         })
//         .catch((error) => {
//           errout(`生成用户 ${user.tag} 的今日运势失败`, error)
//           throw error
//         })
//     })
// }

// export function generate_missing_daily_fortunes(now = new Date()): Promise<void> {
//   if (running) return Promise.resolve()
//   running = true

//   const day = now.toISOString().slice(0, 10)
//   const processedTags = new Set<string>()

//   const processNextUser = (): Promise<void> =>
//     mongo_helper
//       .ddo((db) =>
//         db.collection<UserProfile>('user').findOne({
//           isActive: { $ne: false },
//           tag: { $nin: [...processedTags] },
//         }),
//       )
//       .then((user) => {
//         if (!user) return

//         const id = `${user.tag}:${day}`
//         return mongo_helper
//           .ddo((db) => db.collection<DailyFortune>('daily_fortune').findOne({ _id: id }))
//           .then((existing) => {
//             if (existing) {
//               processedTags.add(user.tag)
//               return processNextUser()
//             }

//             const question = build_daily_prompt(user, day)

//             return astrologer
//               .ask(question)
//               .then((fortune) =>
//                 mongo_helper.ddo((db) =>
//                   db.collection<DailyFortune>('daily_fortune').updateOne(
//                     { _id: id },
//                     {
//                       $setOnInsert: {
//                         _id: id,
//                         userTag: user.tag,
//                         day,
//                         fortune,
//                         createdAt: new Date().toISOString(),
//                       },
//                     },
//                     { upsert: true },
//                   ),
//                 ),
//               )
//               .then(() => {
//                 processedTags.add(user.tag)
//                 logout(`已生成用户 ${user.tag} 的 ${day} 今日运势`)
//                 return processNextUser()
//               })
//               .catch((error) => {
//                 errout(`生成用户 ${user.tag} 的今日运势失败`, error)
//                 throw error
//               })
//           })
//       })

//   return processNextUser().finally(() => {
//     running = false
//   })
// }

const generating_que: string[] = []
const generating_map: Map<string, { daily_fortune: boolean; time_fortune: boolean }> = new Map()

function generate_daily_fortune(user: User, day: string) {
  const id = `${user.tag}:${day}`
  return mongo_helper.ddo(async (db) => {
    const fortunes = db.collection<DailyFortune>('daily_fortune')
    const markFortuneGenerated = async () => {
      const lastFortuneGeneratedAt = new Date().toISOString()
      await db.collection('user').updateOne({ tag: user.tag }, { $set: { lastFortuneGeneratedAt } })
      user.lastFortuneGeneratedAt = lastFortuneGeneratedAt
    }

    const existing = await fortunes.findOne({ _id: id })
    if (existing) {
      await markFortuneGenerated()
      return existing
    }

    const fortune = await AiAstrologer.instance.daily_fortune(user, day)
    await fortunes.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          _id: id,
          userTag: user.tag,
          day,
          fortune,
          time_fortune: new Map<number, string>(),
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    )

    const record = await fortunes.findOne({ _id: id })
    if (!record) {
      throw new Error(`未能保存用户 ${user.tag} 的 ${day} 今日运势`)
    }

    await markFortuneGenerated()
    return record
  })
}

function generate_one_daily_fortune() {
  return user_manager.instance().then((um) => {
    if (!generating_que.length) {
      return um.get_without_daily_fortune().then((user) => {
        const day = new Date().toISOString().slice(0, 10)
        return generate_daily_fortune(user, day).then(() => {
          logout(`已生成用户 ${user.tag} 的 ${day} 今日运势`)
        })
      })
    }

    const tag = generating_que[0]!
    const tri = generating_map.get(tag)!

    return um
      .get({ tag })
      .then((user) => {
        return Promise.resolve()
          .then(() => {
            if (tri.daily_fortune) {
              const day = new Date().toISOString().slice(0, 10)
              return generate_daily_fortune(user, day).then(() => {
                tri.daily_fortune = false
                logout(`已生成用户 ${user.tag} 的 ${day} 今日运势`)
              })
            }
          })
          .then(() => {
            if (tri.time_fortune) {
              return user.ask_time_fortune(new Date().toISOString().slice(0, 10)).then(() => {
                tri.time_fortune = false
                logout(`已生成用户 ${user.tag} 的时辰运势`)
              })
            }
          })
      })
      .then(() => {
        logout(`已完成用户 ${tag} 的运势生成`)
        generating_que.shift()
        generating_map.delete(tag)
      })
  })
}
let daily_fortune_generating = false
let scheduler: NodeJS.Timeout | undefined

function schedule_next_midnight() {
  const now = new Date()
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  scheduler = setTimeout(() => {
    scheduler = undefined
    daily_fortune_ticker()
  }, nextMidnight - now.getTime())
}

function daily_fortune_ticker() {
  generate_one_daily_fortune()
    .then(() => {
      process.nextTick(daily_fortune_ticker)
    })
    .catch((err: unknown) => {
      if (err instanceof BamblooError) {
        if (err.code === BamblooStatusCode.DailyFortuneGenerated) {
          schedule_next_midnight()
        }
        if (err.code === BamblooStatusCode.Retry) {
          setTimeout(daily_fortune_ticker, 30_000)
        }
        errout(err.msg)
      }
    })
}

export function start_daily_fortune_schedule() {
  if (daily_fortune_generating) return
  daily_fortune_generating = true

  if (scheduler) {
    clearTimeout(scheduler)
  }

  process.nextTick(daily_fortune_ticker)
}

export function trigger_fortune_generation(
  tag: string,
  daily_fortune?: boolean,
  time_fortune?: boolean,
) {
  if (!generating_map.has(tag)) {
    generating_map.set(tag, { daily_fortune: false, time_fortune: false })
    generating_que.push(tag)
  }

  const entry = generating_map.get(tag)!
  if (daily_fortune) {
    entry.daily_fortune = true
  }
  if (time_fortune) {
    entry.time_fortune = true
  }

  start_daily_fortune_schedule()
}
