<template>
  <view :class="['app', themeClass]">
    <slot />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from './store/user.js'
import { useThemeStore } from './store/theme.js'
import { usePushStore } from './store/push.js'

const userStore = useUserStore()
const themeStore = useThemeStore()
const pushStore = usePushStore()

// 计算主题CSS类名
const themeClass = computed(() => themeStore.getThemeClass())

// 小程序启动时执行
onLaunch(() => {
  console.log('App Launch')

  // 初始化用户状态
  userStore.initFromStorage()

  // 初始化推送状态
  pushStore.initFromStorage()

  // 初始化主题
  themeStore.initTheme()
})

// 小程序显示时执行
onShow(() => {
  console.log('App Show')

  // 检查登录状态
  if (userStore.token) {
    userStore.checkLoginStatus()
  }
})

// 小程序隐藏时执行
onHide(() => {
  console.log('App Hide')
})
</script>

<style>
@import './styles/common.css';
@import './styles/themes/chinese.css';
@import './styles/themes/modern.css';
@import './styles/themes/dark.css';
@import './styles/themes/cute.css';

/* 全局盒模型 */
page {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 主题根变量 */
.app {
  --primary-color: #e74c3c;
  --secondary-color: #f39c12;
  --text-color: #333333;
  --text-secondary: #666666;
  --bg-color: #f8f8f8;
  --card-bg: #ffffff;
  --border-color: #eeeeee;
}
</style>
