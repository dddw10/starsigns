// API基础地址，根据环境配置
// #ifdef H5
const BASE_URL = '' // H5 无论开发还是生产环境都使用相对路径，支持同源部署/直接IP访问
// #endif
// #ifndef H5
const BASE_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:3000'
  : 'http://106.53.153.185:3000' // 小程序生产包默认指向您的云服务器（正式上线前可换为正式 HTTPS 域名）
// #endif

// 请求封装
function request(options) {
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
            // token过期或无效
            handleUnauthorized()
            reject(new Error('登录已过期，请重新登录'))
          } else {
            // 业务错误
            reject(new Error(data.message || '请求失败'))
          }
        } else if (res.statusCode === 401) {
          handleUnauthorized()
          reject(new Error('登录已过期，请重新登录'))
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
function handleUnauthorized() {
  uni.removeStorageSync('user_token')
  uni.removeStorageSync('user_info')
  uni.showToast({
    title: '登录已过期，请重新登录',
    icon: 'none',
    duration: 2000
  })
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/index/index' })
  }, 2000)
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

export { request, get, post, put, del, BASE_URL }
