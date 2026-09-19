import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { post } from '../scripts/request'

interface AuthUser {
  account: string
  name?: string
}

const STORAGE_KEY = 'bambloo-auth'

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false)
  const user = ref<AuthUser | null>(null)
  let hydrationPromise: Promise<void> | null = null

  const currentUser = computed(() => user.value)

  function clearLocalState() {
    isLoggedIn.value = false
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  function hydrate() {
    if (hydrationPromise) return hydrationPromise

    hydrationPromise = post('/wpi/user/check', ref(false))
      .then((packet) => {
        const data = packet.data as { token?: string; account?: string; name?: string } | undefined
        if (!data?.token || !data.account) {
          throw new Error('Invalid session response')
        }
        localStorage.setItem(STORAGE_KEY, data.token)
        isLoggedIn.value = true
        user.value = { account: data.account, name: data.name }
      })
      .catch(() => {
        clearLocalState()
      })

    return hydrationPromise
  }

  function resetHydration() {
    hydrationPromise = null
  }

  function loadCachedState() {
    isLoggedIn.value = !!localStorage.getItem(STORAGE_KEY)
  }

  function login(token: string, nextUser?: AuthUser) {
    localStorage.setItem(STORAGE_KEY, token)
    user.value = nextUser ?? null
    isLoggedIn.value = true
  }

  async function logout() {
    try {
      await post('/wpi/user/logout', ref(false))
    } catch {
      // Local credentials must still be cleared when the server is unavailable.
    }
    clearLocalState()
    resetHydration()
  }

  loadCachedState()

  return {
    isLoggedIn,
    currentUser,
    login,
    logout,
    hydrate,
  }
})
