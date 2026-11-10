const { test } = require('node:test')
const assert = require('node:assert/strict')
const { runtime } = require('./runtime.cjs')

async function loggedInRuntime(platform) {
  const r = await runtime({ platform })
  const login = r.store.loginAccount('demo', 'password')
  await r.flush()
  r.respond(r.requests[0], { code: 0, data: { token: 'token', userInfo: { _id: 'user' } } })
  await login
  await r.flush()
  return r
}

async function setup(platform) {
  const r = await loggedInRuntime(platform)
  const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg', 'switchMode', 'messages', 'loading'])
  chat.inputMsg.value = 'question'
  await chat.sendMessage(); await r.flush()
  return { r, chat, sent: r.requests.find(item => /ai-chat$/.test(item.url)) }
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(`${platform}: switching account during the send gate cancels the old question`, async () => {
    const r = await loggedInRuntime(platform)
    const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg', 'messages', 'loading'])
    chat.inputMsg.value = 'old-account-private-question'
    const sending = chat.sendMessage()
    // Invalidate the identity synchronously during sendMessage's first await.
    const next = r.store.loginAccount('new', 'password')
    await r.flush(); await sending
    const sent = r.requests.find(item => /ai-chat$/.test(item.url))
    const observed = { launched: Boolean(sent), authorization: sent?.header?.Authorization ?? null,
      question: sent?.data?.messages?.at(-1)?.content }
    const exchange = r.requests.find(item => /login-account$/.test(item.url) && item !== r.requests[0])
    assert.ok(exchange)
    r.respond(exchange, { code: 0, data: { token: 'new-token', userInfo: { _id: 'new' } } })
    await next; await r.flush()
    assert.equal(Boolean(sent), false, `old question crossed identities: ${JSON.stringify(observed)}`)
    assert.equal(chat.loading.value, false)
    assert.equal(chat.inputMsg.value, 'old-account-private-question')
    assert.equal(chat.messages.value.some(item => item.role === 'user'), false)
    assert.equal(r.notifications.length, 0)
  })
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

for (const mode of ['private', 'council']) {
  for (const delivery of ['full response', 'chunk']) {
    test(`MP-WEIXIN: ${mode} public SSE error is visible from ${delivery}`, async () => {
      const r = await loggedInRuntime('MP-WEIXIN')
      const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg', 'switchMode', 'messages', 'loading'])
      chat.switchMode(mode)
      chat.inputMsg.value = 'question'
      await chat.sendMessage(); await r.flush()
      const sent = r.requests.find(item => /ai-chat$|council$/.test(item.url))
      assert.ok(sent)
      const error = { error: '推演暂时无法完成，请稍后重试', content: 'must not become a reply' }
      if (mode === 'council') error.agent = '妙空大师'
      const data = new TextEncoder().encode(`data: ${JSON.stringify(error)}\n\n`).buffer
      if (delivery === 'chunk') sent.task.chunk({ data })
      sent.success({ statusCode: 200, data }); sent.complete()
      assert.equal(chat.loading.value, false)
      assert.ok(r.notifications.some(item => /推演暂时无法完成/.test(item.title || item.content || '')),
        `public SSE error was invisible: ${JSON.stringify(r.notifications)}`)
      assert.equal(chat.messages.value.some(item => /must not become a reply/.test(item.content)), false)
    })
  }
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(`${platform}: same-account 401 recovery retries once with the fresh token`, async () => {
    const r = await runtime({ platform })
    const login = r.store.login(); await r.flush()
    r.respond(r.requests[0], { code: 0, data: { token: 'token', userInfo: { _id: 'user' } } })
    await login; await r.flush()
    const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg'])
    chat.inputMsg.value = 'question'
    await chat.sendMessage(); await r.flush()
    const sent = r.requests.find(item => /ai-chat$/.test(item.url))
    const version = r.store.sessionVersion
    r.respond(sent, {}, 401); await r.flush()
    const exchange = r.requests.find(item => /login$/.test(item.url) && item !== r.requests[0])
    assert.ok(exchange)
    r.respond(exchange, { code: 0, data: { token: 'fresh-token', userInfo: { _id: 'user' } } })
    await r.flush()
    const attempts = r.requests.filter(item => /ai-chat$/.test(item.url))
    assert.equal(attempts.length, 2)
    assert.equal(attempts[1].header.Authorization, 'Bearer fresh-token')
    assert.equal(attempts[1].data.messages.at(-1).content, 'question')
    assert.equal(r.store.sessionVersion, version)
    r.respond(attempts[1], {}, 401); await r.flush()
    assert.equal(r.requests.filter(item => /ai-chat$/.test(item.url)).length, 2)
    assert.equal(r.requests.filter(item => /login$/.test(item.url)).length, 2)
    assert.equal(r.notifications.length, 0)
  })
}
