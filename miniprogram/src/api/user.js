import { get, post, put, del } from './request.js'

// 微信登录
export function loginApi(data) {
  return post('/api/user/login', data)
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

// 收藏算命结果
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

// 更新生辰八字
export function updateBirthInfoApi(data) {
  return put('/api/user/birth-info', data)
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

