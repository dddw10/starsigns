const { test } = require('node:test')
const assert = require('node:assert/strict')
const { runtime } = require('./runtime.cjs')
const fs = require('node:fs')
const path = require('node:path')
const vue = require('vue')
const { parse } = require('@vue/compiler-sfc')
const loginResponse = { code: 0, data: { token: 'fresh', userInfo: { _id: 'user', birthInfo: { solarDate: '1990-01-01', birthTime: '子时' } } } }

test('dark theme and config initialize before pending login; foreground retries offline cold start', async () => {
  const r = await runtime({ stored: { app_theme: 'dark', user_token: 'old', user_info: '{"nickname":"cached"}' } })
  const app = await r.evaluate('./App.vue', ['themeStore'])
  for (const hook of r.hook('App.vue', 'onLaunch')) hook()
  await r.flush()
  assert.equal(app.themeStore.currentTheme, 'dark')
  assert.ok(r.requests.some(item => item.url.endsWith('/config')))
  for (let i = 0; i < 2; i++) {
    const login = r.requests.filter(item => item.url.endsWith('/login'))[i]
    login.fail({ errMsg: 'offline' }); await r.flush()
  }
  assert.equal(r.store.sessionStatus, 'failed')
  await r.advance(30001)
  for (const hook of r.hook('App.vue', 'onShow')) hook()
  await r.flush()
  assert.equal(r.requests.filter(item => item.url.endsWith('/login')).length, 3)
  r.respond(r.requests.filter(item => item.url.endsWith('/login'))[2], loginResponse)
  await r.flush()
  assert.equal(r.store.isLoggedIn, true)
})

test('user page opened during restoration loads personal data after login', async () => {
  const r = await runtime()
  r.store.initFromStorage()
  await r.evaluate('./pages/user/index.vue')
  for (const hook of r.hook('pages/user/index.vue', 'onShow')) hook()
  const pending = r.store.restoreSession()
  await r.flush()
  r.respond(r.requests.find(item => item.url.endsWith('/login')), loginResponse)
  await pending; await r.flush()
  assert.ok(r.requests.some(item => item.url.endsWith('/records')))
  assert.ok(r.requests.some(item => item.url.endsWith('/pet/status')))
})

test('home personalized data failing to restore has visible retry state', async () => {
  const r = await runtime()
  r.store.initFromStorage()
  const home = await r.evaluate('./pages/index/index.vue', ['loadDailyFortune', 'todayFortune'])
  await home.loadDailyFortune()
  assert.equal(home.todayFortune.value, null)
})

test('chat login failure preserves the question and sends no guest AI request', async () => {
  const r = await runtime()
  const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg'])
  chat.inputMsg.value = '我的问题'
  const pending = chat.sendMessage()
  await r.flush()
  r.requests.find(item => item.url.endsWith('/login')).fail({ errMsg: 'offline' })
  await r.flush()
  // 自动恢复可能有限重试一次。
  const second = r.requests.filter(item => item.url.endsWith('/login'))[1]
  if (second) second.fail({ errMsg: 'offline' })
  await pending
  assert.equal(chat.inputMsg.value, '我的问题')
  assert.equal(r.requests.some(item => item.url.endsWith('/ai-chat')), false)
})

test('failed config blocks with retry explanation and cannot navigate a different page', async () => {
  const r = await runtime({ stored: { audit_mode: false } })
  const guard = await r.evaluate('./utils/auditGuard.js')
  const pending = guard.blockedByAuditMode()
  await r.flush()
  r.requests[0].fail({ errMsg: 'offline' })
  await pending
  assert.equal(r.store.systemConfigStatus, 'failed')
  assert.match(r.notifications[0].title, /重试/)
  r.pages.splice(0, 1, { route: 'pages/index/index' })
  await r.advance(1600)
  assert.equal(r.notifications.length, 1)
})

test('chat audit redirect timer is cancelled on hide even if page later becomes visible', async () => {
  const r = await runtime()
  await r.evaluate('./pages/chat/index.vue')
  const mounted = r.hook('pages/chat/index.vue', 'onMounted')[0]()
  await r.flush(); r.respond(r.requests[0], { code: 0, data: { auditMode: true } }); await mounted
  for (const hook of r.hook('pages/chat/index.vue', 'onHide')) hook()
  for (const hook of r.hook('pages/chat/index.vue', 'onShow')) hook()
  await r.advance(1600)
  assert.equal(r.notifications.length, 1)
})

test('known audit mode never redirects a newly opened page', async () => {
  const r = await runtime()
  const guard = await r.evaluate('./utils/auditGuard.js')
  const pending = guard.blockedByAuditMode()
  await r.flush(); r.respond(r.requests[0], { code: 0, data: { auditMode: true } }); await pending
  r.pages.push({ route: 'pages/other/index' })
  await r.advance(1600)
  assert.equal(r.notifications.length, 1)
})

test('chat syncs restored birth info after mounted before login', async () => {
  const r = await runtime()
  const chat = await r.evaluate('./pages/chat/index.vue', ['birthInfo'])
  const login = r.store.login(); await r.flush(); r.respond(r.requests[0], loginResponse); await login; await r.flush()
  assert.equal(chat.birthInfo.solarDate, '1990-01-01')
  assert.equal(chat.birthInfo.birthTime, '0')
})

test('unknown configuration renders only retry content on restricted pages', () => {
  for (const page of ['bazi', 'tarot', 'name', 'face', 'chat']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/pages', page, 'index.vue'), 'utf8')
    const template = parse(source).descriptor.template.content
    const render = vue.compile(template, { isCustomElement: tag => tag !== 'template' })
    const vnode = render({ userStore: { systemConfigLoaded: false }, blockedByAuditMode() {} }, [])
    const children = Array.isArray(vnode.children) ? vnode.children : [vnode]
    assert.ok(children.some(child => typeof child?.children === 'string' && child.children.includes('点击重试')))
  }
})

test('pending audit config cannot schedule a redirect after hide and re-show', async () => {
  const r = await runtime()
  await r.evaluate('./pages/chat/index.vue')
  const pending = r.hook('pages/chat/index.vue', 'onMounted')[0]()
  await r.flush()
  for (const hook of r.hook('pages/chat/index.vue', 'onHide')) hook()
  for (const hook of r.hook('pages/chat/index.vue', 'onShow')) hook()
  r.respond(r.requests[0], { code: 0, data: { auditMode: true } }); await pending
  await r.advance(1600)
  assert.equal(r.notifications.length, 0)
})

test('retrying failed audit configuration also initializes chat content', async () => {
  const r = await runtime()
  const chat = await r.evaluate('./pages/chat/index.vue', ['messages', 'blockedByAuditMode'])
  const pending = r.hook('pages/chat/index.vue', 'onMounted')[0]()
  await r.flush(); r.requests[0].fail({ errMsg: 'offline' }); await pending
  const retry = chat.blockedByAuditMode()
  await r.flush(); r.respond(r.requests[1], { code: 0, data: { auditMode: false } }); await retry
  assert.ok(chat.messages.value.length > 0)
})

test('resolved pet data cannot repaint the page after logout before its continuation', async () => {
  const r = await runtime()
  const login = r.store.login(); await r.flush(); r.respond(r.requests[0], loginResponse); await login
  const page = await r.evaluate('./pages/user/index.vue', ['loadPetStatus', 'petData'])
  const pending = page.loadPetStatus(); await r.flush()
  r.respond(r.requests[1], { code: 0, data: { nickname: 'old pet' } })
  r.store.logout(); await pending; await r.flush()
  assert.equal(page.petData.value, null)
})
