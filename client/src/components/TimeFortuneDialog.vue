<script setup lang="ts">
import '@/styles/daily-fortune.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import {
  GALAXY_STAR_COMPOSE_EVENT,
  GALAXY_STAR_COMPOSER_STATE_EVENT,
  type GalaxyStarComposeOptions,
} from '@/events/galaxy-star'
import TimeFortuneHistory from '@/components/TimeFortuneHistory.vue'
import UserProfileEditDialog from '@/components/UserProfileEditDialog.vue'
import SiteInfoView from '@/views/user/SiteInfoView.vue'
import { timeFortuneRange } from '@/utils/time-fortune'
import {
  hasCompletedDailyFirstVisit,
  markDailyFirstVisitCompleted,
  markTimeFortuneOpened,
  TIME_FORTUNE_CLOSE_EVENT,
  TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT,
  type PairedDialogView,
  TIME_FORTUNE_DIALOG_STATE_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_ARRIVED_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_READY_EVENT,
  TIME_FORTUNE_FIRST_VISIT_METEOR_STARTED_EVENT,
  TIME_FORTUNE_HISTORY_EVENT,
  TIME_FORTUNE_TOGGLE_EVENT,
  type FirstVisitMeteorRequest,
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
  history: boolean
  dailyFortune?: string
  timeFortunes?: TimeFortune[]
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const activationTag = computed(() =>
  typeof route.query.activationTag === 'string' ? route.query.activationTag.trim() : '',
)
const isActivationPreview = computed(
  () => route.name === 'galaxy' && Boolean(activationTag.value) && !auth.isLoggedIn,
)
const requestLoading = ref(false)
const detailsLoading = ref(false)
const runId = ref(0)
const status = ref<'hidden' | 'generating' | 'arriving' | 'ready'>('hidden')
const dialogOpen = ref(false)
const composerOpen = ref(false)
const pairedDialogView = ref<PairedDialogView>('fortune')
const profileDialogOpen = ref(false)
const siteInfoOpen = ref(false)
const detailsError = ref('')
const details = ref<FortuneDetails>()
const fortuneDialog = ref<HTMLElement | null>(null)
let dragStart: { pointerId: number; y: number; scrollTop: number } | undefined
let firstVisitSequenceId = 0
let firstVisitSequenceActive = false
let cancelFirstVisitMeteor: (() => void) | undefined
let activeFirstVisitMeteorSequenceId: number | undefined

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
      setDialogOpen(false)
      details.value = undefined
      return
    }

    if (!isSessionValidated || !userTag) {
      status.value = 'hidden'
      await auth.hydrate()
      return
    }

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

watch(
  () =>
    [
      route.name,
      route.query.activationTag,
      auth.currentUser?.tag,
      auth.isSessionValidated,
      auth.isLoggedIn,
      status.value,
    ] as const,
  ([routeName, queryTag, userTag, isSessionValidated, isLoggedIn]) => {
    const visitTag = userTag || (typeof queryTag === 'string' ? queryTag.trim() : '')
    const shouldRun =
      routeName !== 'galaxy' ||
      !visitTag ||
      (isLoggedIn && !isSessionValidated) ||
      (!isActivationPreview.value && hasCompletedDailyFirstVisit(visitTag))
    if (shouldRun) {
      stopFirstVisitSequence()
      return
    }
    if (!firstVisitSequenceActive) void runFirstVisitSequence()
  },
  { immediate: true },
)

async function openFortuneDialog(history: boolean) {
  setDialogOpen(true)
  detailsError.value = ''
  details.value = undefined
  if (isActivationPreview.value) {
    details.value = { timeName: '', days: [], history: false }
    return
  }
  if (status.value === 'hidden') {
    detailsError.value = '请先登录后查看星言星语。'
    return
  }

  detailsLoading.value = true
  try {
    const packet = await post(
      '/wpi/user/time-fortune',
      detailsLoading,
      history ? { history: true } : { details: true },
    )
    const result = responseData(packet)
    if (!result) {
      throw new Error('星言星语暂不可用，请稍后重试。')
    }
    if (history) {
      if (!Array.isArray(result.days)) {
        throw new Error('星言星语暂不可用，请稍后重试。')
      }
      details.value = { ...result, history: true }
    } else {
      const today = result.days?.[0] ?? {
        date: localDate(),
        dailyFortune: result.dailyFortune ?? '',
        timeFortunes: result.timeFortunes ?? [],
      }
      details.value = { ...result, days: [today], history: false }
    }
  } catch (error) {
    detailsError.value =
      (error as { msg?: string; message?: string }).msg ||
      (error as { message?: string }).message ||
      '锦言加载失败，请稍后重试。'
  } finally {
    detailsLoading.value = false
  }
}

