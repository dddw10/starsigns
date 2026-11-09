const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const vue = require('vue')
const pinia = require('pinia')

function preprocess(source, platform) {
  const active = [true]
  return source.split('\n').filter(line => {
    const directive = line.match(/\/\/\s*#(ifdef|ifndef|endif)\s*([\w-]*)/)
    if (!directive) return active.at(-1)
    if (directive[1] === 'endif') active.pop()
    else active.push(active.at(-1) && (directive[1] === 'ifdef' ? directive[2] === platform : directive[2] !== platform))
    return false
  }).join('\n')
}

async function runtime({ platform = 'MP-WEIXIN', stored = {} } = {}) {
  const storage = new Map(Object.entries(stored))
  const requests = [], timers = new Map(), hooks = {}, notifications = []
  const pages = [{ route: 'pages/user/index' }]
  let now = 0, nextTimer = 0
  const uni = {
    getStorageSync: key => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    login: async () => ({ code: 'real-wechat-code' }),
    request: options => {
      const task = { aborted: false, abort() { this.aborted = true; options.fail?.({ errMsg: 'abort' }); options.complete?.() },
        onChunkReceived(callback) { this.chunk = callback } }
      options.task = task
      requests.push(options)
      return task
    },
    showToast: options => notifications.push(options),
    showModal: options => notifications.push(options),
    reLaunch: options => notifications.push(options),
    navigateBack: () => notifications.push({ navigateBack: true }),
    switchTab: options => notifications.push(options),
    showTabBar() {}, hideTabBar() {}, showLoading() {}, hideLoading() {},
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667 })
  }
  const DateProxy = class extends Date { static now() { return now } }
  const context = vm.createContext({ uni, wx: uni, console: { log() {}, warn() {}, error() {} }, process: { env: { NODE_ENV: 'test' } }, getCurrentPages: () => pages, Date: DateProxy,
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id }, clearTimeout: id => timers.delete(id) })
  const activePinia = pinia.createPinia()
  let evaluating = ''
  const capture = name => callback => ((hooks[evaluating] ||= {})[name] ||= []).push(callback)
  const modules = new Map()
  function synthetic(id, values) {
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value) }, { context, identifier: id })
  }
  modules.set('vue', synthetic('vue', { ...vue, onMounted: capture('onMounted'), onUnmounted: capture('onUnmounted') }))
  modules.set('pinia', synthetic('pinia', { defineStore: (id, setup) => { const use = pinia.defineStore(id, setup); return () => use(activePinia) } }))
  modules.set('@dcloudio/uni-app', synthetic('@dcloudio/uni-app', Object.fromEntries(['onLaunch', 'onShow', 'onHide', 'onLoad', 'onUnload', 'onPullDownRefresh'].map(name => [name, capture(name)]))))
  const root = path.resolve(__dirname, '../src')
  async function load(id, parent = root + '/entry.js', exports = []) {
    if (!['vue', 'pinia', '@dcloudio/uni-app'].includes(id)) {
      id = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(parent), id)
      if (!path.extname(id)) id += '.js'
    }
    if (modules.has(id)) return modules.get(id)
    if (id.endsWith('.vue') && id.includes(`${path.sep}components${path.sep}`)) {
      const module = synthetic(id, { default: {} }); modules.set(id, module); return module
    }
    let source = fs.readFileSync(id, 'utf8')
    if (id.endsWith('.vue')) source = source.match(/<script setup>([\s\S]*?)<\/script>/)[1]
    source = preprocess(source, platform)
    if (exports.length) source += `\nexport { ${exports.join(', ')} }`
    const module = new vm.SourceTextModule(source, { context, identifier: id })
    modules.set(id, module)
    await module.link((child, parentModule) => load(child, parentModule.identifier))
    return module
  }
  async function evaluate(id, exports = []) {
    const module = await load(id, root + '/entry.js', exports)
    evaluating = module.identifier
    await module.evaluate()
    return module.namespace
  }
  const request = await evaluate('./api/request.js')
  const user = await evaluate('./store/user.js')
  const store = user.useUserStore()
  async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); await vue.nextTick() }
  async function advance(ms) {
    now += ms
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn() }
    await flush()
  }
  function respond(requestItem, data, statusCode = 200) { requestItem.success({ data, statusCode }); requestItem.complete?.(); }
  return { store, request, evaluate, storage, requests, timers, hooks, pages, notifications, uni, flush, advance, respond, hook: (file, name) => hooks[path.join(root, file)]?.[name] || [] }
}
module.exports = { runtime }
