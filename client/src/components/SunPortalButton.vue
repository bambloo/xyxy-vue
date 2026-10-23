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
let effect: StarCoronaCanvasEffect | undefined
let pointerStart: { id: number; x: number; y: number } | undefined
let suppressNextClick = false

onMounted(() => {
  if (canvas.value) effect = new StarCoronaCanvasEffect(canvas.value)
})

function handlePointerDown(event: PointerEvent) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  if (event.isTrusted) (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId)
}

function handlePointerUp(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  const deltaY = pointerStart.y - event.clientY
  const deltaX = pointerStart.x - event.clientX
  pointerStart = undefined
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
    @pointerdown.stop="handlePointerDown"
    @pointermove.stop
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
  filter: drop-shadow(0 0 10.5px rgba(255, 207, 31, 0.7));
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: filter 180ms ease;
}

.sun-portal-button:hover:not(:disabled) {
  filter: drop-shadow(0 0 16.1px rgba(255, 226, 69, 0.95));
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
