import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useThemeStore } from './store/theme.js'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()

  app.use(pinia)

  // 注册全局 mixin，将 themeClass 注入所有页面的模板上下文中，解决微信小程序中 App.vue 模板失效导致的全局主题失效问题
  app.mixin({
    computed: {
      themeClass() {
        try {
          const themeStore = useThemeStore()
          return themeStore.getThemeClass()
        } catch (e) {
          return 'theme-chinese'
        }
      }
    }
  })

  return {
    app,
    pinia
  }
}
