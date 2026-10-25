<script setup lang="ts">
import '@/styles/daily-fortune.css'
import { timeFortuneOrder, timeFortuneRange } from '@/utils/time-fortune'

interface TimeFortune {
  timeName: string
  message: string
}

interface FortuneDay {
  date: string
  dailyFortune: string
  timeFortunes: TimeFortune[]
}

defineProps<{
  days: FortuneDay[]
}>()

function orderedTimeFortunes(fortunes: TimeFortune[]) {
  return [...fortunes].sort(
    (first, second) => timeFortuneOrder(first.timeName) - timeFortuneOrder(second.timeName),
  )
}

function orderedDays(historyDays: FortuneDay[]) {
  return [...historyDays].sort((first, second) => second.date.localeCompare(first.date))
}

function toggleHistoryEntry(event: MouseEvent) {
  const entry = event.currentTarget
  if (!(entry instanceof HTMLDetailsElement)) return
  event.preventDefault()
  entry.open = !entry.open
}
</script>

<template>
  <details v-for="(day, index) in orderedDays(days)" :key="day.date" class="history-day" :open="index === 0">
    <summary>{{ day.date }}</summary>
    <details v-if="day.dailyFortune" class="history-entry daily-history-entry" :open="index === 0"
      @click="toggleHistoryEntry">
      <summary>每日锦言</summary>
      <p>{{ day.dailyFortune }}</p>
    </details>
    <details v-for="(fortune, fortuneIndex) in orderedTimeFortunes(day.timeFortunes)" :key="fortune.timeName"
      class="history-entry time-history-entry" :class="{
        'latest-time-history-entry': index === 0 && fortuneIndex === day.timeFortunes.length - 1,
      }" :open="index === 0 && fortuneIndex === 0" @click="toggleHistoryEntry">
      <summary>{{ fortune.timeName }}（{{ timeFortuneRange(fortune.timeName) }}）</summary>
      <p>{{ fortune.message }}</p>
    </details>
  </details>
</template>

<style scoped>
.history-day {
  margin-top: 12px;
}

.history-day>summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #f4e6bf;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  list-style: none;
  transition:
    background-color 220ms ease,
    border-color 220ms ease,
    color 220ms ease;
}

.history-day>summary::-webkit-details-marker,
.history-entry>summary::-webkit-details-marker {
  display: none;
}

.history-day>summary::before,
.history-entry>summary::before {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-top: 1.5px solid #edc981;
  border-right: 1.5px solid #edc981;
  content: '';
  transform: rotate(45deg);
  transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.history-day[open]>summary::before,
.history-entry[open]>summary::before {
  transform: rotate(135deg);
}

.history-day[open]>summary {
  margin-bottom: 12px;
}

.history-entry {
  margin-top: 10px;
  padding: 14px 16px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  cursor: pointer;
}

.daily-history-entry,
.time-history-entry {
  margin-inline-start: 16px;
}

.daily-history-entry>summary,
.latest-time-history-entry>summary {
  color: #f5d58e;
  font-weight: 600;
}

.history-entry>summary {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: center;
  gap: 10px;
  color: #edc981;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.6;
  list-style: none;
}

.history-entry[open]>summary {
  margin-bottom: 10px;
  color: #f5d58e;
}

.history-day::details-content,
.history-entry::details-content {
  block-size: 0;
  overflow: clip;
  opacity: 0;
  transform: translateY(-5px);
  transition:
    block-size 360ms cubic-bezier(0.2, 0.8, 0.2, 1),
    content-visibility 360ms allow-discrete,
    opacity 220ms ease,
    transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.history-day[open]::details-content,
.history-entry[open]::details-content {
  block-size: auto;
  opacity: 1;
  transform: translateY(0);
}

.history-entry p {
  margin: 0;
  color: #e7eef8;
  font-size: 15px;
  line-height: 1.8;
  white-space: pre-wrap;
}

@media (prefers-reduced-motion: reduce) {

  .history-day>summary,
  .history-day>summary::before,
  .history-entry>summary::before,
  .history-day::details-content,
  .history-entry::details-content {
    transition: none;
  }
}
</style>
