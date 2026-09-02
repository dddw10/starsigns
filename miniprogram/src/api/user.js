import { get, post, put, del } from './request.js'

// 微信登录
// skipSessionGate：登录请求不能等「登录完成」，否则自己等自己
export function loginApi(data) {
  return post('/api/user/login', data, { skipSessionGate: true })
}

// 获取用户信息
export function getUserInfoApi() {
  return get('/api/user/profile')
}

// 更新用户信息
export function updateUserInfoApi(data) {
  return put('/api/user/profile', data)
}

// 更新用户主题
export function updateUserThemeApi(theme) {
  return put('/api/user/theme', { theme })
}

// 获取用户历史记录
export function getUserHistoryApi(params) {
  return get('/api/user/history', params)
}

// 删除历史记录
export function deleteUserHistoryApi(id) {
  return del(`/api/user/history/${id}`)
}

// 收藏分析结果
export function favoriteResultApi(data) {
  return post('/api/user/favorite', data)
}

// 获取收藏列表
export function getFavoriteListApi(params) {
  return get('/api/user/favorites', params)
}

// 删除收藏
export function deleteFavoriteApi(id) {
  return del(`/api/user/favorite/${id}`)
}

// 更新生辰生日密码
export function updateBirthInfoApi(data, options = {}) {
  return put('/api/user/birth-info', data, options)
}

// 每日签到
export function checkInApi() {
  return post('/api/user/check-in')
}

// 提交意见反馈
export function submitFeedbackApi(data) {
  return post('/api/user/feedback', data)
}

// 获取用户自身的意见反馈列表
export function getUserFeedbackListApi(params) {
  return get('/api/user/feedback', params)
}

// 管理员：获取全部意见反馈列表
export function getAdminFeedbackListApi(params) {
  return get('/api/admin/feedback', params)
}

// 管理员：回复意见反馈
export function replyFeedbackApi(id, data) {
  return post(`/api/admin/feedback/${id}/reply`, data)
}

// 绑定微信手机号
export function bindPhoneApi(data) {
  return post('/api/user/bind-phone', data)
}

// H5 注册
export function registerApi(data) {
  return post('/api/user/register', data, { skipSessionGate: true })
}

// H5 账号登录
export function loginAccountApi(data) {
  return post('/api/user/login-account', data, { skipSessionGate: true })
}

// 获取系统配置
export function getSystemConfigApi() {
  return get('/api/config')
}

// 管理员：切换审核模式
export function toggleAuditModeApi(data) {
  return post('/api/admin/config/toggle', data)
}




