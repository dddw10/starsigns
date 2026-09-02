import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, getUserInfoApi, updateUserInfoApi, registerApi, loginAccountApi, getSystemConfigApi, updateBirthInfoApi } from '../api/user.js'
import { setUnauthorizedHandler, setSessionReadyPromise } from '../api/request.js'

export const useUserStore = defineStore('user', () => {
  // 用户信息
  const userInfo = ref(null)
  // 登录token
  const token = ref('')
  // 是否已登录
  const isLoggedIn = computed(() => !!token.value)
  // 审核模式开关
  const auditMode = ref(true)


  // 从本地存储初始化
  function initFromStorage() {
    try {
      const storedToken = uni.getStorageSync('user_token')
      const storedUserInfo = uni.getStorageSync('user_info')
      // #ifdef MP-WEIXIN
      // JWT 无法离线验证。避免页面先拿失效缓存发起受保护请求，
      // 小程序恢复时统一由 restoreWechatSession 换取新令牌。
      // 注意：删掉本地令牌之后不能再用「本地有没有令牌」当作要不要登录的依据，
      // 否则一次登录失败就再也不会重试，用户会永久停在未登录态（页面还在显示旧的 user_info），
      // 表现就是「数据没了、还进不去」。小程序换令牌只要 uni.login()，不需要用户操作，
      // 所以启动时一律重新换一次。
      if (storedToken) {
        uni.removeStorageSync('user_token')
      }
      // #endif
      // #ifndef MP-WEIXIN
      if (storedToken) {
        token.value = storedToken
      }
      // #endif
      if (storedUserInfo) {
        userInfo.value = JSON.parse(storedUserInfo)
      }
      return Boolean(storedToken)
    } catch (e) {
      console.error('读取本地存储失败:', e)
      return false
    }
  }

  function saveSession(session, authMode) {
    token.value = session.token
    userInfo.value = session.userInfo
    uni.setStorageSync('user_token', session.token)
    uni.setStorageSync('user_info', JSON.stringify(session.userInfo))
    uni.setStorageSync('auth_mode', authMode)
    backupBirthInfo(session.userInfo && session.userInfo.birthInfo)
  }

  function clearExpiredSession() {
    token.value = ''
    uni.removeStorageSync('user_token')
  }

  async function recoverExpiredSession() {
    const authMode = uni.getStorageSync('auth_mode')

    // 这里刻意不先清令牌：login() 可能复用一个已经写好新令牌的在途请求，
    // 先清就会把刚拿到的新令牌抹掉，然后带着空令牌去重试，又是一个 401。
    // 恢复失败时才清。
    // #ifdef MP-WEIXIN
    // 兼容旧版本未保存 auth_mode 的微信登录会话。
    const result = await login()
    if (result.success) return true
    clearExpiredSession()
    // #endif

    // #ifndef MP-WEIXIN
    if (authMode === 'wechat') {
      const result = await login()
      if (result.success) return true
    }
    clearExpiredSession()
    // #endif

    // 账号密码登录的会话过期后只能由用户重新输入，这里如实提示
    uni.showToast({
      title: authMode === 'account' ? '登录已过期，请在「我的」重新登录' : '登录已过期，请重新登录',
      icon: 'none'
    })
    return false
  }

  async function restoreWechatSession() {
    // #ifdef MP-WEIXIN
    // 让启动期的业务请求先等这次登录（request.js 里最多等 6 秒）
    const pending = login()
    setSessionReadyPromise(pending)
    return pending
    // #endif
    // #ifndef MP-WEIXIN
    return { success: false }
    // #endif
  }

  setUnauthorizedHandler(recoverExpiredSession)

  // 本机缓存里有生辰、但服务端这个账号没有时，把生辰补回去。
  // 用途：以前服务端凭证缺失时会按一次性 code 造用户，换成真实登录后账号是新的，
  // 用户会觉得「我的生日没了」。生辰是本机存过的、属于用户自己的数据，可以安全地补一次。
  // 只在服务端为空时补，绝不覆盖服务端已有的值。
  // 注意：这个函数会在 login() 内部被调用，此时会话闸门还没放开，
  // 所以请求必须带 skipSessionGate，否则自己等自己。
  async function restoreBirthInfoFromCache() {
    try {
      const serverBirth = userInfo.value && userInfo.value.birthInfo
      if (serverBirth && serverBirth.solarDate) return

      const cachedRaw = uni.getStorageSync('user_birth_backup')
      if (!cachedRaw) return
      const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw
      if (!cached || !cached.solarDate || !cached.birthTime) return

      const res = await updateBirthInfoApi({
        solarDate: cached.solarDate,
        birthTime: cached.birthTime
      }, { skipSessionGate: true })

      if (res.code === 0 && res.data) {
        userInfo.value = { ...userInfo.value, birthInfo: res.data }
        uni.setStorageSync('user_info', JSON.stringify(userInfo.value))
        console.log('已把本机备份的生辰补回当前账号')
      }
    } catch (e) {
      // 补不回来就算了，用户重新填一次即可，不能因此让登录流程失败
      console.warn('回填生辰失败:', e && e.message)
    }
  }

  // 生辰是用户最在意、也最容易「看起来丢了」的数据，单独留一份本机备份。
  // solarDate 是服务端折算好的公历，birthTime 是十二时辰名，直接回填即可
  function backupBirthInfo(info) {
    try {
      if (!info || !info.solarDate || !info.birthTime) return
      uni.setStorageSync('user_birth_backup', JSON.stringify({
        solarDate: info.solarDate,
        birthTime: info.birthTime
      }))
    } catch (e) {
      console.warn('备份生辰失败:', e && e.message)
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

        // #ifdef MP-WEIXIN
        // 获取微信登录code
        const loginResult = await uni.login({ provider: 'weixin' })
        code = loginResult.code
        // #endif

        // 调用后端登录接口
        const res = await loginApi({ code })

        if (res.code === 0) {
          saveSession(res.data, 'wechat')
          // 服务端这个账号没有生辰、而本机备份里有时补回去（详见 restoreBirthInfoFromCache）
          await restoreBirthInfoFromCache()

          return { success: true }
        } else {
          return { success: false, message: res.message }
        }
      } catch (e) {
        console.error('登录失败:', e)
        return { success: false, message: e && e.message ? e.message : '登录失败，请重试' }
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
    uni.removeStorageSync('auth_mode')
    // 主动退出等于「这台设备上的这份数据不再属于我」，备份的生辰也一并清掉，
    // 否则下一个人登录会被回填成上一个人的生辰
    uni.removeStorageSync('user_birth_backup')
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
  //
  // 这是一个「顺手同步一下」的动作：页面在测算成功、签到成功、绑定成功之后调它刷新灵气/道具，
  // 它从来不是用户点那一下真正要做的事。所以它必须自己吞掉异常、不往外抛 ——
  // 十几个调用点都写在业务的 try 里（bazi/tarot/name/fengshui/face/index/user），
  // 往外抛的话一次刷新失败就会走进 catch，把一次明明成功的测算显示成「排盘失败 / 抽取失败 /
  // 堪舆失败 / 推演失败」；bazi 的保存更糟：catch 只改了提示文案没改 ok，
  // 于是错误文字配着 success 的 ✓ 图标一起弹出来。
  // 真正的失败原因由 request.js 统一处理（401 会走换令牌重试，换不回来才提示重新登录）。
  async function fetchUserInfo() {
    try {
      const res = await getUserInfoApi()
      if (res.code === 0) {
        userInfo.value = res.data
        uni.setStorageSync('user_info', JSON.stringify(res.data))
        backupBirthInfo(res.data && res.data.birthInfo)
        return true
      }
      console.warn('获取用户信息失败:', res.message)
      return false
    } catch (e) {
      console.error('获取用户信息异常:', e)
      return false
    }
  }

  // 检查登录状态
  async function checkLoginStatus() {
    // fetchUserInfo 自己已经不抛异常了，这里不再需要 try/catch
    await fetchUserInfo()
  }

  // 更新主题
  function updateTheme(theme) {
    if (userInfo.value) {
      userInfo.value.theme = theme
      uni.setStorageSync('user_info', JSON.stringify(userInfo.value))
    }
  }

  // H5 账号登录
  async function loginAccount(username, password) {
    try {
      const res = await loginAccountApi({ username, password })
      if (res.code === 0) {
        saveSession(res.data, 'account')
        return { success: true }
      }
      return { success: false, message: res.message }
    } catch (e) {
      console.error('账号登录失败:', e)
      return { success: false, message: e.message || '登录失败' }
    }
  }

  // H5 账号注册
  async function registerAccount(username, password) {
    try {
      const res = await registerApi({ username, password })
      if (res.code === 0) {
        saveSession(res.data, 'account')
        return { success: true }
      }
      return { success: false, message: res.message }
    } catch (e) {
      console.error('账号注册失败:', e)
      return { success: false, message: e.message || '注册失败' }
    }
  }

  // 获取系统配置 (审核开关)
  async function fetchSystemConfig() {
    try {
      const res = await getSystemConfigApi()
      if (res.code === 0) {
        auditMode.value = !!res.data.auditMode
      }
    } catch (e) {
      console.error('获取系统配置失败:', e)
    }
  }

  return {
    userInfo,
    token,
    isLoggedIn,
    auditMode,
    initFromStorage,
    restoreWechatSession,
    login,
    logout,
    updateUserInfo,
    fetchUserInfo,
    checkLoginStatus,
    updateTheme,
    loginAccount,
    registerAccount,
    fetchSystemConfig
  }
}
)
