import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // 当前主题: chinese/modern/dark/cute
  const currentTheme = ref('chinese')

  // 主题配置
  const themeList = [
    { id: 'chinese', name: '中国风', icon: '🏮' },
    { id: 'modern', name: '现代简约', icon: '✨' },
    { id: 'dark', name: '神秘暗黑', icon: '🌙' },
    { id: 'cute', name: '卡通可爱', icon: '🌸' }
  ]

  // 初始化主题
  function initTheme() {
    const stored = uni.getStorageSync('app_theme')
    if (stored && themeList.some(t => t.id === stored)) {
      currentTheme.value = stored
    }
  }

  // 切换主题
  function setTheme(theme) {
    if (themeList.some(t => t.id === theme)) {
      currentTheme.value = theme
      uni.setStorageSync('app_theme', theme)
    }
  }

  // 获取主题CSS类名
  function getThemeClass() {
    return `theme-${currentTheme.value}`
  }

  // 获取主题名称
  function getThemeName() {
    const found = themeList.find(t => t.id === currentTheme.value)
    return found ? found.name : '中国风'
  }

  // 获取所有主题列表
  function getThemeList() {
    return themeList
  }

  return {
    currentTheme,
    themeList,
    initTheme,
    setTheme,
    getThemeClass,
    getThemeName,
    getThemeList
  }
})
