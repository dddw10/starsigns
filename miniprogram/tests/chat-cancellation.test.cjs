const { test } = require('node:test')
const assert = require('node:assert/strict')
const { runtime } = require('./runtime.cjs')

async function setup(platform) {
  const r = await runtime({ platform })
  const login = r.store.loginAccount('demo', 'password')
  await r.flush()
  r.respond(r.requests[0], { code: 0, data: { token: 'token', userInfo: { _id: 'user' } } })
  await login
  const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg', 'switchMode', 'messages', 'loading'])
  chat.inputMsg.value = 'question'
  await chat.sendMessage(); await r.flush()
  return { r, chat, sent: r.requests.find(item => /ai-chat$/.test(item.url)) }
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(`${platform}: mode switch aborts old request and ignores late callbacks`, async () => {
    const { r, chat, sent } = await setup(platform)
    chat.switchMode('council')
    assert.equal(sent.task.aborted, true)
    assert.equal(chat.loading.value, false)
    const before = JSON.stringify(chat.messages.value)
    sent.success({ statusCode: 200, data: { code: 0, data: { content: 'stale' } } })
    sent.task.chunk?.({ data: Buffer.from('data: {"content":"stale"}\n\n').buffer })
    sent.fail({ errMsg: 'late failure' }); sent.complete()
    assert.equal(JSON.stringify(chat.messages.value), before)
    assert.equal(r.notifications.length, 0)
  })
  test(`${platform}: hiding keeps the request, unloading aborts it`, async () => {
    const { r, sent } = await setup(platform)
    for (const hook of r.hook('pages/chat/index.vue', 'onHide')) hook()
    assert.equal(sent.task.aborted, false)
    for (const hook of r.hook('pages/chat/index.vue', 'onUnload')) hook()
    assert.equal(sent.task.aborted, true)
    assert.equal(r.notifications.length, 0)
  })
  test(`${platform}: old completion cannot clear a newer request loading state`, async () => {
    const { r, chat, sent } = await setup(platform)
    chat.switchMode('council')
    chat.inputMsg.value = 'new question'
    await chat.sendMessage()
    sent.complete()
    assert.equal(chat.loading.value, true)
    assert.equal(r.requests.filter(item => /council$/.test(item.url)).length, 1)
  })
}

test('leaving while login is pending prevents a delayed request launch', async () => {
  const r = await runtime()
  const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg'])
  chat.inputMsg.value = 'question'
  const pending = chat.sendMessage(); await r.flush()
  for (const hook of r.hook('pages/chat/index.vue', 'onUnload')) hook()
  r.respond(r.requests[0], { code: 0, data: { token: 'fresh', userInfo: { _id: 'user' } } })
  await pending
  assert.equal(r.requests.some(item => /ai-chat$/.test(item.url)), false)
})


test('leaving during shared 401 recovery cannot resend the old question', async () => {
  const { r, sent } = await setup('MP-WEIXIN')
  r.respond(sent, {}, 401); await r.flush()
  const exchange = r.requests.filter(item => /login$/.test(item.url)).at(-1)
  assert.ok(exchange)
  for (const hook of r.hook('pages/chat/index.vue', 'onUnload')) hook()
  r.respond(exchange, { code: 0, data: { token: 'new', userInfo: { _id: 'user' } } })
  await r.flush()
  assert.equal(r.requests.filter(item => /ai-chat$/.test(item.url)).length, 1)
})
