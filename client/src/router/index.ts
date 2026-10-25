import GalaxyView from '@/views/GalaxyView.vue'
import LoginView from '@/views/LoginView.vue'
import TagUserView from '@/views/TagUserView.vue'
import UserManagementView from '@/views/user/UserManagementView.vue'
import ProfileView from '@/views/user/profile/ProfileView.vue'
import PasswordView from '@/views/user/security/PasswordView.vue'
import SecuritySettingsView from '@/views/user/security/SecuritySettingsView.vue'
import UserListView from '@/views/user/users/UserListView.vue'
import SiteInfoDialog from '@/components/dialogs/SiteInfoDialog.vue'
import GalaxyTestView from '@/views/user/GalaxyTestView.vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const history =
  window.location.protocol === 'file:'
    ? createWebHashHistory()
    : createWebHistory(import.meta.env.BASE_URL)

const router = createRouter({
  history,
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/admin',
      component: UserManagementView,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'user-profile' } },
        { path: 'profile', name: 'user-profile', component: ProfileView },
        { path: 'password', name: 'user-password', component: PasswordView },
        { path: 'security', name: 'user-security', component: SecuritySettingsView },
        { path: 'users', name: 'user-users', component: UserListView },
        {
          path: 'site-info',
          name: 'user-site-info',
          component: SiteInfoDialog,
          meta: { permissions: ['site.manage'] },
        },
        {
          path: 'galaxy-test',
          name: 'user-galaxy-test',
          component: GalaxyTestView,
          meta: { requiresAdmin: true },
        },
      ],
    },
    {
      path: '/home',
      redirect: { name: 'galaxy' },
    },
    {
      path: '/galaxy',
      name: 'galaxy',
      component: GalaxyView,
    },
    {
      path: '/blackhole',
      name: 'blackhole',
      component: GalaxyView,
      props: { blackHoleView: true },
    },
    {
      path: '/',
      redirect: { name: 'galaxy' },
    },
    {
      path: '/:tag(.*)*',
      name: 'tag',
      component: TagUserView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/admin/profile',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.hydrate()
  if (!auth.isLoggedIn && to.name !== 'galaxy' && to.name !== 'login' && to.name !== 'tag') {
    return { name: 'galaxy' }
  }

  if (to.path === '/login' && auth.isLoggedIn) {
    return '/admin/profile'
  }

  const permissions = to.meta.permissions
  if (to.meta.requiresAdmin && !auth.currentUser?.isAdmin) {
    return { name: 'user-profile' }
  }
  if (
    Array.isArray(permissions) &&
    !auth.currentUser?.isAdmin &&
    !permissions.every((permission) => auth.currentUser?.permissions?.includes(permission))
  ) {
    return { name: 'user-profile' }
  }

  return true
})

export default router
