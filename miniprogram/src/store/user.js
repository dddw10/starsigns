import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, getUserInfoApi, updateUserInfoApi, registerApi, loginAccountApi, getSystemConfigApi, updateBirthInfoApi } from '../api/user.js'
import { setUnauthorizedHandler, setSessionReadyPromise, setSessionContext } from '../api/request.js'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref(null)
  const token = ref('')
  const sessionStatus = ref('logged_out')
  const sessionVersion = ref(0)
  const sessionError = ref('')
  const isLoggedIn = computed(() => sessionStatus.value === 'authenticated' && !!token.value)
  const auditMode = ref(true)
  const systemConfigStatus = ref('unknown')
  const systemConfigLoaded = computed(() => systemConfigStatus.value === 'loaded')
  let systemConfigPromise = null
  let loginPromise = null
  let restorePromise = null
  let accountPromise = null
  let profileMutationVersion = 0
  let loginAttempt = 0
  let retryAfter = 0
  let explicitlyLoggedOut = false

  setSessionContext(() => ({ status: sessionStatus.value, version: sessionVersion.value, token: token.value }))
  setUnauthorizedHandler(() => restoreSession({ force: true }).then(result => result.success))

  function initFromStorage() {
    try {
      explicitlyLoggedOut = uni.getStorageSync('user_logged_out') === true
      token.value = explicitlyLoggedOut ? '' : (uni.getStorageSync('user_token') || '')
      const cached = uni.getStorageSync('user_info')
      userInfo.value = !explicitlyLoggedOut && cached ? (typeof cached === 'string' ? JSON.parse(cached) : cached) : null
      sessionStatus.value = explicitlyLoggedOut ? 'logged_out' : 'restoring'
      // #ifdef H5
      if (!token.value && !userInfo.value && !uni.getStorageSync('auth_mode')) sessionStatus.value = 'logged_out'
      // #endif
      return Boolean(token.value)
    } catch (error) {
      token.value = ''
      sessionStatus.value = 'failed'
      sessionError.value = '读取登录资料失败，请重试'
      return false
    }
  }

  function saveSession(session, authMode, version) {
    if (version !== sessionVersion.value) return false
    if (!session || !session.token || !session.userInfo) throw new Error('登录响应无效，请重试')
    uni.setStorageSync('user_token', session.token)
    uni.setStorageSync('user_info', JSON.stringify(session.userInfo))
    uni.setStorageSync('auth_mode', authMode)
    uni.removeStorageSync('user_logged_out')
    explicitlyLoggedOut = false
    token.value = session.token
    userInfo.value = session.userInfo
    profileMutationVersion++
    sessionError.value = ''
    sessionStatus.value = 'authenticated'
    retryAfter = 0
    backupBirthInfo(session.userInfo.birthInfo)
    return true
  }

  function failSession(message, version) {
    if (version !== sessionVersion.value) return
    token.value = ''
    uni.removeStorageSync('user_token')
    sessionStatus.value = 'failed'
    sessionError.value = message || '登录恢复失败，请重试'
  }

  function withTimeout(promise, ms = 10000) {
    let timer
    return Promise.race([promise, new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('登录恢复超时，请重试')), ms)
    })]).finally(() => clearTimeout(timer))
  }

  function login() {
    if (restorePromise) return restorePromise
    if (accountPromise) return accountPromise
    // H5 保护操作应恢复原账号，不能以模拟登录替换尚未验证的身份。
    // #ifdef H5
    if (token.value || uni.getStorageSync('auth_mode') === 'account') return restoreSession({ retry: true })
    // #endif
    return exchangeLogin()
  }

  function exchangeLogin() {
    if (loginPromise) return loginPromise
    explicitlyLoggedOut = false
    uni.removeStorageSync('user_logged_out')
    const version = sessionVersion.value
    const attempt = ++loginAttempt
    sessionStatus.value = 'restoring'
    const pending = (async () => {
      try {
        const res = await withTimeout((async () => {
          let code
          // #ifdef H5
          code = uni.getStorageSync('h5_user_uuid')
          if (!code) {
            code = 'h5-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
            uni.setStorageSync('h5_user_uuid', code)
          }
          // #endif
          // #ifdef MP-WEIXIN
          code = (await uni.login({ provider: 'weixin' })).code
          // #endif
          if (version !== sessionVersion.value || attempt !== loginAttempt) throw new Error('登录操作已失效')
          return loginApi({ code })
        })())
        if (version !== sessionVersion.value || attempt !== loginAttempt) return { success: false, message: '账号已切换' }
        if (res.code !== 0 || !saveSession(res.data, 'wechat', version)) throw new Error(res.message || '登录失败')
        restoreBirthInfoFromCache(version)
        return { success: true }
      } catch (error) {
        if (attempt === loginAttempt) { ++loginAttempt; failSession(error.message, version) }
        return { success: false, message: error.message || '登录失败，请重试' }
      } finally { if (loginPromise === pending) loginPromise = null }
    })()
    loginPromise = pending
    setSessionReadyPromise(pending)
    return pending
  }

  function restoreSession({ force = false, retry = false } = {}) {
    if (restorePromise) return restorePromise
    if (accountPromise) return accountPromise
    if (loginPromise) return loginPromise
    if (explicitlyLoggedOut) return Promise.resolve({ success: false, message: '请先登录' })
    if (isLoggedIn.value && !force) return Promise.resolve({ success: true })
    // #ifdef H5
    if (!token.value && !userInfo.value && !uni.getStorageSync('auth_mode')) {
      sessionStatus.value = 'logged_out'
      sessionError.value = ''
      return Promise.resolve({ success: false, message: '请先登录' })
    }
    // #endif
    if (!retry && Date.now() < retryAfter) return Promise.resolve({ success: false, message: sessionError.value })
    const version = sessionVersion.value
    const cachedToken = token.value
    sessionStatus.value = 'restoring'
    // 延后执行保证任何同步返回分支的 finally 都能引用已赋值 pending。
    const pending = Promise.resolve().then(async () => {
      try {
        // #ifdef H5
        const authMode = uni.getStorageSync('auth_mode')
        if (cachedToken && !force) {
          try {
            const res = await withTimeout(getUserInfoApi({ skipSessionGate: true, skipAutoRecovery: true, allowUnverifiedToken: true, timeout: 10000 }))
            if (saveSession({ token: cachedToken, userInfo: res.data }, authMode || 'account', version)) return { success: true }
          } catch (error) {
            if (authMode !== 'wechat') {
              failSession(error.message, version)
              if (error.code !== 'AUTH_EXPIRED' && version === sessionVersion.value) {
                token.value = cachedToken
                uni.setStorageSync('user_token', cachedToken)
              }
              return { success: false, message: error.message }
            }
          }
        }
        if (authMode !== 'wechat') {
          failSession('请在「我的」登录后重试', version)
          return { success: false, message: '请在「我的」登录后重试' }
        }
        // #endif
        let result = { success: false }
        for (let attempt = 0; attempt < 2 && version === sessionVersion.value; attempt++) {
          result = await exchangeLogin()
          if (result.success) return result
        }
        return result
      } finally {
        if (version === sessionVersion.value && !isLoggedIn.value) retryAfter = Date.now() + 30000
        if (restorePromise === pending) restorePromise = null
      }
    })
    restorePromise = pending
    setSessionReadyPromise(pending)
    return pending
  }

  function invalidateSession() {
    sessionVersion.value++
    loginAttempt++
    loginPromise = null
    restorePromise = null
    accountPromise = null
    retryAfter = 0
    token.value = ''
    userInfo.value = null
    profileMutationVersion++
    uni.removeStorageSync('user_token')
    uni.removeStorageSync('user_info')
    uni.removeStorageSync('auth_mode')
    uni.removeStorageSync('user_birth_backup')
  }

  function logout() {
    invalidateSession()
    explicitlyLoggedOut = true
    uni.setStorageSync('user_logged_out', true)
    sessionStatus.value = 'logged_out'
    sessionError.value = ''
    uni.reLaunch({ url: '/pages/index/index' })
  }

  async function authenticateAccount(api, username, password) {
    invalidateSession()
    explicitlyLoggedOut = false
    uni.removeStorageSync('user_logged_out')
    const version = sessionVersion.value
    sessionStatus.value = 'restoring'
    const pending = (async () => {
      try {
        const res = await withTimeout(api({ username, password }))
        return { success: saveSession(res.data, 'account', version) }
      } catch (error) { failSession(error.message, version); return { success: false, message: error.message } }
      finally { if (accountPromise === pending) accountPromise = null }
    })()
    accountPromise = pending
    setSessionReadyPromise(pending)
    return pending
  }
  function loginAccount(username, password) { return authenticateAccount(loginAccountApi, username, password) }
  function registerAccount(username, password) { return authenticateAccount(registerApi, username, password) }

  async function restoreBirthInfoFromCache(version) {
    try {
      if (userInfo.value?.birthInfo?.solarDate) return
      const raw = uni.getStorageSync('user_birth_backup')
      const cached = typeof raw === 'string' && raw ? JSON.parse(raw) : raw
      if (!cached?.solarDate || !cached.birthTime) return
      const res = await updateBirthInfoApi({ solarDate: cached.solarDate, birthTime: cached.birthTime }, { skipSessionGate: true, skipAutoRecovery: true, timeout: 10000 })
      if (version !== sessionVersion.value || !isLoggedIn.value) return
      if (res.code === 0 && res.data) {
        userInfo.value = { ...userInfo.value, birthInfo: res.data }
        profileMutationVersion++
        uni.setStorageSync('user_info', JSON.stringify(userInfo.value))
      }
    } catch (error) { console.warn('回填生辰失败:', error.message) }
  }

  function backupBirthInfo(info) {
    if (info?.solarDate && info.birthTime) {
      try { uni.setStorageSync('user_birth_backup', JSON.stringify({ solarDate: info.solarDate, birthTime: info.birthTime })) }
      catch (error) { console.warn('备份生辰失败:', error.message) }
    }
  }

  async function updateUserInfo(data) {
    const version = sessionVersion.value
    try {
      const res = await updateUserInfoApi(data)
      if (version !== sessionVersion.value || !isLoggedIn.value) return { success: false, message: '账号已切换' }
      userInfo.value = { ...userInfo.value, ...data }
      profileMutationVersion++
      uni.setStorageSync('user_info', JSON.stringify(userInfo.value))
      return { success: res.code === 0 }
    } catch (error) { return { success: false, message: error.message || '更新失败' } }
  }

  async function fetchUserInfo() {
    const version = sessionVersion.value
    const revision = profileMutationVersion
    try {
      const res = await getUserInfoApi()
      if (version !== sessionVersion.value || !isLoggedIn.value) return false
      // 回填或资料修改已经落地时，忽略修改前发起的读取快照。
      if (revision !== profileMutationVersion) return true
      userInfo.value = res.data
      uni.setStorageSync('user_info', JSON.stringify(res.data))
      backupBirthInfo(res.data?.birthInfo)
      return true
    } catch (error) { console.warn('获取用户信息失败:', error.message); return false }
  }

  function updateTheme(theme) {
    if (userInfo.value) { userInfo.value.theme = theme; uni.setStorageSync('user_info', JSON.stringify(userInfo.value)) }
  }

  async function fetchSystemConfig() {
    try {
      const res = await getSystemConfigApi()
      if (typeof res.data?.auditMode !== 'boolean') throw new Error('功能配置无效')
      auditMode.value = res.data.auditMode
      systemConfigStatus.value = 'loaded'
      return true
    } catch (error) {
      auditMode.value = true
      systemConfigStatus.value = 'failed'
      console.warn('获取系统配置失败:', error.message)
      return false
    }
  }
  function ensureSystemConfig() {
    if (systemConfigLoaded.value) return Promise.resolve(true)
    if (!systemConfigPromise) systemConfigPromise = fetchSystemConfig().finally(() => { systemConfigPromise = null })
    return systemConfigPromise
  }

  return {
    userInfo, token, isLoggedIn, sessionStatus, sessionVersion, sessionError,
    auditMode, systemConfigLoaded, systemConfigStatus, initFromStorage,
    restoreSession, restoreWechatSession: restoreSession, login, logout,
    updateUserInfo, fetchUserInfo, checkLoginStatus: fetchUserInfo, updateTheme,
    loginAccount, registerAccount, fetchSystemConfig, ensureSystemConfig
  }
})