function setDialogOpen(open: boolean) {
  dialogOpen.value = open
  window.dispatchEvent(new CustomEvent(TIME_FORTUNE_DIALOG_STATE_EVENT, { detail: open }))
}

function openDailyFortune(automatic = false) {
  stopFirstVisitSequence()
  const userTag = auth.currentUser?.tag || activationTag.value
  if (userTag) {
    markTimeFortuneOpened(userTag)
    if (automatic && !isActivationPreview.value) markDailyFirstVisitCompleted(userTag)
  }
  void openFortuneDialog(false)
  setPairedDialogView('fortune')
  if (!automatic && !isActivationPreview.value) {
    window.dispatchEvent(
      new CustomEvent<GalaxyStarComposeOptions>(GALAXY_STAR_COMPOSE_EVENT, {
        detail: { onlyIfAvailable: true, pairedWithFortune: true },
      }),
    )
  }
}

function setPairedDialogView(view: PairedDialogView) {
  pairedDialogView.value = view
  window.dispatchEvent(
    new CustomEvent<PairedDialogView>(TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT, { detail: view }),
  )
}

async function runFirstVisitSequence() {
  firstVisitSequenceActive = true
  const sequenceId = ++firstVisitSequenceId
  const userTag = auth.currentUser?.tag || activationTag.value
  if (!userTag) {
    firstVisitSequenceActive = false
    return
  }

  activeFirstVisitMeteorSequenceId = sequenceId
  const meteorCount = Math.min(7, Math.max(1, auth.currentUser?.loginStreak ?? 1))
  const request: FirstVisitMeteorRequest = { sequenceId, meteorCount }
  let meteorStarted = false
  const handleMeteorStarted = (event: Event) => {
    if ((event as CustomEvent<number>).detail === sequenceId) meteorStarted = true
  }
  window.addEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_STARTED_EVENT, handleMeteorStarted)
  window.dispatchEvent(
    new CustomEvent<FirstVisitMeteorRequest>(TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT, {
      detail: request,
    }),
  )

  while (sequenceId === firstVisitSequenceId && !meteorStarted) {
    await wait(250)
    if (!meteorStarted && sequenceId === firstVisitSequenceId) {
      window.dispatchEvent(
        new CustomEvent<FirstVisitMeteorRequest>(TIME_FORTUNE_FIRST_VISIT_METEOR_EVENT, {
          detail: request,
        }),
      )
    }
  }
  window.removeEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_STARTED_EVENT, handleMeteorStarted)
  if (sequenceId !== firstVisitSequenceId) return

  const arrived = await flyFirstVisitMeteor(sequenceId)
  if (sequenceId !== firstVisitSequenceId) return
  if (!arrived) {
    activeFirstVisitMeteorSequenceId = undefined
    firstVisitSequenceActive = false
    return
  }

  activeFirstVisitMeteorSequenceId = undefined
  firstVisitSequenceActive = false
  openDailyFortune(true)
}

