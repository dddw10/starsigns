import { get, put, post } from './request.js'

// 获取推送设置
export function getPushSettingsApi() {
  return get('/api/push/settings')
}

// 更新推送设置
export function updatePushSettingsApi(data) {
  return put('/api/push/settings', data)
}

// 订阅推送
export function subscribePushApi(data) {
  return post('/api/push/subscribe', data)
}

// 取消订阅推送
export function unsubscribePushApi(data) {
  return post('/api/push/unsubscribe', data)
}

// 获取推送历史
export function getPushHistoryApi(params) {
  return get('/api/push/history', params)
}
