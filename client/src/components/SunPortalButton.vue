<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { StarCoronaCanvasEffect } from '../scripts/core/galaxy/StarCoronaEffect'

withDefaults(
  defineProps<{
    label?: string
    title?: string
    disabled?: boolean
  }>(),
  {
    label: '上划进入星空',
    title: '上划进入星空',
    disabled: false,
  },
)

const emit = defineEmits<{
  activate: []
  'swipe-up': []
  'swipe-down': []
  'swipe-left': []
  'swipe-right': []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const swipeGlow = ref({ x: 0, y: 0, angle: 0, stretch: 1, strength: 0 })
const isSwiping = ref(false)
let effect: StarCoronaCanvasEffect | undefined
let pointerStart: { id: number; x: number; y: number } | undefined
let suppressNextClick = false

onMounted(() => {
  if (canvas.value) effect = new StarCoronaCanvasEffect(canvas.value)
})

function handlePointerDown(event: PointerEvent) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  isSwiping.value = true
  swipeGlow.value = { x: 0, y: 0, angle: 0, stretch: 1, strength: 0 }
  if (event.isTrusted) (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  const deltaX = event.clientX - pointerStart.x
  const deltaY = event.clientY - pointerStart.y
  const distance = Math.hypot(deltaX, deltaY)
  const strength = distance < 8 ? 0 : Math.min(1, (distance - 8) / 48)
  const glowOffset = 16 * strength
  const directionX = distance === 0 ? 0 : deltaX / distance
  const directionY = distance === 0 ? 0 : deltaY / distance
  swipeGlow.value = {
    x: directionX * glowOffset,
    y: directionY * glowOffset,
    angle: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
    stretch: 1 + strength * 0.9,
    strength,
  }
}

function handlePointerUp(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  handlePointerMove(event)
  const deltaY = pointerStart.y - event.clientY
  const deltaX = pointerStart.x - event.clientX
  pointerStart = undefined
  isSwiping.value = false
  swipeGlow.value = { x: 0, y: 0, angle: 0, stretch: 1, strength: 0 }
  if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
    suppressNextClick = true
    if (deltaX > 0) emit('swipe-left')
    else emit('swipe-right')
    return
  }
  if (Math.abs(deltaY) >= 48 && Math.abs(deltaY) > Math.abs(deltaX)) {
    suppressNextClick = true
    if (deltaY > 0) emit('swipe-up')
    else emit('swipe-down')
  }
}

function handleClick() {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  emit('activate')
}

function clearPointer() {
  pointerStart = undefined
  isSwiping.value = false
  swipeGlow.value = { x: 0, y: 0, angle: 0, stretch: 1, strength: 0 }
}

onBeforeUnmount(() => effect?.destroy())
</script>

<template>
  <button
    class="sun-portal-button"
    type="button"
    :aria-label="label"
    :title="title"
    :disabled="disabled"
    :class="{ 'is-swiping': isSwiping }"
    :style="{
      '--swipe-glow-x': `${swipeGlow.x}px`,
      '--swipe-glow-y': `${swipeGlow.y}px`,
      '--swipe-glow-angle': `${swipeGlow.angle}deg`,
      '--swipe-glow-stretch': swipeGlow.stretch,
      '--swipe-glow-opacity': swipeGlow.strength,
    }"
    @pointerdown.stop="handlePointerDown"
    @pointermove.stop="handlePointerMove"
    @pointerup.stop="handlePointerUp"
    @pointercancel.stop="clearPointer"
    @click.stop="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
    @keydown.arrow-up.prevent="emit('swipe-up')"
    @keydown.arrow-down.prevent="emit('swipe-down')"
    @keydown.arrow-left.prevent="emit('swipe-left')"
    @keydown.arrow-right.prevent="emit('swipe-right')"
  >
    <canvas ref="canvas" class="sun-portal-canvas" aria-hidden="true"></canvas>
  </button>
</template>

<style scoped>
.sun-portal-button {
  position: relative;
  display: block;
  width: 92.4px;
  height: 92.4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #fff9dc;
  filter: drop-shadow(
    var(--swipe-glow-x) var(--swipe-glow-y) 10.5px rgba(255, 207, 31, 0.7)
  );
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: filter 180ms ease;
}

.sun-portal-button::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 50%;
  background: radial-gradient(
    ellipse 68% 42% at center,
    rgba(255, 232, 109, 0.9),
    rgba(255, 175, 25, 0.48) 48%,
    transparent 78%
  );
  content: '';
  filter: blur(10px);
  opacity: var(--swipe-glow-opacity);
  pointer-events: none;
  transform: translate(var(--swipe-glow-x), var(--swipe-glow-y))
    rotate(var(--swipe-glow-angle)) scaleX(var(--swipe-glow-stretch));
  transition: opacity 140ms ease;
}

.sun-portal-button.is-swiping {
  transition: none;
}

.sun-portal-button:hover:not(:disabled) {
  filter: drop-shadow(
    var(--swipe-glow-x) var(--swipe-glow-y) 16.1px rgba(255, 226, 69, 0.95)
  );
}

.sun-portal-button:focus-visible {
  outline: 2px solid #d9ffff;
  outline-offset: 5px;
}

.sun-portal-button:active:not(:disabled) {
  cursor: grabbing;
}

.sun-portal-button:disabled {
  cursor: default;
}

.sun-portal-canvas {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  display: block;
  width: 128.8px;
  height: 128.8px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .sun-portal-button {
    transition: none;
  }
}
</style>
