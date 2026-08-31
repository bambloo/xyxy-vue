import { createVuestic } from 'vuestic-ui'
import 'vuestic-ui/styles/essential.css'
import 'vuestic-ui/styles/typography.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import vuesticGlobalConfig from './scripts/vuestic/config'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.use(createVuestic({ config: vuesticGlobalConfig }))

app.mount('#app')
