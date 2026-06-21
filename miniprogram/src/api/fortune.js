import { get, post, del } from './request.js'

// 八字排盘计算
export function calcBaziApi(data) {
  return post('/api/fortune/bazi', data)
}

// 双人八字配对
export function baziMatchApi(data) {
  return post('/api/fortune/bazi-match', data)
}

// 获取八字详细解读
export function getBaziDetailApi(id) {
  return get(`/api/fortune/bazi/${id}`)
}

// 获取星座运势
export function getConstellationFortuneApi(constellation, params) {
  return get(`/api/fortune/constellation/${constellation}`, params)
}

// 获取所有星座列表
export function getConstellationListApi() {
  return get('/api/fortune/constellations')
}

// 塔罗牌占卜
export function doTarotDrawApi(data) {
  return post('/api/fortune/tarot', data)
}

// 获取塔罗牌含义解读
export function getTarotMeaningApi(cardId) {
  return get(`/api/fortune/tarot/${cardId}`)
}

// 获取塔罗牌列表
export function getTarotListApi() {
  return get('/api/fortune/tarot-list')
}

// 生肖运势查询
export function getZodiacFortuneApi(zodiac, params) {
  return get(`/api/fortune/zodiac/${zodiac}`, params)
}

// 姓名测算
export function nameAnalysisApi(data) {
  return post('/api/fortune/name', data)
}

// 姓名配对
export function nameMatchApi(data) {
  return post('/api/fortune/name-match', data)
}

// 风水分析
export function fengshuiAnalysisApi(data) {
  return post('/api/fortune/fengshui', data)
}

// 获取算命记录列表
export function getFortuneRecordsApi(params) {
  return get('/api/fortune/records', params)
}

// 获取算命记录详情
export function getFortuneRecordApi(id) {
  return get(`/api/fortune/record/${id}`)
}

// 删除算命记录
export function deleteFortuneRecordApi(id) {
  return del(`/api/fortune/record/${id}`)
}

// 每日运势
export function getDailyFortuneApi(params) {
  return get('/api/fortune/daily', params)
}

// 面相手相分析
export function facePalmAnalysisApi(data) {
  return post('/api/fortune/face-palm', data)
}

// 幸运抽签
export function luckyDrawApi() {
  return post('/api/fortune/lucky-draw')
}

// 获取推荐算命项目
export function getRecommendApi() {
  return get('/api/fortune/recommend')
}

// 分享算命结果
export function shareFortuneRecordApi(id) {
  return post(`/api/fortune/share/${id}`)
}