function flyFirstVisitMeteor(sequenceId: number) {
  return new Promise<boolean>((resolve) => {
    const cleanup = () => {
      window.removeEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_ARRIVED_EVENT, handleArrival)
      window.removeEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT, handleCancel)
      cancelFirstVisitMeteor = undefined
    }
    const handleArrival = (event: Event) => {
      const detail = (event as CustomEvent<{ sequenceId: number; arrived: boolean }>).detail
      if (detail.sequenceId !== sequenceId) return
      cleanup()
      resolve(detail.arrived)
    }
    const handleCancel = (event: Event) => {
      if ((event as CustomEvent<number>).detail !== sequenceId) return
      cleanup()
      resolve(false)
    }
    window.addEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_ARRIVED_EVENT, handleArrival)
    window.addEventListener(TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT, handleCancel)
    cancelFirstVisitMeteor = () => {
      cleanup()
      resolve(false)
    }
    window.dispatchEvent(
      new CustomEvent(TIME_FORTUNE_FIRST_VISIT_METEOR_READY_EVENT, { detail: sequenceId }),
    )
  })
}

function stopFirstVisitSequence() {
  const meteorSequenceId = activeFirstVisitMeteorSequenceId
  firstVisitSequenceId += 1
  firstVisitSequenceActive = false
  cancelFirstVisitMeteor?.()
  cancelFirstVisitMeteor = undefined
  activeFirstVisitMeteorSequenceId = undefined
  if (meteorSequenceId !== undefined) {
    window.dispatchEvent(
      new CustomEvent(TIME_FORTUNE_FIRST_VISIT_METEOR_CANCEL_EVENT, {
        detail: meteorSequenceId,
      }),
    )
  }
}

function localDate() {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function handleHistoryOpen() {
  void openFortuneDialog(true)
}

function handleClose() {
  setDialogOpen(false)
}

function handleButtonToggle() {
  if (dialogOpen.value) {
    setDialogOpen(false)
    return
  }
  openDailyFortune()
}

function openActivationForm() {
  if (!activationTag.value) return
  setDialogOpen(false)
  void router.push({
    name: 'tag',
    params: { tag: activationTag.value },
    query: { registration: '1' },
  })
}

function openSiteInfo() {
  siteInfoOpen.value = true
}

function handleComposerState(event: Event) {
  composerOpen.value = (event as CustomEvent<boolean>).detail
}

function handlePairedDialogView(event: Event) {
  pairedDialogView.value = (event as CustomEvent<PairedDialogView>).detail
}

function handleDialogPointerDown(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  const target = event.target
  if (
    target instanceof Element &&
    target.closest('button, summary, input, textarea, select, label')
  )
    return
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
  window.addEventListener(TIME_FORTUNE_HISTORY_EVENT, handleHistoryOpen)
  window.addEventListener(TIME_FORTUNE_TOGGLE_EVENT, handleButtonToggle)
  window.addEventListener(TIME_FORTUNE_CLOSE_EVENT, handleClose)
  window.addEventListener(GALAXY_STAR_COMPOSER_STATE_EVENT, handleComposerState)
  window.addEventListener(TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT, handlePairedDialogView)
})

