import { user_manager } from './user'
import { BamblooError, BamblooStatusCode } from '../../../../common/status'
import { errout, logout } from '../../util/logger-helper'
import { AiAstrologer } from '../../util/ai-astrologer'
import {
  current_time_index,
  time_name_for_index,
  type TimeName,
} from '../../util/daily-prompt-template'
import { format_local_day, format_timestamp, now } from '../../util/date-time'
import { mongo_helper } from '../../util/mongo-helper'
import type { User } from '../entity/user'

export interface FortuneGeneration {
  prompt: string
  message: string
}

export interface DailyFortune {
  _id: string
  userTag: string
  day: string
  fortune: FortuneGeneration
  time_fortune?: Partial<Record<TimeName, FortuneGeneration>>
  createdAt: string
}

const generating_que: string[] = []
const generating_map: Map<string, { daily_fortune: boolean; time_fortune: boolean }> = new Map()

function generate_daily_fortune(user: User, day: string) {
  const id = `${user.tag}:${day}`
  return mongo_helper.ddo(async (db) => {
    const fortunes = db.collection<DailyFortune>('daily_fortune')
    const markFortuneGenerated = async () => {
      const lastFortuneGeneratedAt = format_timestamp(new Date())
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
          time_fortune: {},
          createdAt: format_timestamp(now()),
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

function timeFortuneAt(record: DailyFortune, timeName: TimeName): FortuneGeneration | undefined {
  return record.time_fortune?.[timeName]
}

async function generate_time_fortune(user: User, day: string, timeIndex: number): Promise<void> {
  const id = `${user.tag}:${day}`
  const timeName = time_name_for_index(timeIndex)
  const record = await generate_daily_fortune(user, day)
  const existing = timeFortuneAt(record, timeName)
  if (existing?.prompt && existing.message) return

  const fortune = await AiAstrologer.instance.time_fortune(user, day, timeIndex)
  const result = await mongo_helper.ddo((db) =>
    db
      .collection<DailyFortune>('daily_fortune')
      .updateOne({ _id: id }, { $set: { [`time_fortune.${timeName}`]: fortune } }),
  )
  if (!result.matchedCount) {
    throw new Error(`未能保存用户 ${user.tag} 的 ${day} ${timeName} 锦言`)
  }
}

function generate_one_daily_fortune() {
  return user_manager.instance().then((um) => {
    if (!generating_que.length) {
      return um.get_without_daily_fortune().then((user) => {
        const day = format_local_day(new Date())
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
              const day = format_local_day(now())
              return generate_daily_fortune(user, day).then(() => {
                tri.daily_fortune = false
                logout(`已生成用户 ${user.tag} 的 ${day} 今日运势`)
              })
            }
          })
          .then(() => {
            if (tri.time_fortune) {
              const time = now()
              const day = format_local_day(time)
              const timeIndex = current_time_index(time)
              return generate_time_fortune(user, day, timeIndex).then(() => {
                tri.time_fortune = false
                logout(`已生成用户 ${user.tag} 的${time_name_for_index(timeIndex)}锦言`)
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
  daily_fortune_generating = false
  const datetime = now()
  const nextMidnight = new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate() + 1)
  scheduler = setTimeout(() => {
    scheduler = undefined
    daily_fortune_ticker()
  }, nextMidnight.getTime() - datetime.getTime())
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
        errout(BamblooStatusCode[err.code], err.msg)
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
