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
    },
    // 开启全局“发送给朋友”分享，默认分享当前页面及带有的参数
    onShareAppMessage() {
      let path = '/' + (this.$scope?.route || '')
      if (this.$scope?.options) {
        const queryStr = Object.keys(this.$scope.options)
          .map(key => `${key}=${encodeURIComponent(this.$scope.options[key])}`)
          .join('&')
        if (queryStr) {
          path += '?' + queryStr
        }
      }
      return {
        title: '✨ 今日星能量 ✨ 开启您的每日性格分析与灵感密码',
        path: path
      }
    },
    // 开启全局“分享到朋友圈”
    onShareTimeline() {
      let query = ''
      if (this.$scope?.options) {
        query = Object.keys(this.$scope.options)
          .map(key => `${key}=${encodeURIComponent(this.$scope.options[key])}`)
          .join('&')
      }
      return {
        title: '✨ 今日星能量 ✨ 开启您的每日性格分析与灵感密码',
        query: query
      }
    }
  })


  return {
    app,
    pinia
  }
}
