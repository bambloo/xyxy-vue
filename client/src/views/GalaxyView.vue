<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { SentGalaxyStar } from '../../../common/entity/galaxy-star'
import GalaxyStarComposer from '@/components/GalaxyStarComposer.vue'
import { post } from '@/scripts/request'
import {
  GALAXY_STAR_COMPOSE_EVENT,
  GALAXY_STAR_SEND_STATUS_EVENT,
  GALAXY_STAR_SENT_EVENT,
} from '@/events/galaxy-star'
import { TIME_FORTUNE_OPEN_EVENT } from '@/events/time-fortune'
import { GalaxyScene } from '../scripts/core/galaxy/GalaxyScene.ts'

const canvasHost = ref<HTMLElement | null>(null)
const sceneError = ref('')
const sentStars = ref<SentGalaxyStar[]>([])
const selectedStar = ref<SentGalaxyStar>()
const listLoading = ref(false)
const statusLoading = ref(false)
let galaxyScene: GalaxyScene | undefined
let dailyResetTimer: number | undefined

async function loadGalaxyStars() {
  try {
    const [listPacket, statusPacket] = await Promise.all([
      post('/wpi/user/galaxy-star', listLoading, { action: 'list' }),
      post('/wpi/user/galaxy-star', statusLoading, { action: 'status' }),
    ])
    const listData = listPacket.data as { stars?: SentGalaxyStar[] } | undefined
    const statusData = statusPacket.data as { canSend?: boolean; resetsAt?: string } | undefined
    if (
      !Array.isArray(listData?.stars) ||
      typeof statusData?.canSend !== 'boolean' ||
      typeof statusData.resetsAt !== 'string'
    ) {
      throw new Error('星星数据格式无效')
    }
    sentStars.value = listData.stars
    galaxyScene?.setSentStars(sentStars.value)
    galaxyScene?.setStarSendAvailable(statusData.canSend)
    if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
    const resetDelay = Date.parse(statusData.resetsAt) - Date.now()
    if (Number.isFinite(resetDelay)) {
      dailyResetTimer = window.setTimeout(
        () => void loadGalaxyStars(),
        Math.max(0, resetDelay) + 250,
      )
    }
  } catch (error) {
    console.error('读取银河星星失败', error)
    sceneError.value = '星星加载失败，请刷新后重试。'
  }
}

function handleStarSent(event: Event) {
  const star = (event as CustomEvent<SentGalaxyStar>).detail
  if (!star || sentStars.value.some((existing) => existing.id === star.id)) return
  sentStars.value = [...sentStars.value, star]
  galaxyScene?.setSentStars(sentStars.value)
  galaxyScene?.setStarSendAvailable(false)
}

function handleStarSendStatus(event: Event) {
  galaxyScene?.setStarSendAvailable((event as CustomEvent<boolean>).detail)
}

function handlePointerDown(event: PointerEvent) {
  galaxyScene?.pointerDown(event)
}

function handlePointerMove(event: PointerEvent) {
  galaxyScene?.pointerMove(event)
}

function handlePointerUp(event: PointerEvent) {
  galaxyScene?.pointerUp(event)
}

function handleWheel(event: WheelEvent) {
  galaxyScene?.wheel(event)
}

onMounted(() => {
  if (canvasHost.value) {
    galaxyScene = new GalaxyScene(
      canvasHost.value,
      () => window.dispatchEvent(new Event(TIME_FORTUNE_OPEN_EVENT)),
      () => window.dispatchEvent(new Event(GALAXY_STAR_COMPOSE_EVENT)),
      (star) => {
        selectedStar.value = star
      },
    )
    window.addEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
    window.addEventListener(GALAXY_STAR_SEND_STATUS_EVENT, handleStarSendStatus)
    void loadGalaxyStars()
  }
})

onBeforeUnmount(() => {
  if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
  window.removeEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
  window.removeEventListener(GALAXY_STAR_SEND_STATUS_EVENT, handleStarSendStatus)
  galaxyScene?.destroy()
  galaxyScene = undefined
})
</script>

<template>
  <main class="galaxy-demo" aria-label="旋转星空 Demo">
    <section
      ref="canvasHost"
      class="galaxy-canvas"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @wheel.prevent="handleWheel"
    ></section>
    <GalaxyStarComposer />
    <p v-if="sceneError" class="galaxy-scene-error" role="alert">{{ sceneError }}</p>
    <aside
      v-if="selectedStar"
      class="sent-star-card"
      :style="{ '--star-color': selectedStar.color }"
    >
      <button
        class="sent-star-close"
        type="button"
        aria-label="关闭星星详情"
        @click="selectedStar = undefined"
      >
        ×
      </button>
      <h2>{{ selectedStar.title }}</h2>
      <p>{{ selectedStar.content }}</p>
    </aside>
  </main>
</template>

<style scoped>
.galaxy-demo {
  position: relative;
  isolation: isolate;
  width: 100vw;
  height: 100dvh;
  min-height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at 50% 52%, #152441 0, #090e1d 33%, #02040b 72%);
  color: #eef4ff;
}

.galaxy-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.galaxy-canvas:active {
  cursor: grabbing;
}

.galaxy-canvas :deep(canvas) {
  position: absolute;
  inset: 0;
  display: block;
  max-width: none;
  width: 100%;
  height: 100%;
}

.galaxy-scene-error {
  position: absolute;
  top: 20px;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  margin: 0;
  padding: 10px 16px;
  border: 1px solid rgba(255, 159, 186, 0.5);
  border-radius: 12px;
  background: rgba(30, 9, 22, 0.85);
  color: #ffd9e3;
}

.sent-star-card {
  position: absolute;
  z-index: 2;
  right: max(20px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  width: min(320px, calc(100vw - 40px));
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--star-color) 60%, transparent);
  border-radius: 18px;
  background: rgba(4, 12, 27, 0.9);
  box-shadow: 0 0 28px color-mix(in srgb, var(--star-color) 22%, transparent);
  color: #eef4ff;
  pointer-events: auto;
}

.sent-star-card h2 {
  margin: 0 28px 10px 0;
  color: var(--star-color);
  font-size: 18px;
}

.sent-star-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sent-star-close {
  position: absolute;
  top: 8px;
  right: 10px;
  border: 0;
  background: transparent;
  color: #e8f1fb;
  cursor: pointer;
  font-size: 24px;
}
</style>
