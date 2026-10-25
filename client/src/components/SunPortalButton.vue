<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { StarCoronaCanvasEffect } from '../scripts/core/galaxy/StarCoronaEffect'

withDefaults(
  defineProps<{
    label?: string
    title?: string
    disabled?: boolean
    notification?: boolean
  }>(),
  {
    label: '上划进入星空',
    title: '上划进入星空',
    disabled: false,
    notification: false,
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
const isSwiping = ref(false)
const glowOffset = ref({ x: 0, y: 0, blur: 10, opacity: 0.72 })
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
  if (event.isTrusted) (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  const deltaX = event.clientX - pointerStart.x
  const deltaY = event.clientY - pointerStart.y
  const distance = Math.hypot(deltaX, deltaY)
  const strength = Math.min(1, distance / 64)
  const offset = strength * 7
  glowOffset.value = {
    x: distance === 0 ? 0 : (deltaX / distance) * offset,
    y: distance === 0 ? 0 : (deltaY / distance) * offset,
    blur: 10 + strength * 5,
    opacity: 0.72 + strength * 0.24,
  }
}

function resetGlow() {
  glowOffset.value = { x: 0, y: 0, blur: 10, opacity: 0.72 }
}

function handlePointerUp(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  handlePointerMove(event)
  const deltaY = pointerStart.y - event.clientY
  const deltaX = pointerStart.x - event.clientX
  pointerStart = undefined
  isSwiping.value = false
  resetGlow()
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
  resetGlow()
}

onBeforeUnmount(() => effect?.destroy())
</script>

<template>
  <button class="sun-portal-button" type="button" :aria-label="label" :title="title" :disabled="disabled"
    :class="{ 'is-swiping': isSwiping, 'has-notification': notification }" :style="{
      '--glow-x': `${glowOffset.x}px`,
      '--glow-y': `${glowOffset.y}px`,
      '--glow-blur': `${glowOffset.blur}px`,
      '--glow-opacity': glowOffset.opacity,
    }" @pointerdown.stop="handlePointerDown" @pointermove.stop="handlePointerMove" @pointerup.stop="handlePointerUp"
    @pointercancel.stop="clearPointer" @click.stop="handleClick" @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick" @keydown.arrow-up.prevent="emit('swipe-up')"
    @keydown.arrow-down.prevent="emit('swipe-down')" @keydown.arrow-left.prevent="emit('swipe-left')"
    @keydown.arrow-right.prevent="emit('swipe-right')">
    <canvas ref="canvas" class="sun-portal-canvas" aria-hidden="true"></canvas>
  </button>
</template>

<style scoped>
.sun-portal-button {
  position: relative;
  display: block;
  width: 61.6px;
  height: 61.6px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #fff9dc;
  filter: drop-shadow(var(--glow-x) var(--glow-y) 10px rgba(255, 217, 112, 0.72));
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: filter 180ms ease;
}

.sun-portal-button.is-swiping {
  transition: none;
  animation: none;
  filter: drop-shadow(var(--glow-x) var(--glow-y) var(--glow-blur) rgba(255, 226, 145, var(--glow-opacity)));
}

.sun-portal-button.has-notification {
  animation: sun-portal-notification-glow 1.25s ease-in-out infinite;
}

.sun-portal-button.has-notification::before {
  position: absolute;
  z-index: 0;
  inset: -34%;
  border-radius: 50%;
  background: radial-gradient(ellipse,
      rgba(255, 235, 174, 0.78) 0%,
      rgba(255, 205, 91, 0.46) 34%,
      rgba(255, 173, 52, 0.18) 54%,
      transparent 72%);
  filter: blur(8px);
  content: '';
  pointer-events: none;
  animation: sun-portal-notification-halo 1.25s ease-in-out infinite;
}

@keyframes sun-portal-notification-glow {

  0%,
  100% {
    filter: drop-shadow(0 0 9px rgba(255, 217, 112, 0.58)) drop-shadow(0 0 17px rgba(255, 235, 174, 0.68));
  }

  50% {
    filter: drop-shadow(0 0 11px rgba(255, 235, 174, 0.78)) drop-shadow(0 0 21px rgba(255, 205, 91, 0.74));
  }
}

@keyframes sun-portal-notification-halo {

  0%,
  100% {
    opacity: 0.62;
    transform: scale(0.72);
  }

  50% {
    opacity: 0.82;
    transform: scale(0.92);
  }
}

.sun-portal-button:hover:not(:disabled) {
  filter: drop-shadow(var(--glow-x) var(--glow-y) 16px rgba(255, 235, 174, 0.96));
}

.sun-portal-button:focus,
.sun-portal-button:focus-visible {
  outline: 0;
  box-shadow: none;
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
  width: 85.9px;
  height: 85.9px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .sun-portal-button {
    transition: none;
    animation: none;
  }

  .sun-portal-button.has-notification {
    filter: drop-shadow(0 0 15px rgba(255, 217, 112, 0.9)) drop-shadow(0 0 30px rgba(255, 173, 52, 0.72));
  }

  .sun-portal-button.has-notification::before {
    opacity: 0.9;
    animation: none;
  }
}
</style>
