import { defineStore } from 'pinia'
import { ref } from 'vue'
import { updatePushSettingsApi } from '../api/push.js'

const SUBSCRIBE_TEMPLATE_IDS = []

export const usePushStore = defineStore('push', () => {
  // 是否开启推送
  const pushEnabled = ref(false)
  // 推送时间 (格式: HH:mm)
  const pushTime = ref('08:00')
  // 推送类型
  const pushTypes = ref({
    dailyFortune: true,   // 每日运势
    constellation: false,  // 星座提醒
    tarot: false,          // 塔罗提醒
    bazi: false            // 八字提醒
  })

  // 从本地存储初始化
  function initFromStorage() {
    try {
      const stored = uni.getStorageSync('push_settings')
      if (stored) {
        const data = JSON.parse(stored)
        pushEnabled.value = data.pushEnabled || false
        pushTime.value = data.pushTime || '08:00'
        pushTypes.value = data.pushTypes || pushTypes.value
      }
    } catch (e) {
      console.error('读取推送设置失败:', e)
    }
  }

  // 开关推送
  async function togglePush(enabled = !pushEnabled.value) {
    pushEnabled.value = enabled

    // 请求微信订阅消息权限
    if (pushEnabled.value) {
      const subscribed = await requestSubscribeMessage()
      if (!subscribed) {
        pushEnabled.value = false
      }
    }

    await saveSettings()
  }

  // 设置推送时间
  function setPushTime(time) {
    pushTime.value = time
    saveSettings()
  }

  // 更新推送类型
  function updatePushType(type, enabled) {
    if (pushTypes.value.hasOwnProperty(type)) {
      pushTypes.value[type] = enabled
      saveSettings()
    }
  }

  // 保存设置到本地并同步服务器
  async function saveSettings() {
    const settings = {
      pushEnabled: pushEnabled.value,
      pushTime: pushTime.value,
      pushTypes: pushTypes.value
    }

    uni.setStorageSync('push_settings', JSON.stringify(settings))

    try {
      await updatePushSettingsApi(settings)
    } catch (e) {
      console.error('同步推送设置失败:', e)
    }
  }

  // 请求订阅消息权限
  function requestSubscribeMessage() {
    // #ifndef MP-WECHAT
    return Promise.resolve(true)
    // #endif
    // #ifdef MP-WECHAT
    if (!SUBSCRIBE_TEMPLATE_IDS.length) {
      uni.showToast({
        title: '微信订阅模板未配置，已保存本地设置',
        icon: 'none'
      })
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      uni.requestSubscribeMessage({
        tmplIds: SUBSCRIBE_TEMPLATE_IDS,
        success: (res) => {
          console.log('订阅消息授权成功:', res)
          resolve(true)
        },
        fail: (err) => {
          console.error('订阅消息授权失败:', err)
          uni.showToast({ title: '授权失败，请稍后重试', icon: 'none' })
          resolve(false)
        }
      })
    })
    // #endif
  }

  return {
    pushEnabled,
    pushTime,
    pushTypes,
    initFromStorage,
    togglePush,
    setPushTime,
    updatePushType
  }
})
