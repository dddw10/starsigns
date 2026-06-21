import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, getUserInfoApi, updateUserInfoApi } from '../api/user.js'

export const useUserStore = defineStore('user', () => {
  // 用户信息
  const userInfo = ref(null)
  // 登录token
  const token = ref('')
  // 是否已登录
  const isLoggedIn = computed(() => !!token.value)

  // 从本地存储初始化
  function initFromStorage() {
    try {
      const storedToken = uni.getStorageSync('user_token')
      const storedUserInfo = uni.getStorageSync('user_info')
      if (storedToken) {
        token.value = storedToken
      }
      if (storedUserInfo) {
        userInfo.value = JSON.parse(storedUserInfo)
      }
    } catch (e) {
      console.error('读取本地存储失败:', e)
    }
  }

  // 微信登录 / H5 模拟登录
  let loginPromise = null
  async function login() {
    if (loginPromise) {
      return loginPromise
    }

    loginPromise = (async () => {
      try {
        let code = 'h5-mock-code'

        // #ifdef H5
        // 为 H5 用户生成持久化的唯一标识作为 mock code，避免所有人共享同一个用户数据
        let h5Uuid = uni.getStorageSync('h5_user_uuid')
        if (!h5Uuid) {
          h5Uuid = 'h5-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
          uni.setStorageSync('h5_user_uuid', h5Uuid)
        }
        code = h5Uuid
        // #endif

        // #ifdef MP-WECHAT
        // 获取微信登录code
        const loginResult = await uni.login({ provider: 'weixin' })
        code = loginResult.code
        // #endif

        // 调用后端登录接口
        const res = await loginApi({ code })

        if (res.code === 0) {
          token.value = res.data.token
          userInfo.value = res.data.userInfo

          // 存储到本地
          uni.setStorageSync('user_token', res.data.token)
          uni.setStorageSync('user_info', JSON.stringify(res.data.userInfo))

          return { success: true }
        } else {
          return { success: false, message: res.message }
        }
      } catch (e) {
        console.error('登录失败:', e)
        return { success: false, message: '登录失败，请重试' }
      } finally {
        loginPromise = null
      }
    })()

    return loginPromise
  }

  // 退出登录
  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync('user_token')
    uni.removeStorageSync('user_info')
    uni.reLaunch({ url: '/pages/index/index' })
  }

  // 更新用户信息
  async function updateUserInfo(data) {
    try {
      const res = await updateUserInfoApi(data)
      if (res.code === 0) {
        userInfo.value = { ...userInfo.value, ...data }
        uni.setStorageSync('user_info', JSON.stringify(userInfo.value))
        return { success: true }
      }
      return { success: false, message: res.message }
    } catch (e) {
      console.error('更新用户信息失败:', e)
      return { success: false, message: '更新失败' }
    }
  }

  // 获取最新用户信息
  async function fetchUserInfo() {
    try {
      const res = await getUserInfoApi()
      if (res.code === 0) {
        userInfo.value = res.data
        uni.setStorageSync('user_info', JSON.stringify(res.data))
      }
    } catch (e) {
      console.error('获取用户信息失败:', e)
    }
  }

  // 检查登录状态
  async function checkLoginStatus() {
    try {
      await fetchUserInfo()
    } catch (e) {
      // token过期，清除登录状态
      logout()
    }
  }

  // 更新主题
  function updateTheme(theme) {
    if (userInfo.value) {
      userInfo.value.theme = theme
      uni.setStorageSync('user_info', JSON.stringify(userInfo.value))
    }
  }

  return {
    userInfo,
    token,
    isLoggedIn,
    initFromStorage,
    login,
    logout,
    updateUserInfo,
    fetchUserInfo,
    checkLoginStatus,
    updateTheme
  }
})
