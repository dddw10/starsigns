import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getPushSettingsApi, subscribePushApi, unsubscribePushApi } from '../api/push.js'
import { getSystemConfigApi } from '../api/user.js'

// 模板 ID 不再写死在前端。
// 以前这里硬编码一个模板 ID，服务端只认 .env 里的另一个，两边对不上；
// 而 togglePush 又是「先弹微信授权、后调服务端」，用户那一次宝贵的授权被白烧掉，
// 订阅记录一条都没落库。现在统一从 GET /api/config 取，服务端是唯一来源。
const STORAGE_KEY = 'push_settings'

export const usePushStore = defineStore('push', () => {
  // 「还能不能收到」——权威值来自服务端的订阅记录，不是本地那个永远为 true 的布尔值
  const pushEnabled = ref(false)
  // 剩余授权次数：微信一次性订阅消息「授权一次发一条」，可以多次授权累积
  const remainingQuota = ref(0)
  const maxQuota = ref(7)
  const expireAt = ref('')
  const lastPushDate = ref('')
  // 「用户想要吗」——他曾经打开过开关。和 pushEnabled 是两件事：
  // 授权用完或过期后 pushEnabled 会变回 false，但 intended 还是 true。
  // 分开才能说出实话：对前者说「已暂停，再授权一次」，对后者说「未开启」
  const intended = ref(false)
  // 推送时间的文案也由服务端下发，避免两端各写一份对不上
  const pushTimeLabel = ref('08:30')
  // 服务端是否已配齐模板（没配齐时开关置灰，且**不要**弹微信授权窗）
  const configured = ref(false)
  const templateId = ref('')
  const configLoaded = ref(false)

  // 三态：加载中 / 加载失败（可重试）/ 真的是关着的。
  // 沿用历史记录页那条结论：加载失败 ≠ 没有数据，不能把一次超时画成「未开启」
  const loading = ref(false)
  const loadError = ref('')

  const quotaText = computed(() => (remainingQuota.value > 0 ? `剩 ${remainingQuota.value} 次` : '已用完'))

  // 本地快照只用于首屏先画点东西，不作为权威状态
  function initFromStorage() {
    try {
      const stored = uni.getStorageSync(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        pushEnabled.value = Boolean(data.pushEnabled)
        remainingQuota.value = Number(data.remainingQuota) || 0
        pushTimeLabel.value = data.pushTimeLabel || pushTimeLabel.value
      }
    } catch (e) {
      console.error('读取推送设置失败:', e)
    }
  }

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, JSON.stringify({
        pushEnabled: pushEnabled.value,
        remainingQuota: remainingQuota.value,
        pushTimeLabel: pushTimeLabel.value
      }))
    } catch (e) {
      console.error('保存推送设置失败:', e)
    }
  }

  function applySettings(data) {
    if (!data) return
    pushEnabled.value = Boolean(data.pushEnabled)
    remainingQuota.value = Number(data.remainingQuota) || 0
    if (data.maxQuota) maxQuota.value = Number(data.maxQuota)
    expireAt.value = data.expireAt || ''
    lastPushDate.value = data.lastPushDate || ''
    if (typeof data.intended === 'boolean') intended.value = data.intended
    if (data.pushTimeLabel) pushTimeLabel.value = data.pushTimeLabel
    if (typeof data.configured === 'boolean') configured.value = data.configured
    persist()
  }

  // 模板 ID 必须在用户点开关**之前**就拿到：
  // wx.requestSubscribeMessage 要求由用户点击触发，中间夹一次网络请求容易被判失败
  async function ensureConfig(force = false) {
    if (configLoaded.value && !force) return configured.value
    try {
      const res = await getSystemConfigApi()
      const push = (res && res.data && res.data.push) || {}
      templateId.value = push.templateId || ''
      configured.value = Boolean(push.enabled)
      if (push.pushTimeLabel) pushTimeLabel.value = push.pushTimeLabel
      if (push.maxQuota) maxQuota.value = Number(push.maxQuota)
      configLoaded.value = true
    } catch (e) {
      console.error('读取推送配置失败:', e)
    }
    return configured.value
  }

  // 拉取权威状态。失败时保留现有值并记下原因，不要把失败画成「已关闭」
  async function refresh() {
    loading.value = true
    loadError.value = ''
    try {
      await ensureConfig()
      const res = await getPushSettingsApi()
      applySettings(res && res.data)
      return true
    } catch (e) {
      loadError.value = e?.message || '推送状态没能加载出来'
      return false
    } finally {
      loading.value = false
    }
  }

  // 开关推送。返回 { ok, reason }，由页面决定怎么提示、怎么回弹 switch
  async function togglePush(enabled) {
    if (enabled) {
      // 没配齐就别弹授权窗：那一次授权会被白烧掉
      const ready = await ensureConfig()
      if (!ready) {
        return { ok: false, reason: '服务端还没配好订阅消息模板，暂时无法开启' }
      }

      const granted = await requestSubscribeMessage()
      if (!granted.ok) return granted

      try {
        const res = await subscribePushApi({ templateId: templateId.value })
        applySettings(res && res.data)
        // 服务端确认后才算开启
        return { ok: true, reason: `已订阅，${pushTimeLabel.value} 推送（${quotaText.value}）` }
      } catch (e) {
        return { ok: false, reason: e?.message || '订阅失败，请稍后重试' }
      }
    }

    try {
      await unsubscribePushApi({ templateId: templateId.value })
      pushEnabled.value = false
      remainingQuota.value = 0
      intended.value = false
      persist()
      return { ok: true, reason: '已关闭提醒' }
    } catch (e) {
      return { ok: false, reason: e?.message || '关闭失败，请稍后重试' }
    }
  }

  // 请求订阅消息授权。同意一次 = 服务端可以发一条
  function requestSubscribeMessage() {
    // #ifndef MP-WEIXIN
    return Promise.resolve({ ok: false, reason: '微信服务通知仅在微信小程序内可用' })
    // #endif
    // #ifdef MP-WEIXIN
    if (!templateId.value) {
      return Promise.resolve({ ok: false, reason: '订阅消息模板未配置' })
    }

    return new Promise((resolve) => {
      uni.requestSubscribeMessage({
        tmplIds: [templateId.value],
        success: (res) => {
          const status = res[templateId.value]
          if (status === 'accept') {
            resolve({ ok: true })
          } else if (status === 'reject') {
            resolve({ ok: false, reason: '你拒绝了订阅，可在微信「设置-订阅消息」里改回来' })
          } else {
            resolve({ ok: false, reason: '未完成授权' })
          }
        },
        fail: (err) => {
          console.error('订阅消息授权失败:', err)
          resolve({ ok: false, reason: '授权失败，请稍后重试' })
        }
      })
    })
    // #endif
  }

  return {
    pushEnabled,
    remainingQuota,
    maxQuota,
    expireAt,
    lastPushDate,
    intended,
    pushTimeLabel,
    configured,
    templateId,
    loading,
    loadError,
    quotaText,
    initFromStorage,
    ensureConfig,
    refresh,
    togglePush
  }
})
