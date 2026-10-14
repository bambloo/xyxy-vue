<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'

type FortuneStatus = 'hidden' | 'generating' | 'arriving' | 'ready'

interface FortuneDetails {
  ready: boolean
  timeName: string
  dailyFortune?: string
  timeFortune?: string
}

const auth = useAuthStore()
const status = ref<FortuneStatus>('hidden')
const requestLoading = ref(false)
const detailsLoading = ref(false)
const runId = ref(0)
const retryMessage = ref('')
const dialogOpen = ref(false)
const detailsError = ref('')
const details = ref<FortuneDetails>()
const visible = computed(() => status.value !== 'hidden')
const label = computed(() =>
  status.value === 'ready' ? '当前时辰锦言已生成，点击查看' : '正在生成当前时辰锦言',
)

function responseData(packet: { data?: unknown }): FortuneDetails | undefined {
  return packet.data as FortuneDetails | undefined
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

watch(
  () => auth.currentUser?.tag,
  async (userTag) => {
    const currentRun = ++runId.value
    if (!userTag || !auth.isLoggedIn) {
      status.value = 'hidden'
      retryMessage.value = ''
      dialogOpen.value = false
      details.value = undefined
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
        retryMessage.value = ''
        if (responseData(packet)?.ready) {
          status.value = 'arriving'
          await wait(1500)
          if (currentRun === runId.value) status.value = 'ready'
          return
        }
      } catch (error) {
        if (currentRun !== runId.value) return
        retryMessage.value = '连接暂时不可用，正在重试'
        console.error('查询时辰锦言生成状态失败', error)
      }
      await wait(2000)
    }
  },
  { immediate: true },
)

