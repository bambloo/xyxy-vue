<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { GALAXY_STAR_COLORS, type SentGalaxyStar } from '../../../common/entity/galaxy-star'
import {
  GALAXY_STAR_COMPOSE_EVENT,
  announceGalaxyStarComposerState,
  announceGalaxyStarSendStatus,
  announceGalaxyStarSent,
  type GalaxyStarComposeOptions,
} from '@/events/galaxy-star'
import { post } from '@/scripts/request'
import { TIME_FORTUNE_DIALOG_STATE_EVENT } from '@/events/time-fortune'

const isOpen = ref(false)
const composerDialog = ref<HTMLElement | null>(null)
const pairedWithFortune = ref(false)
const fortuneDialogOpen = ref(false)
const statusLoading = ref(false)
const sending = ref(false)
const canSend = ref<boolean>()
const error = ref('')
const title = ref('')
const content = ref('')
const color = ref<string>(GALAXY_STAR_COLORS[0])
const isCustomColor = computed(() => !GALAXY_STAR_COLORS.some((preset) => preset === color.value))

async function openComposer(event?: Event) {
  const options =
    event instanceof CustomEvent
      ? (event.detail as GalaxyStarComposeOptions | undefined)
      : undefined
  pairedWithFortune.value = options?.pairedWithFortune === true
  statusLoading.value = true
  error.value = ''
  canSend.value = undefined
  try {
    const packet = await post('/wpi/user/galaxy-star/status', statusLoading)
    const result = packet.data as { canSend?: boolean } | undefined
    if (typeof result?.canSend !== 'boolean') {
      throw new Error('星星发送状态暂不可用，请稍后重试。')
    }
    canSend.value = result.canSend
    if (options?.onlyIfAvailable && !result.canSend) {
      closeComposer()
      return
    }
    isOpen.value = true
    announceGalaxyStarComposerState(true)
    announceGalaxyStarSendStatus(result.canSend)
  } catch (cause) {
    console.error('读取每日星星发送状态失败', cause)
    isOpen.value = true
    announceGalaxyStarComposerState(true)
    error.value =
      (cause as { msg?: string; message?: string }).msg ||
      (cause as { message?: string }).message ||
      '星星发送状态加载失败，请稍后重试。'
  }
}

function closeComposer() {
  isOpen.value = false
  pairedWithFortune.value = false
  announceGalaxyStarComposerState(false)
}

