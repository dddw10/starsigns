<template>
  <view class="theme-switcher" @click="toggleTheme">
    <text class="theme-icon">{{ currentIcon }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useThemeStore } from '@/store/theme'

const themeStore = useThemeStore()

const currentIcon = computed(() => {
  const icons = { chinese: '🏮', modern: '✨', dark: '🌙', cute: '🌸' }
  return icons[themeStore.currentTheme] || '🏮'
})

const toggleTheme = () => {
  const themes = ['chinese', 'modern', 'dark', 'cute']
  const currentIndex = themes.indexOf(themeStore.currentTheme)
  const nextIndex = (currentIndex + 1) % themes.length
  themeStore.setTheme(themes[nextIndex])
}
</script>

<style scoped>
.theme-switcher {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg, #fff);
  border-radius: 50%;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}

.theme-icon {
  font-size: 32rpx;
}
</style>
