<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import {
  dismissTimeFortuneLocator,
  setTimeFortuneReady,
  TIME_FORTUNE_HISTORY_EVENT,
  TIME_FORTUNE_OPEN_EVENT,
  TIME_FORTUNE_TOGGLE_EVENT,
} from '@/events/time-fortune'

interface TimeFortune {
  timeName: string
  message: string
}

interface FortuneDay {
  date: string
  dailyFortune: string
  timeFortunes: TimeFortune[]
}

interface FortuneDetails {
  ready?: boolean
  timeName: string
  days: FortuneDay[]
}

const auth = useAuthStore()
const { t } = useI18n()
const requestLoading = ref(false)
const detailsLoading = ref(false)
const runId = ref(0)
const status = ref<'hidden' | 'generating' | 'arriving' | 'ready'>('hidden')
const dialogOpen = ref(false)
const detailsError = ref('')
const details = ref<FortuneDetails>()
const fortuneDialog = ref<HTMLElement | null>(null)
let dragStart: { pointerId: number; y: number; scrollTop: number } | undefined

function responseData(packet: { data?: unknown }): FortuneDetails | undefined {
  return packet.data as FortuneDetails | undefined
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

watch(
  () => [auth.currentUser?.tag, auth.isSessionValidated] as const,
  async ([userTag, isSessionValidated]) => {
    const currentRun = ++runId.value
    if (!auth.isLoggedIn) {
      status.value = 'hidden'
      setTimeFortuneReady(false)
      dialogOpen.value = false
      details.value = undefined
      return
    }

    if (!isSessionValidated || !userTag) {
      status.value = 'hidden'
      await auth.hydrate()
      return
    }

    setTimeFortuneReady(false)
    status.value = 'generating'
    let shouldTrigger = true
    while (currentRun === runId.value) {
      try {
        const packet = await post('/wpi/user/time-fortune', requestLoading, {
          trigger: shouldTrigger,
        })
        shouldTrigger = false
        if (currentRun !== runId.value) return
        if (responseData(packet)?.ready) {
          setTimeFortuneReady(true)
          status.value = 'arriving'
          await wait(1500)
          if (currentRun !== runId.value) return
          status.value = 'ready'
          return
        }
      } catch (error) {
        if (currentRun !== runId.value) return
        console.error('查询时辰锦言生成状态失败', error)
      }
      await wait(2000)
    }
  },
  { immediate: true },
)

async function openFortuneDialog(dismissLocator: boolean) {
  if (dismissLocator) {
    const userTag = auth.currentUser?.tag
    if (userTag) dismissTimeFortuneLocator(userTag)
  }
  dialogOpen.value = true
  detailsError.value = ''
  details.value = undefined
  if (status.value === 'hidden') {
    detailsError.value = '请先登录后查看星言星语。'
    return
  }

  detailsLoading.value = true
  try {
    const packet = await post('/wpi/user/time-fortune', detailsLoading, { history: true })
    const result = responseData(packet)
    if (!result || !Array.isArray(result.days)) {
      throw new Error('星言星语暂不可用，请稍后重试。')
    }
    details.value = result
  } catch (error) {
    detailsError.value =
      (error as { msg?: string; message?: string }).msg ||
      (error as { message?: string }).message ||
      '锦言加载失败，请稍后重试。'
  } finally {
    detailsLoading.value = false
  }
}

function timeRange(timeName: string) {
  const timeNames = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时']
  const index = timeNames.indexOf(timeName)
  if (index < 0) return ''
  const startHour = (23 + index * 2) % 24
  const endHour = (startHour + 2) % 24
  const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`
  return `${formatHour(startHour)}-${formatHour(endHour)}`
}

function handleLocatorOpen() {
  void openFortuneDialog(true)
}

function handleHistoryOpen() {
  void openFortuneDialog(false)
}

function handleButtonToggle() {
  if (dialogOpen.value) {
    dialogOpen.value = false
    return
  }
  void openFortuneDialog(false)
}

function handleDialogPointerDown(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  const target = event.target
  if (target instanceof Element && target.closest('button, summary')) return
  const dialog = fortuneDialog.value
  if (!dialog || dialog.scrollHeight <= dialog.clientHeight) return
  event.preventDefault()
  dragStart = { pointerId: event.pointerId, y: event.clientY, scrollTop: dialog.scrollTop }
  dialog.setPointerCapture(event.pointerId)
}

function handleDialogPointerMove(event: PointerEvent) {
  if (!dragStart || dragStart.pointerId !== event.pointerId) return
  const dialog = fortuneDialog.value
  if (!dialog) return
  dialog.scrollTop = dragStart.scrollTop + dragStart.y - event.clientY
}

function clearDialogDrag(event: PointerEvent) {
  if (dragStart?.pointerId !== event.pointerId) return
  dragStart = undefined
}

onMounted(() => {
  window.addEventListener(TIME_FORTUNE_OPEN_EVENT, handleLocatorOpen)
  window.addEventListener(TIME_FORTUNE_HISTORY_EVENT, handleHistoryOpen)
  window.addEventListener(TIME_FORTUNE_TOGGLE_EVENT, handleButtonToggle)
})

onBeforeUnmount(() => {
  window.removeEventListener(TIME_FORTUNE_OPEN_EVENT, handleLocatorOpen)
  window.removeEventListener(TIME_FORTUNE_HISTORY_EVENT, handleHistoryOpen)
  window.removeEventListener(TIME_FORTUNE_TOGGLE_EVENT, handleButtonToggle)
  runId.value += 1
  dragStart = undefined
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fortune-dialog">
      <div v-if="dialogOpen" class="fortune-overlay" @click.self="dialogOpen = false">
        <section
          ref="fortuneDialog"
          class="fortune-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fortune-title"
          @pointerdown="handleDialogPointerDown"
          @pointermove="handleDialogPointerMove"
          @pointerup="clearDialogDrag"
          @pointercancel="clearDialogDrag"
        >
          <button class="dialog-close" type="button" aria-label="关闭" @click="dialogOpen = false">×</button>
          <p class="dialog-eyebrow">Words From the Stars</p>
          <h2 id="fortune-title">{{ t('timeFortune.title') }}</h2>
          <p v-if="detailsLoading" class="dialog-status">正在读取星辰讯息…</p>
          <p v-else-if="detailsError" class="dialog-status dialog-error" role="alert">
            {{ detailsError }}
          </p>
          <template v-else-if="details">
            <p v-if="!details.days.length" class="dialog-status">最近七天暂无星言星语。</p>
            <details
              v-for="(day, index) in details.days"
              :key="day.date"
              class="fortune-day"
              :open="index === 0"
            >
              <summary>{{ day.date }}</summary>
              <article v-if="day.dailyFortune" class="fortune-entry">
                <h3>每日锦言</h3>
                <p>{{ day.dailyFortune }}</p>
              </article>
              <article
                v-for="fortune in day.timeFortunes"
                :key="fortune.timeName"
                :class="[
                  'fortune-entry',
                  'time-entry',
                  {
                    'current-time-entry':
                      index === 0 && fortune.timeName === details.timeName,
                  },
                ]"
              >
                <h3>
                  {{ fortune.timeName }}（{{ timeRange(fortune.timeName) }}）· 时辰锦言
                  <span
                    v-if="index === 0 && fortune.timeName === details.timeName"
                    class="current-time-label"
                  >当前时辰</span>
                </h3>
                <p>{{ fortune.message }}</p>
              </article>
            </details>
          </template>
          <div class="dialog-ornament" aria-hidden="true">✦　✧　✦</div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fortune-overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(1, 7, 19, .76);
  backdrop-filter: blur(12px);
}

.fortune-dialog {
  position: relative;
  width: min(100%, 520px);
  max-height: min(80vh, 720px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  touch-action: pan-y;
  cursor: grab;
  padding: 34px clamp(24px, 6vw, 48px) 24px;
  border: 1px solid rgba(163, 207, 255, .38);
  border-radius: 24px;
  background:
    radial-gradient(ellipse at 50% 0, rgba(103, 159, 231, .2), transparent 54%),
    linear-gradient(145deg, rgba(13, 34, 65, .98), rgba(5, 15, 32, .98));
  box-shadow: 0 28px 90px rgba(0, 0, 0, .55), inset 0 0 36px rgba(121, 175, 241, .08);
  color: #e8f1fb;
}

.fortune-dialog::-webkit-scrollbar {
  display: none;
}

.fortune-dialog:active {
  cursor: grabbing;
}

.dialog-close {
  position: absolute;
  top: 12px;
  right: 16px;
  border: 0;
  background: transparent;
  color: #b7cde4;
  font-size: 28px;
  cursor: pointer;
}

.dialog-eyebrow {
  margin: 0;
  color: #96bce7;
  font-size: 10px;
  letter-spacing: .24em;
  text-align: center;
}

.fortune-dialog h2 {
  margin: 8px 0 26px;
  color: #f4e6bf;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: .18em;
  text-align: center;
}

.fortune-entry {
  padding: 18px 20px;
  border: 1px solid rgba(149, 186, 227, .17);
  border-radius: 16px;
  background: rgba(137, 177, 226, .07);
}

.fortune-day {
  margin-top: 12px;
}

.fortune-day summary {
  padding: 13px 16px;
  border: 1px solid rgba(149, 186, 227, .22);
  border-radius: 12px;
  background: rgba(137, 177, 226, .1);
  color: #f4e6bf;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  list-style-position: inside;
}

.fortune-day[open] summary {
  margin-bottom: 12px;
  border-color: rgba(163, 207, 255, .38);
}

.fortune-entry+.fortune-entry {
  margin-top: 14px;
}

.fortune-entry h3 {
  margin: 0 0 10px;
  color: #edc981;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: .08em;
}

.fortune-entry p {
  margin: 0;
  color: #e7eef8;
  font-size: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.current-time-entry {
  border-color: rgba(240, 189, 99, .72);
  background: linear-gradient(135deg, rgba(240, 189, 99, .16), rgba(137, 177, 226, .08));
  box-shadow: inset 0 0 24px rgba(240, 189, 99, .08), 0 0 18px rgba(240, 189, 99, .08);
}

.current-time-entry h3 {
  color: #f5d58e;
}

.current-time-label {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 7px;
  border: 1px solid rgba(240, 189, 99, .5);
  border-radius: 999px;
  color: #f5d58e;
  font-size: 10px;
  letter-spacing: .04em;
  vertical-align: 1px;
}

.dialog-status {
  min-height: 80px;
  display: grid;
  place-items: center;
  color: #c3d7ee;
  text-align: center;
}

.dialog-error {
  color: #ffb6a8;
}

.dialog-ornament {
  margin-top: 22px;
  color: #83a9d4;
  font-size: 12px;
  letter-spacing: .35em;
  text-align: center;
}

.fortune-dialog-enter-active,
.fortune-dialog-leave-active {
  transition: opacity 220ms ease;
}

.fortune-dialog-enter-active .fortune-dialog,
.fortune-dialog-leave-active .fortune-dialog {
  transition: transform 220ms ease;
}

.fortune-dialog-enter-from,
.fortune-dialog-leave-to {
  opacity: 0;
}

.fortune-dialog-enter-from .fortune-dialog,
.fortune-dialog-leave-to .fortune-dialog {
  transform: translateY(12px) scale(.98);
}
</style>
