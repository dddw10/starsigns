// API基础地址，根据环境配置
// #ifdef H5
const BASE_URL = '' // H5 无论开发还是生产环境都使用相对路径，支持同源部署/直接IP访问
// #endif
// #ifndef H5
// 开发编译（uni -p mp-weixin）指向本地后端，生产构建（uni build）保持云端域名
const BASE_URL = process.env.NODE_ENV === 'development'
  ? 'http://127.0.0.1:3000'
  : 'https://starsigns.online'
// #endif

let unauthorizedHandler = null
let sessionRecoveryPromise = null
// 启动时的登录尚未完成时，先让业务请求等一下。
// 否则小程序冷启动会出现「页面先发请求 → 没带令牌 → 拿到游客数据」，
// 用户看到的是一份不属于自己的默认运势，看起来就像数据丢了
let sessionReadyPromise = null

function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

// 由 store 在启动登录开始时登记，登录结束（成功或失败）后自动放行
function setSessionReadyPromise(promise) {
  sessionReadyPromise = Promise.resolve(promise)
    .catch(() => null)
    .finally(() => {
      sessionReadyPromise = null
    })
}

async function waitForSession(options) {
  // 登录请求自己不能等自己，否则死锁
  if (!sessionReadyPromise || options.skipSessionGate) return
  try {
    // 最多只等 6 秒：登录卡住（弱网、后端不通）时业务请求要照常发出去，
    // 不能因为等登录把整个页面拖住——那就成了「页面卡死进不去」
    await Promise.race([
      sessionReadyPromise,
      new Promise((resolve) => setTimeout(resolve, 6000))
    ])
  } catch (e) {
    // 登录失败也要放行，让请求照常发出去、照常走 401 恢复
  }
}

async function recoverSession() {
  if (!unauthorizedHandler) return false

  if (!sessionRecoveryPromise) {
    sessionRecoveryPromise = Promise.resolve(unauthorizedHandler())
      .then(result => result === true)
      .catch(() => false)
      .finally(() => {
        sessionRecoveryPromise = null
      })
  }

  return sessionRecoveryPromise
}

// 请求封装
async function request(options, canRetryAfterRecovery = true, canRetryOn304 = true) {
  await waitForSession(options)

  return new Promise((resolve, reject) => {
    // 获取本地token
    const token = uni.getStorageSync('user_token') || ''

    // 统一请求头
    const header = {
      'Content-Type': 'application/json',
      ...options.header
    }

    // 添加token到请求头
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    uni.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      timeout: options.timeout || 30000,
      success: (res) => {
        // HTTP状态码检查
        if (res.statusCode === 200) {
          const data = res.data

          // 业务状态码检查
          if (data.code === 0) {
            resolve(data)
          } else if (data.code === 401) {
            handleUnauthorized(options, canRetryAfterRecovery, resolve, reject)
          } else {
            // 业务错误
            reject(new Error(data.message || '请求失败'))
          }
        } else if (res.statusCode === 401) {
          handleUnauthorized(options, canRetryAfterRecovery, resolve, reject)
        } else if (res.statusCode === 304) {
          // 304 的 body 是空的，直接走下面的分支会弹「服务器错误: 304」。
          // 服务端已经关掉 ETag，但中间可能还有代理/网关在协商缓存，
          // 这里带 no-cache 重打一次（只重试一次，避免打转）
          if (canRetryOn304) {
            const noCacheOptions = {
              ...options,
              header: {
                ...options.header,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            }
            request(noCacheOptions, canRetryAfterRecovery, false).then(resolve, reject)
          } else {
            reject(new Error('数据未更新，请稍后重试'))
          }
        } else {
          // 尝试解析非200状态下的服务器自定义JSON错误信息
          const errMsg = res.data && res.data.message ? res.data.message : `服务器错误: ${res.statusCode}`
          reject(new Error(errMsg))
        }
      },
      fail: (err) => {
        console.error('请求失败:', err)
        reject(new Error('网络请求失败，请检查网络连接'))
      }
    })
  })
}

// 处理未授权（token过期）
async function handleUnauthorized(options, canRetryAfterRecovery, resolve, reject) {
  const recovered = canRetryAfterRecovery && await recoverSession()
  if (recovered) {
    request(options, false).then(resolve, reject)
    return
  }

  reject(new Error('登录已过期，请重新登录'))
}

// GET请求
function get(url, data = {}, options = {}) {
  return request({ url, method: 'GET', data, ...options })
}

// POST请求
function post(url, data = {}, options = {}) {
  return request({ url, method: 'POST', data, ...options })
}

// PUT请求
function put(url, data = {}, options = {}) {
  return request({ url, method: 'PUT', data, ...options })
}

// DELETE请求
function del(url, data = {}, options = {}) {
  return request({ url, method: 'DELETE', data, ...options })
}

// recoverSession 也对外暴露：聊天页的 SSE 是手写的 wx.request，没走上面的统一封装，
// 但 401 恢复必须共用同一个单飞（sessionRecoveryPromise），否则会同时发起两次换令牌
export { request, get, post, put, del, BASE_URL, setUnauthorizedHandler, setSessionReadyPromise, recoverSession }
