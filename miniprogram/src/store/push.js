import { defineStore } from 'pinia'
import { ref } from 'vue'
import { updatePushSettingsApi, subscribePushApi, unsubscribePushApi } from '../api/push.js'

const SUBSCRIBE_TEMPLATE_IDS = ['-zmwVIKDIP7V8wOPiphv75NMclRxlEwFPzIPvLNE5v4']

export const usePushStore = defineStore('push', () => {
  // 是否开启推送
  const pushEnabled = ref(false)
  // 推送时间 (格式: HH:mm)
  const pushTime = ref('00:00')
  // 推送类型
  const pushTypes = ref({
    dailyFortune: true,   // 每日运势
    constellation: false,  // 星座提醒
    tarot: false,          // 灵感卡牌提醒
    bazi: false            // 生日密码提醒
  })

  // 从本地存储初始化
  function initFromStorage() {
    try {
      const stored = uni.getStorageSync('push_settings')
      if (stored) {
        const data = JSON.parse(stored)
        pushEnabled.value = data.pushEnabled || false
        pushTime.value = data.pushTime || '00:00'
        pushTypes.value = data.pushTypes || pushTypes.value
      }
    } catch (e) {
      console.error('读取推送设置失败:', e)
    }
  }

  // 开关推送
  async function togglePush(enabled = !pushEnabled.value) {
    if (enabled) {
      const subscribed = await requestSubscribeMessage()
      if (!subscribed) return false

      await subscribePushApi({ templateId: SUBSCRIBE_TEMPLATE_IDS[0] })
      pushEnabled.value = true
    } else {
      if (SUBSCRIBE_TEMPLATE_IDS.length) {
        await unsubscribePushApi({ templateId: SUBSCRIBE_TEMPLATE_IDS[0] })
      }
      pushEnabled.value = false
    }

    await saveSettings()
    return true
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
    // #ifndef MP-WEIXIN
    return Promise.resolve(true)
    // #endif
    // #ifdef MP-WEIXIN
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
          const status = res[SUBSCRIBE_TEMPLATE_IDS[0]]
          if (status === 'accept') {
            resolve(true)
            return
          }
          uni.showToast({ title: '未授权订阅消息', icon: 'none' })
          resolve(false)
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
