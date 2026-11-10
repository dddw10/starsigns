const { test } = require('node:test')
const assert = require('node:assert/strict')
const { runtime } = require('./runtime.cjs')
const { validateAIInput } = require('../../server/src/utils/aiInput')

const chatRequests = r => r.requests.filter(item => /ai-chat$|council$/.test(item.url))
const plain = value => JSON.parse(JSON.stringify(value))
async function setup(platform, mode) {
  const r = await runtime({ platform })
  const login = r.store.login(); await r.flush()
  r.respond(r.requests[0], { code: 0, data: { token: 'token', userInfo: { _id: 'user' } } })
  await login; await r.flush()
  const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg', 'switchMode', 'messages', 'loading'])
  chat.switchMode(mode)
  return { r, chat }
}
async function send(r, chat, question) {
  chat.inputMsg.value = question
  await chat.sendMessage(); await r.flush()
  return chatRequests(r).at(-1)
}
function reply(r, sent, platform, mode, content) {
  if (platform === 'H5') {
    r.respond(sent, { code: 0, data: mode === 'private' ? { content } : { opinions: [{ agent: 'expert', content }] } })
  } else {
    const payload = mode === 'private' ? { content } : { agent: 'expert', content }
    sent.task.chunk({ data: new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`).buffer })
    r.respond(sent, new ArrayBuffer(0))
  }
}
function unauthorized(r, sent) {
  const data = new TextEncoder().encode(JSON.stringify({ code: 401, message: 'token expired' })).buffer
  sent.task.chunk({ data })
  r.respond(sent, data, 401)
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(`${platform}: clearing during the session gate cannot send an empty or earlier question`, async () => {
    const { r, chat } = await setup(platform, 'private')
    chat.inputMsg.value = 'short question'
    const sending = chat.sendMessage()
    chat.inputMsg.value = ''
    await sending; await r.flush()
    assert.equal(chatRequests(r).length, 0)
    assert.equal(chat.loading.value, false)
  })
  test(`${platform}: editing during the session gate cannot silently shorten the question`, async () => {
    const { r, chat } = await setup(platform, 'private')
    chat.inputMsg.value = 'short question'
    const sending = chat.sendMessage()
    chat.inputMsg.value = '长'.repeat(4001)
    await sending; await r.flush()
    assert.equal(chatRequests(r).length, 0)
    assert.equal(chat.inputMsg.value.length, 4001)
    assert.equal(chat.loading.value, false)
    assert.ok(r.notifications.some(item => /4000/.test(item.title || item.content)))
  })
  for (const mode of ['private', 'council']) {
    test(`${platform} ${mode}: full long reply stays visible and its follow-up meets the server protocol`, async () => {
      const { r, chat } = await setup(platform, mode)
      const sent = await send(r, chat, 'first short question')
      const generated = '界'.repeat(4500)
      reply(r, sent, platform, mode, generated); await r.flush()
      const followup = await send(r, chat, 'short follow-up')
      assert.notEqual(followup, sent)
      assert.ok(chat.messages.value.some(item => item.content === generated))
      assert.doesNotThrow(() => validateAIInput(plain(followup.data)))
      assert.equal(followup.data.messages.at(-1).content, 'short follow-up')
    })

    test(`${platform} ${mode}: history at and above 20000 retains the entire latest question`, async () => {
      const { r, chat } = await setup(platform, mode)
      for (const count of [4, 5]) {
        chat.messages.value = Array.from({ length: count }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: String(i).repeat(4000) }))
        chat.messages.value.unshift({ role: 'system', content: 'ignore' }, { role: 'assistant', content: '   ' })
        const before = plain(chat.messages.value)
        const question = '新'.repeat(4000)
        const sent = await send(r, chat, question)
        assert.doesNotThrow(() => validateAIInput(plain(sent.data)))
        assert.equal(sent.data.messages.at(-1).content, question)
        assert.equal(sent.data.messages.reduce((sum, item) => sum + item.content.length, 0), 20000)
        assert.deepEqual(plain(chat.messages.value.slice(0, before.length)), before)
        reply(r, sent, platform, mode, 'ok'); await r.flush()
      }
    })

    test(`${platform} ${mode}: an oversized current question stays editable and is not silently shortened`, async () => {
      const { r, chat } = await setup(platform, mode)
      const question = '长'.repeat(4001)
      const before = plain(chat.messages.value)
      await send(r, chat, question)
      assert.equal(chatRequests(r).length, 0)
      assert.equal(chat.inputMsg.value, question)
      assert.deepEqual(plain(chat.messages.value), before)
      assert.equal(chat.loading.value, false)
      assert.ok(r.notifications.some(item => /4000/.test(item.title || item.content)))
    })
  }
}

for (const mode of ['private', 'council']) {
  test(`MP-WEIXIN ${mode}: JSON 401 chunks recover once, isolate the old attempt, then stop on a second 401`, async () => {
    const { r, chat } = await setup('MP-WEIXIN', mode)
    const sent = await send(r, chat, 'question')
    unauthorized(r, sent); await r.flush()
    const exchanges = r.requests.filter(item => /login$/.test(item.url))
    assert.equal(exchanges.length, 2)
    r.respond(exchanges[1], { code: 0, data: { token: 'fresh-token', userInfo: { _id: 'user' } } }); await r.flush()
    const attempts = chatRequests(r)
    assert.equal(attempts.length, 2)
    assert.equal(attempts[1].header.Authorization, 'Bearer fresh-token')
    assert.equal(attempts[1].data.messages.at(-1).content, 'question')
    const before = plain(chat.messages.value)
    reply(r, sent, 'MP-WEIXIN', mode, 'stale content')
    sent.fail({ errMsg: 'stale failure' })
    assert.deepEqual(plain(chat.messages.value), before)
    assert.equal(chat.loading.value, true)
    unauthorized(r, attempts[1]); await r.flush()
    assert.equal(chatRequests(r).length, 2)
    assert.equal(r.requests.filter(item => /login$/.test(item.url)).length, 2)
    assert.equal(chat.loading.value, false)
    assert.equal(r.notifications.length, 0)
  })

  for (const action of ['unload', 'logout', 'switch account']) {
    test(`MP-WEIXIN ${mode}: ${action} during JSON-chunk 401 recovery prevents replay`, async () => {
      const { r, chat } = await setup('MP-WEIXIN', mode)
      const sent = await send(r, chat, 'private question')
      unauthorized(r, sent); await r.flush()
      const exchange = r.requests.filter(item => /login$/.test(item.url))[1]
      assert.ok(exchange)
      let switching
      if (action === 'unload') for (const hook of r.hook('pages/chat/index.vue', 'onUnload')) hook()
      else if (action === 'logout') r.store.logout()
      else { switching = r.store.loginAccount('new', 'password'); await r.flush() }
      r.respond(exchange, { code: 0, data: { token: 'old-recovery', userInfo: { _id: 'user' } } }); await r.flush()
      if (switching) {
        r.respond(r.requests.find(item => /login-account$/.test(item.url)), { code: 0, data: { token: 'new-token', userInfo: { _id: 'new' } } })
        await switching; await r.flush()
        assert.equal(r.store.userInfo._id, 'new')
      }
      assert.equal(chatRequests(r).length, 1)
      assert.equal(chat.loading.value, false)
      assert.equal(r.notifications.some(item => /401/.test(item.title || item.content)), false)
    })
  }
}
