<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { SentGalaxyStar } from '../../../../common/entity/galaxy-star'
import {
  GALAXY_STAR_COMPOSE_EVENT,
  announceGalaxyStarComposerState,
  announceGalaxyStarNavigate,
  announceGalaxyStarSendStatus,
  announceGalaxyStarSent,
  type GalaxyStarComposeOptions,
} from '@/events/galaxy-star'
import { post } from '@/scripts/request'
import { DIALOG_STACK_CLOSE_DIALOG_EVENT, requestTopDialogClose } from '@/events/dialog-stack'
import {
  TIME_FORTUNE_CLOSE_EVENT,
  TIME_FORTUNE_DIALOG_STATE_EVENT,
  TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT,
  type PairedDialogView,
} from '@/events/time-fortune'

const isOpen = ref(false)
const composerDialog = ref<HTMLElement | null>(null)
const pairedWithFortune = ref(false)
const fortuneDialogOpen = ref(false)
const pairedDialogView = ref<PairedDialogView>('fortune')
const statusLoading = ref(false)
const sending = ref(false)
const canSend = ref<boolean>()
const sentStarColor = ref('')
const sentStarId = ref('')
const error = ref('')
const title = ref('')
const content = ref('')
const color = ref('#7ec8ff')

async function openComposer(event?: Event) {
  const options =
    event instanceof CustomEvent
      ? (event.detail as GalaxyStarComposeOptions | undefined)
      : undefined
  const isFortunePairedComposer = options?.pairedWithFortune === true
  pairedWithFortune.value = options?.pairedWithFortune === true
  statusLoading.value = true
  error.value = ''
  canSend.value = undefined
  sentStarColor.value = ''
  sentStarId.value = ''
  try {
    const packet = await post('/wpi/user/galaxy-star/status', statusLoading)
    const result = packet.data as
      { canSend?: boolean; todayStarColor?: string; todayStarId?: string } | undefined
    if (typeof result?.canSend !== 'boolean') {
      throw new Error('星星发送状态暂不可用，请稍后重试。')
    }
    if (!result.canSend && !result.todayStarId) {
      throw new Error('今天寄出的星星信息暂不可用，请稍后重试。')
    }

    canSend.value = result.canSend
    sentStarColor.value = result.todayStarColor ?? ''
    sentStarId.value = result.todayStarId ?? ''
    if (isFortunePairedComposer && !fortuneDialogOpen.value) {
      closeComposer()
      return
    }
    isOpen.value = true
    announceGalaxyStarComposerState(true)
    announceGalaxyStarSendStatus(result.canSend)
  } catch (cause) {
    console.error('读取每日星星发送状态失败', cause)
    if (isFortunePairedComposer && !fortuneDialogOpen.value) {
      closeComposer()
      return
    }
    isOpen.value = true
    announceGalaxyStarComposerState(true)
    error.value =
      (cause as { msg?: string; message?: string }).msg ||
      (cause as { message?: string }).message ||
      '星星发送状态加载失败，请稍后重试。'
  }
}

function closeComposer() {
  if (pairedWithFortune.value && fortuneDialogOpen.value) {
    announceGalaxyStarComposerState(false)
    setPairedDialogView('fortune')
    return
  }
  dismissComposer()
}

function dismissComposer() {
  isOpen.value = false
  pairedWithFortune.value = false
  announceGalaxyStarComposerState(false)
}

function handleFortuneDialogState(event: Event) {
  fortuneDialogOpen.value = (event as CustomEvent<boolean>).detail
  if (!fortuneDialogOpen.value && pairedWithFortune.value) dismissComposer()
}

function handleFortuneClose() {
  if (isOpen.value) dismissComposer()
}

function handleDialogStackClose(event: Event) {
  if ((event as CustomEvent<string>).detail === 'composer') closeComposer()
}

