const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vue = require('vue')
const { parse, compileScript } = require('@vue/compiler-sfc')
const { runtime } = require('./runtime.cjs')
const birthInfo = { solarDate: '1984-02-02', lunarDate: '1984-1-1', birthTime: '未知' }
const profile = { _id: 'user', gender: 1, birthInfo }
const response = info => ({ code: 0, data: { token: 'token', userInfo: info } })
async function login(r, info = { _id: 'user' }) {
  const pending = r.store.login(); await r.flush()
  r.respond(r.requests.find(item => /login$/.test(item.url)), response(info))
  await pending; await r.flush()
}
const source = fs.readFileSync(path.join(__dirname, '../src/pages/index/index.vue'), 'utf8')
const descriptor = parse(source).descriptor
const bindings = Object.keys(compileScript(descriptor, { id: 'unknown-birth-home' }).bindings)
const render = vue.compile(descriptor.template.content, { isCustomElement: tag => tag !== 'template' })
function renderedText(home) {
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.children ? text(node.children) : ''
  return text(render(vue.proxyRefs({ themeClass: '', ...home }), []))
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(`${platform}: home saves unknown, shows no full chart, and restores its exact state from profile/cache`, async () => {
    const r = await runtime({ platform })
    await login(r)
    const home = await r.evaluate('./pages/index/index.vue', bindings)
    home.openBirthDrawer()
    home.onTempDateChange({ detail: { value: '1984-02-02' } })
    home.onTempTimeChange({ detail: { value: 0 } })
    assert.match(renderedText(home), /保存生日/)
    const saving = home.saveBirthInfo(); await r.flush()
    const write = r.requests.find(item => /birth-info$/.test(item.url))
    assert.equal(write.data.birthTime, '未知')
    r.respond(write, { code: 0, data: birthInfo }); await r.flush()
    r.respond(r.requests.find(item => /profile$/.test(item.url)), { code: 0, data: profile }); await r.flush()
    r.respond(r.requests.find(item => /daily$/.test(item.url)), { code: 0, data: { score: 70, level: 'normal', yi: [], ji: [] } })
    await saving; await r.flush()
    assert.equal(r.store.userInfo.birthInfo.birthTime, '未知')
    assert.deepEqual(JSON.parse(r.storage.get('user_birth_backup')), { solarDate: '1984-02-02', birthTime: '未知' })
    assert.ok(r.notifications.some(item => /生日已保存/.test(item.title)))
    assert.equal(r.notifications.some(item => /专属灵感生成成功/.test(item.title)), false)
    const text = renderedText(home)
    assert.match(text, /时辰未知，未生成完整排盘/)
    assert.match(text, /每日参考/)
    assert.doesNotMatch(text, /专属灵感 \(/)
    home.openBirthDrawer()
    assert.equal(home.tempSelectedTime.value.value, '未知')

    // A fresh VM recompiles the page and restores the authenticated profile after a reload.
    const restored = await runtime({ platform, stored: Object.fromEntries(r.storage) })
    restored.store.initFromStorage()
    const restoring = restored.store.restoreSession(); await restored.flush()
    const exchange = restored.requests.find(item => /profile$|login$/.test(item.url))
    restored.respond(exchange, /login$/.test(exchange.url) ? response(profile) : { code: 0, data: profile })
    await restoring; await restored.flush()
    const restoredHome = await restored.evaluate('./pages/index/index.vue', bindings)
    restoredHome.openBirthDrawer()
    assert.equal(restoredHome.tempSelectedTime.value.value, '未知')
    assert.match(renderedText(restoredHome), /时辰未知，未生成完整排盘/)
    const chat = await restored.evaluate('./pages/chat/index.vue', ['birthInfo', 'sendMessage', 'inputMsg', 'onHourChange'])
    assert.equal(chat.birthInfo.birthTime, '未知')
    chat.inputMsg.value = '请给我一些建议'
    await chat.sendMessage(); await restored.flush()
    const first = restored.requests.find(item => /ai-chat$/.test(item.url))
    assert.equal(first.data.birthInfo.birthTime, '未知')
    restored.respond(first, platform === 'H5' ? { code: 0, data: { content: '请补充时辰' } }
      : new TextEncoder().encode('data: {"content":"请补充时辰"}\n\ndata: [DONE]\n\n').buffer)
    await restored.flush()
    chat.onHourChange({ detail: { value: 6 } })
    chat.inputMsg.value = '现在已补充时辰'
    await chat.sendMessage(); await restored.flush()
    assert.equal(restored.requests.filter(item => /ai-chat$/.test(item.url)).at(-1).data.birthInfo.birthTime, '6')
  })

  test(`${platform}: unknown birth backup refills without inventing a birth hour`, async () => {
    const r = await runtime({ platform, stored: { user_birth_backup: JSON.stringify({ solarDate: '1984-02-02', birthTime: '未知' }) } })
    await login(r)
    const refill = r.requests.find(item => /birth-info$/.test(item.url))
    assert.ok(refill)
    assert.equal(refill.data.birthTime, '未知')
    r.respond(refill, { code: 0, data: birthInfo }); await r.flush()
    const chat = await r.evaluate('./pages/chat/index.vue', ['birthInfo'])
    assert.equal(chat.birthInfo.birthTime, '未知')
    assert.equal(JSON.parse(r.storage.get('user_info')).birthInfo.birthTime, '未知')
  })

  test(`${platform}: saving a known time keeps the normal success and personalized display`, async () => {
    const r = await runtime({ platform })
    await login(r)
    const home = await r.evaluate('./pages/index/index.vue', bindings)
    home.openBirthDrawer()
    home.onTempDateChange({ detail: { value: '1984-02-02' } })
    home.onTempTimeChange({ detail: { value: 4 } })
    const saving = home.saveBirthInfo(); await r.flush()
    const known = { ...birthInfo, birthTime: '卯时', yearGanZhi: '癸亥', monthGanZhi: '乙丑', dayGanZhi: '丙寅', hourGanZhi: '辛卯' }
    r.respond(r.requests.find(item => /birth-info$/.test(item.url)), { code: 0, data: known }); await r.flush()
    r.respond(r.requests.find(item => /profile$/.test(item.url)), { code: 0, data: { ...profile, birthInfo: known } }); await r.flush()
    r.respond(r.requests.find(item => /daily$/.test(item.url)), { code: 0, data: { score: 75, yi: [], ji: [] } })
    await saving; await r.flush()
    assert.ok(r.notifications.some(item => /专属灵感生成成功/.test(item.title)))
    assert.match(renderedText(home), /专属灵感/)
    assert.doesNotMatch(renderedText(home), /时辰未知，未生成完整排盘/)
  })
}
