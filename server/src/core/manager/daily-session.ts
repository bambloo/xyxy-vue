import { mongo_helper } from '../../util/mongo-helper'
import { format_local_day, format_timestamp } from '../../util/date-time'

export class daily_session_manager {
  public static recordLogin(userTag: string, now = new Date()) {
    const day = format_local_day(now)
    const timestamp = format_timestamp(now)

    return mongo_helper.ddo((db) =>
      db
        .collection<{
          _id: string
          userTag: string
          day: string
          state: string
          createdAt: string
          lastLoginAt: string
          loginCount: number
        }>('user_daily_session')
        .updateOne(
          { _id: `${userTag}:${day}` },
          {
            $setOnInsert: {
              userTag,
              day,
              state: 'active',
              createdAt: timestamp,
            },
            $set: { lastLoginAt: timestamp },
            $inc: { loginCount: 1 },
          },
          { upsert: true },
        ),
    )
  }

  public static getConsecutiveLoginDays(userTag: string, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const earliestDay = new Date(today)
    earliestDay.setDate(earliestDay.getDate() - 6)
    const earliestDayKey = format_local_day(earliestDay)

    return mongo_helper.ddo((db) =>
      db
        .collection<{ day: string }>('user_daily_session')
        .find({ userTag, day: { $gte: earliestDayKey } }, { projection: { _id: 0, day: 1 } })
        .sort({ day: -1 })
        .limit(7)
        .toArray()
        .then((sessions) => {
          const loginDays = new Set(sessions.map(({ day }) => day))
          let streak = 0
          const candidate = new Date(today)
          while (streak < 7 && loginDays.has(format_local_day(candidate))) {
            streak += 1
            candidate.setDate(candidate.getDate() - 1)
          }
          return streak
        }),
    )
  }
}