function setPairedDialogView(view: PairedDialogView) {
  if (
    view === 'composer' &&
    pairedWithFortune.value &&
    fortuneDialogOpen.value &&
    pairedDialogView.value !== 'composer'
  ) {
    announceGalaxyStarComposerState(true)
  }
  pairedDialogView.value = view
  window.dispatchEvent(
    new CustomEvent<PairedDialogView>(TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT, { detail: view }),
  )
}

function handleStarEdgeTabClick() {
  if (canSend.value === false && sentStarId.value) {
    if (pairedWithFortune.value && fortuneDialogOpen.value) {
      window.dispatchEvent(new Event(TIME_FORTUNE_CLOSE_EVENT))
    } else {
      closeComposer()
    }
    announceGalaxyStarNavigate(sentStarId.value)
    return
  }
  setPairedDialogView('composer')
}

function handlePairedDialogView(event: Event) {
  pairedDialogView.value = (event as CustomEvent<PairedDialogView>).detail
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (!isOpen.value || !(event.target instanceof Node)) return
  const target = event.target
  if (composerDialog.value?.contains(target)) {
    if (pairedWithFortune.value && fortuneDialogOpen.value) {
      setPairedDialogView('composer')
    }
    return
  }
  if (target instanceof Element && target.closest('.dialog-edge-tab')) return
  if (
    pairedWithFortune.value &&
    fortuneDialogOpen.value &&
    target instanceof Element &&
    target.closest('.fortune-dialog')
  ) {
    setPairedDialogView('fortune')
    return
  }
  if (
    pairedWithFortune.value &&
    fortuneDialogOpen.value &&
    pairedDialogView.value === 'fortune'
  ) {
    return
  }
  requestTopDialogClose()
}