function handleFortuneDialogState(event: Event) {
  fortuneDialogOpen.value = (event as CustomEvent<boolean>).detail
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (!isOpen.value || !(event.target instanceof Node)) return
  if (composerDialog.value?.contains(event.target)) return
  closeComposer()
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
  document.addEventListener('pointerdown', handleOutsidePointerDown)
})
onBeforeUnmount(() => {
  window.removeEventListener(GALAXY_STAR_COMPOSE_EVENT, openComposer)
  window.removeEventListener(TIME_FORTUNE_DIALOG_STATE_EVENT, handleFortuneDialogState)
  document.removeEventListener('pointerdown', handleOutsidePointerDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fortune-dialog">
      <div
        v-if="isOpen"
        class="star-compose-overlay"
        :class="{ 'star-compose-overlay-paired': pairedWithFortune && fortuneDialogOpen }"
        @click.self="closeComposer"
      >
        <section
          class="star-compose-dialog"
          ref="composerDialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="star-compose-title"
        >
          <button class="star-compose-close" type="button" aria-label="关闭" @click="closeComposer">
            ×
          </button>
          <p class="star-compose-eyebrow">A MESSAGE TO THE GALAXY</p>
          <h2 id="star-compose-title">寄出一颗星星</h2>
          <p v-if="statusLoading" class="star-compose-status">正在确认今日发送机会…</p>
          <p v-else-if="error" class="star-compose-status star-compose-error" role="alert">
            {{ error }}
            <button v-if="canSend === undefined" type="button" @click="openComposer">重试</button>
          </p>
          <p v-else-if="canSend === false" class="star-compose-status">
            今日的星星已经送出，明天再来吧。
          </p>
          <form v-else-if="canSend" class="star-compose-form" @submit.prevent="sendStar">
            <label>
              星星标题
              <input v-model="title" maxlength="40" required placeholder="为这颗星星取个名字" />
            </label>
            <label>
              星星内容
              <textarea
                v-model="content"
                maxlength="500"
                required
                rows="4"
                placeholder="写下想送往银河的话"
              ></textarea>
            </label>
            <fieldset class="star-compose-colors">
              <legend>选择星星颜色</legend>
              <label
                class="star-compose-color star-compose-custom-color"
                :class="{ selected: isCustomColor }"
              >
                <input
                  v-model="color"
                  type="color"
                  aria-label="自定义星星颜色"
                  title="自定义星星颜色"
                />
              </label>
              <button
                v-for="preset in GALAXY_STAR_COLORS"
                :key="preset"
                type="button"
                class="star-compose-color"
                :class="{ selected: preset === color }"
                :style="{ '--swatch-color': preset }"
                :aria-label="`选择颜色 ${preset}`"
                :aria-pressed="preset === color"
                @click="color = preset"
              ></button>
            </fieldset>
            <p v-if="error" class="star-compose-status star-compose-error" role="alert">
              {{ error }}
            </p>
            <button class="star-compose-submit" type="submit" :disabled="sending">
              {{ sending ? '正在发送…' : '发送星星' }}
            </button>
          </form>
        </section>
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
  padding: 24px;
  background: rgba(1, 7, 19, 0.76);
  backdrop-filter: blur(12px);
}

.star-compose-overlay-paired {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding: 24px;
  pointer-events: none;
  background: transparent;
  backdrop-filter: none;
}

.star-compose-dialog {
  position: relative;
  width: min(100%, 480px);
  max-height: min(80vh, 720px);
  overflow: auto;
  padding: 34px clamp(24px, 6vw, 42px) 30px;
  border: 1px solid rgba(163, 207, 255, 0.38);
  border-radius: 24px;
  background:
    radial-gradient(ellipse at 50% 0, rgba(103, 159, 231, 0.2), transparent 54%),
    linear-gradient(145deg, rgba(13, 34, 65, 0.98), rgba(5, 15, 32, 0.98));
  box-shadow:
    0 28px 90px rgba(0, 0, 0, 0.55),
    inset 0 0 36px rgba(121, 175, 241, 0.08);
  color: #e8f1fb;
}

.star-compose-overlay-paired .star-compose-dialog {
  grid-column: 2;
  width: 100%;
  max-height: min(88vh, 860px);
  pointer-events: auto;
}

@media (max-width: 760px) {
  .star-compose-overlay-paired {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 12px;
  }

  .star-compose-overlay-paired .star-compose-dialog {
    grid-column: 1;
    grid-row: 2;
    max-height: 45vh;
    padding: 28px 20px 18px;
  }
}

.star-compose-close {
  position: absolute;
  top: 14px;
  right: 18px;
  border: 0;
  background: transparent;
  color: #dce8f6;
  cursor: pointer;
  font-size: 28px;
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
  gap: 18px;
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
  border: 1px solid rgba(163, 207, 255, 0.26);
  border-radius: 10px;
  background: rgba(2, 9, 20, 0.58);
  color: #eef4ff;
  font: inherit;
}

.star-compose-form textarea {
  resize: vertical;
}

.star-compose-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.star-compose-colors legend {
  margin-bottom: 12px;
  color: #dce8f6;
  font-size: 13px;
}

.star-compose-custom-color input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 50%;
  opacity: 0;
  cursor: pointer;
}

.star-compose-color {
  position: relative;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-radius: 50%;
  background: var(--swatch-color);
  cursor: pointer;
}

.star-compose-custom-color {
  background: conic-gradient(
    #ff5252,
    #ffb142,
    #fffa65,
    #32ff7e,
    #18dcff,
    #7d5fff,
    #cd84f1,
    #ff5252
  );
}

.star-compose-color.selected {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

.star-compose-submit {
  justify-self: end;
  padding: 10px 18px;
  border: 0;
  border-radius: 999px;
  background: #edc981;
  color: #172238;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.star-compose-submit:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
