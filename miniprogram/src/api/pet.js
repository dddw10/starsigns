import { get, post } from './request.js'

// 获取神兽状态与数据
export function getPetStatusApi() {
  return get('/api/pet/status')
}

// 投喂神兽饲料
export function feedPetApi(itemType) {
  return post('/api/pet/feed', { itemType })
}

// 与神兽互动抚摸 (摸摸头)
export function interactPetApi() {
  return post('/api/pet/interact')
}

// 自定义神兽改名
export function renamePetApi(name) {
  return post('/api/pet/rename', { name })
}

// 开启神兽福袋抽奖
export function drawPetRewardApi() {
  return post('/api/pet/draw')
}
