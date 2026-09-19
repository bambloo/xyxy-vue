<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import type { UserPublicProfile } from '../../../common/entity/user'

const props = defineProps<{ tag: string }>()
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const message = ref('')
const completed = ref(false)
const user = reactive({
  name: '',
  phone: '',
  email: '',
  birthday: '',
  hobbies: '',
  avatar: '',
})

async function activate() {
  message.value = ''
  try {
    const packet = await post('/wpi/user/activate', loading, { tag: props.tag, ...user })
    const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
    if (!data?.token || !data.account || !data.tag) throw new Error(t('tag.activateError'))
    const { token, ...profile } = data
    auth.login(token, profile)
    await router.replace({ name: 'home' })
  } catch (error: unknown) {
    const result = error as { msg?: string; message?: string }
    message.value = result.msg || result.message || t('tag.activateError')
  }
}
</script>

<template>
  <section class="activation-panel">
    <template v-if="!completed">
      <p class="eyebrow">{{ t('tag.activateEyebrow') }}</p>
      <h1>{{ t('tag.activateTitle') }}</h1>
      <p class="tag-value">{{ t('tag.tagLabel') }}: {{ tag }}</p>
      <form @submit.prevent="activate">
        <label><span>{{ t('common.name') }}</span><input v-model="user.name" required type="text" /></label>
        <label><span>{{ t('common.phone') }}</span><input v-model="user.phone" type="tel" /></label>
        <label><span>{{ t('profile.email') }}</span><input v-model="user.email" type="email" /></label>
        <label><span>{{ t('profile.birthday') }}</span><input v-model="user.birthday" type="date" /></label>
        <label class="full-width"><span>{{ t('profile.hobbies') }}</span><textarea v-model="user.hobbies"
            rows="4" /></label>
        <label class="full-width"><span>{{ t('tag.avatar') }}</span><input v-model="user.avatar" type="url" /></label>
        <p v-if="message" class="error-message" role="alert">{{ message }}</p>
        <button type="submit" :disabled="loading">{{ loading ? t('tag.activating') : t('tag.activateButton') }}</button>
      </form>
    </template>
    <p v-else class="success-message" role="status">{{ t('tag.activateSuccess') }}</p>
  </section>
</template>

<style scoped>
.activation-panel {
  width: min(680px, calc(100% - 2rem));
  margin: 4rem auto;
  padding: 2rem;
  box-sizing: border-box;
  border: 1px solid var(--space-line);
  border-radius: 16px;
  background: var(--space-panel);
  backdrop-filter: blur(16px);
}

.eyebrow {
  margin: 0 0 .5rem;
  color: var(--space-gold);
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .14em;
}

h1 {
  margin: 0;
}

.tag-value {
  color: var(--space-muted);
}

form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

label {
  display: grid;
  gap: .45rem;
  color: var(--space-text);
  font-size: .85rem;
}

input,
textarea {
  box-sizing: border-box;
  width: 100%;
  padding: .75rem;
  border: 1px solid var(--space-line);
  border-radius: 8px;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
}

.full-width,
.error-message,
button {
  grid-column: 1 / -1;
}

button {
  padding: .8rem 1rem;
  border: 0;
  border-radius: 8px;
  background: var(--space-gold);
  color: #091728;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  opacity: .6;
  cursor: wait;
}

.error-message {
  margin: 0;
  color: #ffb4a8;
}

.success-message {
  color: #b9d9f2;
  font-weight: 700;
}

@media (max-width: 620px) {
  form {
    grid-template-columns: 1fr;
  }
}
</style>
