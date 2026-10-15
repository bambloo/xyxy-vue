<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { post } from '../../scripts/request'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)
const count = ref(5)
const errorMessage = ref('')
const statusMessage = ref('')
const createdCount = ref<number>()
const starIds = ref<string[]>([])

async function createBlackHoleStars() {
  errorMessage.value = ''
  statusMessage.value = ''
  createdCount.value = undefined
  starIds.value = []
  try {
    const packet = await post('/wpi/user/galaxy-star', loading, {
      action: 'seedBlackHole',
      count: count.value,
    })
    const data = packet.data as { createdCount?: number; starIds?: string[] } | undefined
    if (
      typeof data?.createdCount !== 'number' ||
      !Array.isArray(data.starIds) ||
      !data.starIds.every((id) => typeof id === 'string')
    ) {
      throw new Error(t('galaxyTest.invalidResponse'))
    }
    createdCount.value = data.createdCount
    starIds.value = data.starIds
    statusMessage.value = t('galaxyTest.created', {
      created: data.createdCount,
      total: data.starIds.length,
    })
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('galaxyTest.createFailed')
  }
}
</script>

<template>
  <section class="galaxy-test-page">
    <header class="page-heading">
      <p class="eyebrow">{{ t('galaxyTest.eyebrow') }}</p>
      <h1>{{ t('galaxyTest.title') }}</h1>
      <p>{{ t('galaxyTest.intro') }}</p>
    </header>

    <form class="test-card" @submit.prevent="createBlackHoleStars">
      <label for="black-hole-count">{{ t('galaxyTest.countLabel') }}</label>
      <p class="test-description">{{ t('galaxyTest.countHint') }}</p>
      <div class="test-actions">
        <input
          id="black-hole-count"
          v-model.number="count"
          type="number"
          min="1"
          max="100"
          required
          :disabled="loading"
        />
        <button type="submit" :disabled="loading">
          {{ loading ? t('galaxyTest.creating') : t('galaxyTest.createButton') }}
        </button>
      </div>

      <p v-if="errorMessage" class="message error" role="alert">{{ errorMessage }}</p>
      <p v-if="statusMessage" class="message success" role="status">{{ statusMessage }}</p>
      <ul v-if="starIds.length" class="created-stars">
        <li v-for="id in starIds" :key="id">{{ id }}</li>
      </ul>
      <button
        v-if="createdCount !== undefined"
        class="preview-button"
        type="button"
        @click="router.push({ name: 'blackhole' })"
      >
        {{ t('galaxyTest.openBlackHole') }}
      </button>
    </form>
  </section>
</template>

<style scoped lang="scss">
.galaxy-test-page {
  max-width: 860px;
  margin: 0 auto;
  color: var(--space-text);
}

.page-heading {
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: var(--space-gold);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.5rem);
}

.page-heading > p:last-child,
.test-description {
  color: var(--space-muted);
  line-height: 1.7;
}

.test-card {
  padding: clamp(1.25rem, 3vw, 2rem);
  border: 1px solid var(--space-line);
  border-radius: 20px;
  background: rgba(5, 18, 36, 0.72);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.18);
}

.test-card label {
  font-size: 1.05rem;
  font-weight: 700;
}

.test-description {
  margin: 0.5rem 0 1rem;
}

.test-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

input {
  width: 100px;
  padding: 0.75rem;
  border: 1px solid var(--space-line);
  border-radius: 10px;
  background: rgba(2, 10, 23, 0.7);
  color: var(--space-text);
  font: inherit;
}

button {
  padding: 0.75rem 1rem;
  border: 1px solid rgba(240, 189, 99, 0.52);
  border-radius: 10px;
  background: rgba(240, 189, 99, 0.14);
  color: var(--space-text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.message {
  margin: 1rem 0 0;
  line-height: 1.6;
}

.error {
  color: #ffb4c2;
}

.success {
  color: #a5ebc7;
}

.created-stars {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0;
  color: var(--space-muted);
  font-family: monospace;
  list-style: none;
}

.preview-button {
  margin-top: 0.75rem;
}
</style>
