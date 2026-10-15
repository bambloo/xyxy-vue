export const TIME_FORTUNE_OPEN_EVENT = 'time-fortune:open'
export const TIME_FORTUNE_TOGGLE_EVENT = 'time-fortune:toggle'
export const TIME_FORTUNE_HISTORY_EVENT = 'time-fortune:history'
export const TIME_FORTUNE_STATE_EVENT = 'time-fortune:state'
export const TIME_FORTUNE_DISMISSED_EVENT = 'time-fortune:dismissed'

let timeFortuneReady = false

function locatorStorageKey(userTag: string) {
  const now = new Date()
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  const timeIndex = Math.floor(((now.getHours() + 1) % 24) / 2)
  return `bambloo-time-fortune-locator:${userTag}:${day}:${timeIndex}`
}

export function isTimeFortuneLocatorDismissed(userTag: string) {
  return localStorage.getItem(locatorStorageKey(userTag)) === 'true'
}

export function dismissTimeFortuneLocator(userTag: string) {
  localStorage.setItem(locatorStorageKey(userTag), 'true')
  window.dispatchEvent(new Event(TIME_FORTUNE_DISMISSED_EVENT))
}

export function setTimeFortuneReady(ready: boolean) {
  timeFortuneReady = ready
  window.dispatchEvent(new CustomEvent(TIME_FORTUNE_STATE_EVENT, { detail: ready }))
}

export function isTimeFortuneReady() {
  return timeFortuneReady
}