async function sendStar() {
  error.value = ''
  sending.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star/send', sending, {
      title: title.value,
      content: content.value,
      color: color.value,
    })
    const result = packet.data as { star?: SentGalaxyStar } | undefined
    if (!result?.star?.id) {
      throw new Error('星星发送失败，请稍后重试。')
    }
    canSend.value = false
    sentStarColor.value = result.star.color
    sentStarId.value = result.star.id
    title.value = ''
    content.value = ''
    announceGalaxyStarSent(result.star)
  } catch (cause) {
    error.value =
      (cause as { msg?: string; message?: string }).msg ||
      (cause as { message?: string }).message ||
      '星星发送失败，请稍后重试。'
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  window.addEventListener(GALAXY_STAR_COMPOSE_EVENT, openComposer)
  window.addEventListener(TIME_FORTUNE_DIALOG_STATE_EVENT, handleFortuneDialogState)
  window.addEventListener(TIME_FORTUNE_CLOSE_EVENT, handleFortuneClose)
  window.addEventListener(DIALOG_STACK_CLOSE_DIALOG_EVENT, handleDialogStackClose)
  window.addEventListener(TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT, handlePairedDialogView)
  document.addEventListener('pointerdown', handleOutsidePointerDown)
})
onBeforeUnmount(() => {
  window.removeEventListener(GALAXY_STAR_COMPOSE_EVENT, openComposer)
  window.removeEventListener(TIME_FORTUNE_DIALOG_STATE_EVENT, handleFortuneDialogState)
  window.removeEventListener(TIME_FORTUNE_CLOSE_EVENT, handleFortuneClose)
  window.removeEventListener(DIALOG_STACK_CLOSE_DIALOG_EVENT, handleDialogStackClose)
  window.removeEventListener(TIME_FORTUNE_PAIRED_DIALOG_VIEW_EVENT, handlePairedDialogView)
  document.removeEventListener('pointerdown', handleOutsidePointerDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fortune-dialog">
      <div
        v-if="isOpen"
        class="star-compose-overlay"
        :class="{
          'star-compose-overlay-paired': pairedWithFortune && fortuneDialogOpen,
          'star-compose-overlay-paired-active':
            pairedWithFortune && fortuneDialogOpen && pairedDialogView === 'composer',
          'star-compose-overlay-paired-inactive':
            pairedWithFortune && fortuneDialogOpen && pairedDialogView !== 'composer',
        }"
        @click.self="requestTopDialogClose"
      >
        <button
          v-if="pairedWithFortune && fortuneDialogOpen && pairedDialogView === 'fortune'"
          class="dialog-edge-tab dialog-edge-tab-star"
          type="button"
          :aria-label="canSend === false ? '前往今天寄出的星星' : '打开寄出星星'"
          :style="{ '--sent-star-color': canSend === false ? sentStarColor : '#f5d58e' }"
          @click.stop="handleStarEdgeTabClick"
        >
          <ion-icon
            :name="canSend === false ? 'star' : 'star-outline'"
            aria-hidden="true"
          ></ion-icon>
          {{ canSend === false ? '定位星星' : '寄出星星' }}
        </button>
        <Transition name="dialog-switch">
          <section
            v-if="!pairedWithFortune || !fortuneDialogOpen || pairedDialogView === 'composer'"
            class="star-compose-dialog"
            ref="composerDialog"
            role="dialog"
            :aria-modal="!pairedWithFortune || !fortuneDialogOpen"
            aria-labelledby="star-compose-title"
          >
            <p v-if="statusLoading" class="star-compose-status">正在确认今日发送机会…</p>
            <p v-else-if="error" class="star-compose-status star-compose-error" role="alert">
              {{ error }}
              <button v-if="canSend === undefined" type="button" @click="openComposer">重试</button>
            </p>
            <p v-else-if="canSend === false" class="star-compose-status">
              今日的星星已经送出，明天再来吧。
            </p>
            <form v-else-if="canSend" class="star-compose-form" @submit.prevent="sendStar">
              <div class="star-compose-title-color-row">
                <input v-model="title" maxlength="40" required placeholder="为这颗星星取个名字" />
                <div class="star-compose-color-picker">
                  <label
                    class="star-compose-color-swatch"
                    :style="{ '--swatch-color': color }"
                    aria-label="选择星星颜色"
                  >
                    <input
                      id="star-compose-color"
                      v-model="color"
                      class="star-compose-color-input"
                      type="color"
                      aria-label="星星颜色"
                    />
                  </label>
                </div>
              </div>
              <div class="star-compose-content-row">
                <textarea
                  v-model="content"
                  maxlength="500"
                  required
                  rows="3"
                  placeholder="写下想送往银河的话"
                ></textarea>
                <button
                  class="star-compose-submit"
                  type="submit"
                  :disabled="sending"
                  :aria-label="sending ? '正在发送星星' : '发送星星'"
                  :title="sending ? '正在发送星星' : '发送星星'"
                >
                  <ion-icon
                    :name="sending ? 'hourglass-outline' : 'star-outline'"
                    aria-hidden="true"
                  ></ion-icon>
                </button>
              </div>
              <p v-if="error" class="star-compose-status star-compose-error" role="alert">
                {{ error }}
              </p>
            </form>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.star-compose-overlay {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px 24px var(--dialog-bottom-reserve, calc(clamp(112px, 13vh, 168px) + 104px));
  background: rgba(1, 7, 19, 0.36);
  backdrop-filter: blur(3px);
}

.star-compose-overlay-paired {
  pointer-events: none;
  background: transparent;
  backdrop-filter: none;
}

.star-compose-overlay-paired-active {
  z-index: 1200;
  pointer-events: none;
  background: transparent;
  backdrop-filter: none;
}

.star-compose-overlay-paired-inactive {
  z-index: 1200;
}

.star-compose-dialog {
  position: relative;
  box-sizing: border-box;
  width: min(460px, 100%);
  height: auto;
  max-height: min(
    520px,
    var(--dialog-available-height, calc(100vh - 24px - clamp(112px, 13vh, 168px) - 104px))
  );
  overflow: auto;
  scrollbar-width: none;
  pointer-events: auto;
  padding: 34px clamp(24px, 6vw, 42px) 30px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  box-shadow: none;
  color: #e8f1fb;
}

.star-compose-dialog::-webkit-scrollbar {
  display: none;
}

.star-compose-overlay-paired-active .star-compose-dialog,
.star-compose-overlay-paired-inactive .star-compose-dialog,
.star-compose-overlay.fortune-dialog-leave-active .star-compose-dialog {
  position: fixed;
  top: auto;
  bottom: calc(
    var(--portal-control-bottom, clamp(112px, 13vh, 168px)) +
      var(--portal-control-size, 61.6px) + 16px
  );
  left: 50%;
  width: min(460px, calc(100vw - 48px));
  height: auto;
  max-height: min(
    520px,
    max(
      120px,
      calc(
        50vh - var(--portal-control-bottom, clamp(112px, 13vh, 168px)) -
          var(--portal-control-size, 61.6px) - 32px
      )
    )
  );
  margin: 0;
  padding: 24px clamp(20px, 5vw, 32px);
  transform: translateX(-50%);
  border: 1px solid rgba(163, 207, 255, 0.5);
  border-radius: 20px;
  background: rgba(5, 12, 28, 0.78);
  box-shadow: 0 0 28px rgba(130, 185, 255, 0.16);
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

.dialog-edge-tab-star {
  display: flex;
  align-items: center;
  gap: 8px;
  right: 0;
  top: 72%;
  border-right: 0;
  border-radius: 12px 0 0 12px;
}

.dialog-edge-tab-star ion-icon {
  color: var(--sent-star-color, #f5d58e);
  font-size: 18px;
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

.star-compose-eyebrow {
  margin: 0 0 8px;
  color: #9db4cb;
  font-size: 11px;
  letter-spacing: 0.16em;
}

.star-compose-dialog h2 {
  margin: 0 0 22px;
  color: #f5d58e;
  font-size: 22px;
}

.star-compose-status {
  margin: 0;
  color: #cbd9e8;
  font-size: 14px;
  line-height: 1.7;
}

.star-compose-status button {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: #b9d8ff;
  cursor: pointer;
  text-decoration: underline;
}

.star-compose-error {
  color: #ffc1ce;
}

.star-compose-form {
  display: grid;
  gap: 14px;
}

.star-compose-title-color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.star-compose-title-color-row > input {
  min-width: 0;
  flex: 1;
}

.star-compose-form label {
  display: grid;
  gap: 7px;
  color: #dce8f6;
  font-size: 13px;
}

.star-compose-form input,
.star-compose-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 0;
  border-radius: 10px;
  background: rgba(2, 9, 20, 0.58);
  color: #eef4ff;
  font: inherit;
}

.star-compose-form textarea {
  min-width: 0;
  min-height: 88px;
  max-height: 160px;
  resize: vertical;
}

.star-compose-content-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.star-compose-color-picker {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #dce8f6;
  font-size: 13px;
}

.star-compose-color-title {
  color: #dce8f6;
}

.star-compose-color-swatch {
  position: relative;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  overflow: hidden;
  border: 2px solid #e8f1fb;
  border-radius: 50%;
  background: var(--swatch-color);
  box-shadow: 0 0 0 1px rgba(8, 20, 38, 0.9);
  cursor: pointer;
}

.star-compose-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 50%;
  appearance: none;
  background: transparent;
  cursor: pointer;
  opacity: 0;
}

.star-compose-submit {
  display: grid;
  width: 32px;
  height: 32px;
  justify-self: end;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #edc981;
  cursor: pointer;
}

.star-compose-submit ion-icon {
  font-size: 28px;
}

.star-compose-submit:focus-visible {
  outline: 2px solid #edc981;
  outline-offset: 3px;
}

.star-compose-submit:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
