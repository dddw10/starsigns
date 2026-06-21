import { get, post } from '../../../api/request'

export function getMemberInfo() {
  return get('/api/member/info')
}

export function checkFreeQuota() {
  return get('/api/member/quota')
}

export function getMemberBenefits() {
  return get('/api/member/benefits')
}

export function getMemberStats() {
  return get('/api/member/stats')
}

export function createOrder(data) {
  return post('/api/payment/create', data)
}

export function getOrderStatus(orderNo) {
  return get(`/api/payment/order/${orderNo}`)
}

export function getUserOrders(params) {
  return get('/api/payment/orders', params)
}

export function refundOrder(data) {
  return post('/api/payment/refund', data)
}