async function openFortuneDialog() {
  if (status.value !== 'ready') return
  dialogOpen.value = true
  detailsError.value = ''
  detailsLoading.value = true
  try {
    const packet = await post('/wpi/user/time-fortune', detailsLoading, { details: true })
    const result = responseData(packet)
    if (!result?.ready || !result.dailyFortune || !result.timeFortune) {
      throw new Error('锦言内容暂不可用，请稍后重试。')
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

onBeforeUnmount(() => {
  runId.value += 1
})
</script>

<template>
  <div v-if="visible" class="time-fortune-indicator" :class="`is-${status}`">
    <svg class="sky-mark" viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id="meteor-trail" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#8abaff" stop-opacity="0" />
          <stop offset=".72" stop-color="#b8d8ff" stop-opacity=".75" />
          <stop offset="1" stop-color="#fff" />
        </linearGradient>
        <radialGradient id="locator-glow">
          <stop offset="0" stop-color="#fff" />
          <stop offset=".2" stop-color="#e4f4ff" />
          <stop offset="1" stop-color="#8fc7ff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path class="meteor-trail" pathLength="1" d="M 9 78 Q 34 57 71 20" />
      <circle class="meteor-head" cx="72" cy="19" r="3.5" />
      <circle class="locator-halo" cx="72" cy="19" r="15" />
      <path class="locator-rays" d="M72 5v7m0 14v7M58 19h7m14 0h7M62.1 9.1l5 5m9.8 9.8 5 5m0-19.8-5 5m-9.8 9.8-5 5" />
      <circle class="locator-core" cx="72" cy="19" r="3.5" />
    </svg>
    <button
      class="locator-button"
      type="button"
      :disabled="status !== 'ready'"
      :aria-label="label"
      :title="retryMessage || label"
      @click="openFortuneDialog"
    />
  </div>

  <Teleport to="body">
    <Transition name="fortune-dialog">
      <div v-if="dialogOpen" class="fortune-overlay" @click.self="dialogOpen = false">
        <section
          class="fortune-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fortune-title"
        >
          <button
            class="dialog-close"
            type="button"
            aria-label="关闭"
            @click="dialogOpen = false"
          >×</button>
          <p class="dialog-eyebrow">TODAY'S CONSTELLATION</p>
          <h2 id="fortune-title">星辰寄语</h2>
          <p v-if="detailsLoading" class="dialog-status">正在读取星辰讯息…</p>
          <p v-else-if="detailsError" class="dialog-status dialog-error" role="alert">
            {{ detailsError }}
          </p>
          <template v-else-if="details">
            <article class="fortune-entry">
              <h3>每日锦言</h3>
              <p>{{ details.dailyFortune }}</p>
            </article>
            <article class="fortune-entry time-entry">
              <h3>{{ details.timeName }} · 时辰锦言</h3>
              <p>{{ details.timeFortune }}</p>
            </article>
          </template>
          <div class="dialog-ornament" aria-hidden="true">✦　✧　✦</div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.time-fortune-indicator {
  position: fixed;
  z-index: 30;
  top: 12px;
  left: 12px;
  width: 96px;
  height: 96px;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(0 0 8px rgba(129, 188, 255, .42));
}

.sky-mark {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.meteor-trail {
  fill: none;
  stroke: url(#meteor-trail);
  stroke-linecap: round;
  stroke-width: 2.4;
  stroke-dasharray: 1;
  animation: meteor-cross 4.8s cubic-bezier(.25, .1, .3, 1) infinite;
}

.meteor-head {
  fill: #fff;
  filter: drop-shadow(0 0 5px #a9d4ff);
  animation: meteor-head 4.8s cubic-bezier(.25, .1, .3, 1) infinite;
}

.locator-halo,
.locator-rays,
.locator-core {
  opacity: 0;
}

.is-ready .meteor-trail,
.is-ready .meteor-head {
  animation: none;
  opacity: 0;
}

.is-arriving .meteor-trail {
  stroke-dasharray: 1 0;
  stroke-dashoffset: 1;
  opacity: 1;
  animation: meteor-dock-trail 1.5s cubic-bezier(.18, .72, .25, 1) forwards;
}

.is-arriving .meteor-head {
  opacity: 1;
  transform: translate(-45px, 45px);
  animation: meteor-dock-head 1.5s cubic-bezier(.18, .72, .25, 1) forwards;
}

.is-ready .locator-halo,
.is-ready .locator-rays,
.is-ready .locator-core {
  animation: locator-pulse 2.4s ease-in-out infinite;
}

.locator-halo {
  fill: url(#locator-glow);
}

.locator-rays {
  fill: none;
  stroke: #d9edff;
  stroke-linecap: round;
  stroke-width: 1.3;
}

.locator-core {
  fill: #fff;
  filter: drop-shadow(0 0 6px #a9d4ff);
}

.locator-button {
  position: absolute;
  top: 7px;
  left: 60px;
  z-index: 2;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
}

.locator-button:focus-visible {
  outline: 2px solid #d9edff;
  outline-offset: 3px;
}

.locator-button:disabled {
  cursor: default;
}

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
  padding: 34px clamp(24px, 6vw, 48px) 24px;
  border: 1px solid rgba(163, 207, 255, .38);
  border-radius: 24px;
  background:
    radial-gradient(ellipse at 50% 0, rgba(103, 159, 231, .2), transparent 54%),
    linear-gradient(145deg, rgba(13, 34, 65, .98), rgba(5, 15, 32, .98));
  box-shadow: 0 28px 90px rgba(0, 0, 0, .55), inset 0 0 36px rgba(121, 175, 241, .08);
  color: #e8f1fb;
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

.fortune-entry + .fortune-entry {
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

@keyframes meteor-cross {
  0% {
    stroke-dasharray: 0 .98;
    opacity: 0;
  }
  12% {
    opacity: .95;
  }
  78% {
    stroke-dasharray: .72 .28;
    opacity: .9;
  }
  100% {
    stroke-dasharray: .86 .14;
    opacity: 0;
  }
}

@keyframes meteor-dock-trail {
  0% {
    stroke-dashoffset: 1;
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: .15;
  }
}

@keyframes meteor-dock-head {
  0% {
    opacity: 0;
    transform: translate(-45px, 45px);
  }
  12% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: translate(0, 0);
  }
}

@keyframes meteor-head {
  0%,
  8% {
    opacity: 0;
    transform: translate(-45px, 45px);
  }
  78% {
    opacity: 1;
    transform: translate(0, 0);
  }
  100% {
    opacity: 0;
    transform: translate(2px, -2px);
  }
}

@keyframes locator-pulse {
  0%,
  100% {
    opacity: .35;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-generating .meteor-trail,
  .is-generating .meteor-head {
    animation: none;
    opacity: .8;
  }

  .is-arriving .meteor-trail,
  .is-arriving .meteor-head {
    animation: none;
    opacity: 0;
  }

  .is-ready .locator-halo,
  .is-ready .locator-rays,
  .is-ready .locator-core {
    animation: none;
    opacity: .85;
  }
}
</style>
