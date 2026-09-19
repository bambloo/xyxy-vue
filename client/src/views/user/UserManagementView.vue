<script setup lang="ts">
import { computed, ref } from 'vue'
import UserLayout from './UserLayout.vue'
import ProfileView from './profile/ProfileView.vue'
import PasswordView from './security/PasswordView.vue'
import SecuritySettingsView from './security/SecuritySettingsView.vue'
type TabKey = 'profile' | 'password' | 'security'

const currentTab = ref<TabKey>('profile')

const activeView = computed(() => {
  switch (currentTab.value) {
    case 'password':
      return PasswordView
    case 'security':
      return SecuritySettingsView
    case 'profile':
    default:
      return ProfileView
  }
})

function setTab(tab: TabKey) {
  currentTab.value = tab
}
</script>

<template>
  <UserLayout :current-tab="currentTab" @tab-change="setTab">
    <component :is="activeView" />
  </UserLayout>
</template>