onBeforeUnmount(() => {
  stopFirstVisitSequence()
  window.removeEventListener(TIME_FORTUNE_HISTORY_EVENT, handleHistoryOpen)
  window.removeEventListener(TIME_FORTUNE_TOGGLE_EVENT, handleButtonToggle)
  window.removeEventListener(TIME_FORTUNE_CLOSE_EVENT, handleClose)
  window.removeEventListener(GALAXY_STAR_COMPOSER_STATE_EVENT, handleComposerState)
  window.removeEventListener(TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT, handlePairedDialogView)
  runId.value += 1
  dragStart = undefined
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fortune-dialog">
      <div
        v-if="dialogOpen"
        class="fortune-overlay"
        :class="{
          'fortune-overlay-paired': composerOpen,
          'fortune-overlay-paired-active': composerOpen && pairedDialogView === 'fortune',
          'fortune-overlay-paired-inactive': composerOpen && pairedDialogView !== 'fortune',
        }"
        @click.self="setDialogOpen(false)"
      >
        <button
          v-if="composerOpen && pairedDialogView === 'composer'"
          class="dialog-edge-tab dialog-edge-tab-fortune"
          type="button"
          aria-label="打开每日锦言"
          @click.stop="setPairedDialogView('fortune')"
        >
          每日锦言
        </button>
        <Transition name="dialog-switch">
          <section
            v-if="!composerOpen || pairedDialogView === 'fortune'"
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
            <div class="dialog-header-actions">
              <button
                v-if="details?.history"
                class="dialog-icon-button dialog-action"
                type="button"
                :aria-label="t('timeFortune.editProfile')"
                :title="t('timeFortune.editProfile')"
                @click="profileDialogOpen = true"
              >
                <ion-icon name="create-outline" aria-hidden="true"></ion-icon>
              </button>
              <button
                v-if="details?.history"
                class="dialog-icon-button dialog-action"
                type="button"
                :aria-label="t('siteInfo.title')"
                :title="t('siteInfo.title')"
                @click="openSiteInfo"
              >
                <ion-icon name="document-text-outline" aria-hidden="true"></ion-icon>
              </button>
            </div>
            <p class="dialog-eyebrow">Words From the Stars</p>
            <h2 id="fortune-title">{{ t('timeFortune.title') }}</h2>
            <p v-if="detailsLoading" class="dialog-status">正在读取星辰讯息…</p>
            <p v-else-if="detailsError" class="dialog-status dialog-error" role="alert">
              {{ detailsError }}
            </p>
            <template v-else-if="details">
              <TimeFortuneHistory v-if="details.history" :days="details.days" />
              <template v-else>
                <article
                  v-if="isActivationPreview"
                  class="fortune-entry activation-locked-entry"
                  role="button"
                  tabindex="0"
                  :aria-label="t('timeFortune.activate')"
                  @click="openActivationForm"
                  @keydown.enter.prevent="openActivationForm"
                  @keydown.space.prevent="openActivationForm"
                >
                  <h3>
                    每日锦言
                    <span class="fortune-lock-icon" aria-hidden="true">
                      <ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon>
                    </span>
                  </h3>
                  <p>{{ t('timeFortune.activationRequired') }}</p>
                </article>
                <template v-else>
                  <p v-if="!details.days.length" class="dialog-status">最近七天暂无星言星语。</p>
                  <section v-for="day in details.days" :key="day.date">
                    <article v-if="day.dailyFortune" class="fortune-entry daily-fortune-sparkle">
                      <h3>每日锦言</h3>
                      <p>{{ day.dailyFortune }}</p>
                    </article>
                    <article
                      v-for="fortune in day.timeFortunes"
                      :key="fortune.timeName"
                      :class="[
                        'fortune-entry',
                        'time-entry',
                        { 'current-time-entry': fortune.timeName === details.timeName },
                      ]"
                    >
                      <h3>
                        {{ fortune.timeName }}（{{ timeFortuneRange(fortune.timeName) }}）· 时辰锦言
                        <span
                          v-if="fortune.timeName === details.timeName"
                          class="current-time-label"
                          >当前时辰</span
                        >
                      </h3>
                      <p>{{ fortune.message }}</p>
                    </article>
                  </section>
                </template>
              </template>
            </template>
            <div class="dialog-ornament" aria-hidden="true">✦　✧　✦</div>
          </section>
        </Transition>
      </div>
    </Transition>
    <UserProfileEditDialog :open="profileDialogOpen" @close="profileDialogOpen = false" />
    <SiteInfoView v-if="siteInfoOpen" dialog @close="siteInfoOpen = false" />
  </Teleport>
</template>

<style scoped>
.fortune-overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px 24px var(--dialog-bottom-reserve, calc(clamp(112px, 13vh, 168px) + 104px));
  background: rgba(1, 7, 19, 0.36);
  backdrop-filter: blur(3px);
}

.fortune-overlay-paired {
  pointer-events: none;
  background: transparent;
  backdrop-filter: none;
}

.fortune-overlay-paired-active {
  z-index: 1100;
  pointer-events: auto;
  background: rgba(1, 7, 19, 0.36);
  backdrop-filter: blur(3px);
}

.fortune-overlay-paired-inactive {
  z-index: 1200;
}

.fortune-dialog {
  position: relative;
  box-sizing: border-box;
  width: min(100%, 520px);
  height: min(
    720px,
    var(--dialog-available-height, calc(100vh - 24px - clamp(112px, 13vh, 168px) - 104px))
  );
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  touch-action: pan-y;
  interpolate-size: allow-keywords;
  cursor: grab;
  padding: 34px clamp(24px, 6vw, 48px) 24px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  box-shadow: none;
  color: #e8f1fb;
}

