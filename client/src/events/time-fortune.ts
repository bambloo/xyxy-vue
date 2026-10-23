export const TIME_FORTUNE_TOGGLE_EVENT = 'time-fortune:toggle'
export const TIME_FORTUNE_HISTORY_EVENT = 'time-fortune:history'
export const TIME_FORTUNE_DIALOG_STATE_EVENT = 'time-fortune:dialog-state'
export const TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT = 'time-fortune:first-visit-meteor'
export const TIME_FORTUNE_FIRST_VISIT_METEOR_STARTED_EVENT =
  'time-fortune:first-visit-meteor-started'
export const TIME_FORTUNE_FIRST_VISIT_METEOR_READY_EVENT = 'time-fortune:first-visit-meteor-ready'
export const TIME_FORTUNE_FIRST_VISIT_METEOR_ARRIVED_EVENT =
  'time-fortune:first-visit-meteor-arrived'
export const TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT = 'time-fortune:first-visit-meteor-cancel'

function openedStorageKey(userTag: string) {
  return `bambloo-time-fortune-opened:${userTag}:${localDateKey()}`
}

function dailyFirstVisitStorageKey(userTag: string) {
  return `bambloo-time-fortune-first-visit:${userTag}:${localDateKey()}`
}

function localDateKey() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

export function hasOpenedTimeFortune(userTag: string) {
  return localStorage.getItem(openedStorageKey(userTag)) === 'true'
}

export function markTimeFortuneOpened(userTag: string) {
  localStorage.setItem(openedStorageKey(userTag), 'true')
}

export function hasCompletedDailyFirstVisit(userTag: string) {
  return localStorage.getItem(dailyFirstVisitStorageKey(userTag)) === 'true'
}

export function markDailyFirstVisitCompleted(userTag: string) {
  localStorage.setItem(dailyFirstVisitStorageKey(userTag), 'true')
}
