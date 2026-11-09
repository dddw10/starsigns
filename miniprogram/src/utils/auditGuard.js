import { useUserStore } from '../store/user.js'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'

function currentPage() {
  const pages = getCurrentPages()
  return pages[pages.length - 1]
}

// 简洁模式（auditMode）下被关掉的那几个页面，各自在 onLoad 里调一次这个守卫。
//
// 为什么每个页面都要挡：首页宫格的过滤（activeServices）只是把图标藏起来，
// 页面本身仍在 pages.json 里、仍打进包，路径可以直接打开——真机调试的「打开页面」、
// 带 path 的小程序码、历史记录里的跳转都绕得过图标。
// 真正把能力关掉的是服务端的 auditGuard（接口 403），这一层的作用是让用户
// 看到一句人话而不是一个报错的空页面。
//
// 必须先 await ensureSystemConfig()：store 里 auditMode 的初值是「按开着处理」，
// 不等配置回来就判会把简洁模式关着时的正常用户也弹出去。
export async function blockedByAuditMode(lifecycle = { active: true, timer: null }) {
  const owner = currentPage()
  const version = lifecycle.version
  const userStore = useUserStore()
  await userStore.ensureSystemConfig()
  if (!lifecycle.active || lifecycle.version !== version || currentPage() !== owner) return true
  if (!userStore.auditMode) return false

  uni.showToast({
    title: userStore.systemConfigStatus === 'loaded' ? '该功能当前未开放' : '功能配置加载失败，请点击重试',
    icon: 'none',
    duration: 2000,
  })
  // 留一点时间让 toast 被看见再退。tabBar 页面不能 navigateBack，
  // 直开进来时页面栈只有自己一层，只能 switchTab 回首页。
  if (userStore.systemConfigStatus !== 'loaded') return true
  clearTimeout(lifecycle.timer)
  lifecycle.timer = setTimeout(() => {
    if (!lifecycle.active || lifecycle.version !== version || currentPage() !== owner) return
    if (getCurrentPages().length > 1) {
      uni.navigateBack()
    } else {
      uni.switchTab({ url: '/pages/index/index' })
    }
  }, 1500)
  return true
}

// 在页面 setup 注册生命周期，不能在 await 后注册 uni-app 钩子。
export function useAuditGuard() {
  const lifecycle = { active: true, timer: null, version: 0 }
  const cancel = () => { lifecycle.active = false; lifecycle.version++; clearTimeout(lifecycle.timer); lifecycle.timer = null }
  onShow(() => { lifecycle.active = true })
  onHide(cancel)
  onUnload(cancel)
  return () => blockedByAuditMode(lifecycle)
}