.dialog-switch-enter-active,
.dialog-switch-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dialog-switch-enter-from,
.dialog-switch-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.985);
}

.dialog-edge-tab {
  position: fixed;
  z-index: 1;
  top: 50%;
  padding: 16px 10px;
  border: 1px solid rgba(163, 207, 255, 0.52);
  background: rgba(13, 34, 65, 0.96);
  box-shadow: 0 0 18px rgba(130, 185, 255, 0.42);
  color: #f5d58e;
  cursor: pointer;
  font: inherit;
  font-size: 16px;
  letter-spacing: 0.08em;
  writing-mode: vertical-rl;
  pointer-events: auto;
  transform: translateY(-50%);
  animation: dialog-edge-tab-pulse 1.8s ease-in-out infinite;
}

.dialog-edge-tab-fortune {
  right: 0;
  border-right: 0;
  border-radius: 12px 0 0 12px;
}

@media (max-width: 640px) {
  .fortune-overlay-paired-active .fortune-dialog {
    width: min(520px, calc(100vw - 80px));
    margin-right: 32px;
  }
}

@keyframes dialog-edge-tab-pulse {
  0%,
  100% {
    opacity: 0.72;
    box-shadow: 0 0 12px rgba(130, 185, 255, 0.28);
  }

  50% {
    opacity: 1;
    box-shadow: 0 0 24px rgba(130, 185, 255, 0.78);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-edge-tab,
  .dialog-switch-enter-active,
  .dialog-switch-leave-active {
    animation: none;
    transition: none;
  }
}

.fortune-dialog::-webkit-scrollbar {
  display: none;
}

.fortune-dialog:active {
  cursor: grabbing;
}

.dialog-header-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dialog-icon-button {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #b7cde4;
  cursor: pointer;
}

.dialog-icon-button:hover {
  background: rgba(137, 177, 226, 0.14);
}

.dialog-action {
  color: #f5d58e;
}

.dialog-action ion-icon {
  font-size: 21px;
}

.dialog-eyebrow {
  margin: 0;
  color: #96bce7;
  font-size: 10px;
  letter-spacing: 0.24em;
  text-align: center;
}

.fortune-dialog h2 {
  margin: 8px 0 26px;
  color: #f4e6bf;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-align: center;
}

.fortune-entry {
  padding: 18px 20px;
  border: 0;
  border-radius: 16px;
  background: transparent;
}

.daily-fortune-sparkle {
  background: rgba(137, 177, 226, 0.06);
}

.fortune-entry + .fortune-entry {
  margin-top: 14px;
}

.fortune-entry h3 {
  margin: 0 0 10px;
  color: #edc981;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.activation-locked-entry {
  cursor: pointer;
}

.activation-locked-entry:hover,
.activation-locked-entry:focus-visible {
  background: linear-gradient(135deg, rgba(240, 189, 99, 0.16), rgba(137, 177, 226, 0.08));
  outline: none;
}

.fortune-lock-icon {
  display: inline-grid;
  width: 24px;
  height: 24px;
  margin-left: 6px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(240, 189, 99, 0.12);
  color: #f5d58e;
  vertical-align: middle;
}

.fortune-lock-icon ion-icon {
  font-size: 15px;
}

.fortune-entry p {
  margin: 0;
  color: #e7eef8;
  font-size: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.current-time-entry {
  background: linear-gradient(135deg, rgba(240, 189, 99, 0.16), rgba(137, 177, 226, 0.08));
  box-shadow:
    inset 0 0 24px rgba(240, 189, 99, 0.08),
    0 0 18px rgba(240, 189, 99, 0.08);
}

.current-time-entry h3 {
  color: #f5d58e;
}

.current-time-label {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 7px;
  border: 0;
  border-radius: 999px;
  color: #f5d58e;
  font-size: 10px;
  letter-spacing: 0.04em;
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
  letter-spacing: 0.35em;
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
  transform: translateY(12px) scale(0.98);
}
</style>
