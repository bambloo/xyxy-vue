<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UserLayout from './UserLayout.vue'

type TabKey = 'profile' | 'password' | 'security' | 'users'

const route = useRoute()

const currentTab = computed<TabKey>(() => {
  switch (route.name) {
    case 'user-password':
      return 'password'
    case 'user-security':
      return 'security'
    case 'user-users':
      return 'users'
    case 'user-profile':
    default:
      return 'profile'
  }
})
</script>

<template>
  <UserLayout :current-tab="currentTab">
    <RouterView />
  </UserLayout>
</template>
