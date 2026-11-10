const { test } = require('node:test')
const assert = require('node:assert/strict')
const { runtime } = require('./runtime.cjs')
const { validateAIInput } = require('../../server/src/utils/aiInput')

const plain = value => JSON.parse(JSON.stringify(value))
const chatRequests = r => r.requests.filter(item => /ai-chat$|council$/.test(item.url))
const historyKey = (owner, mode) => `chat_history_v1:${encodeURIComponent(owner)}:${mode}`
const historyEntries = r => [...r.storage.entries()].filter(([key]) => key.startsWith('chat_history_v1:'))

async function authenticate(r, owner = 'alice', method = 'login') {
  const pending = method === 'login' ? r.store.login() : r.store.loginAccount(owner, 'password')
  await r.flush()
  r.respond(r.requests.at(-1), { code: 0, data: { token: `token-${owner}`, userInfo: { userId: owner, birthInfo: { solarDate: '2000-01-01', birthTime: '未知' } } } })
  await pending; await r.flush()
}
async function mount(r) {
  r.store.systemConfigStatus = 'loaded'; r.store.auditMode = false
  const chat = await r.evaluate('./pages/chat/index.vue', ['sendMessage', 'inputMsg', 'switchMode', 'messages', 'loading', 'goBack'])
  for (const hook of r.hook('pages/chat/index.vue', 'onMounted')) await hook()
  await r.flush()
  return chat
}
async function setup(platform = 'H5') {
  const r = await runtime({ platform }); await authenticate(r)
  return { r, chat: await mount(r) }
}
async function send(r, chat, text = '我的问题') {
  chat.inputMsg.value = text; await chat.sendMessage(); await r.flush()
  return chatRequests(r).at(-1)
}
function chunk(sent, payload) {
  sent.task.chunk({ data: new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`).buffer })
}
function finish(r, sent, platform, mode, text) {
  if (platform === 'H5') r.respond(sent, { code: 0, data: mode === 'private' ? { content: text } : { opinions: [{ agent: '妙空大师', content: text }] } })
  else {
    chunk(sent, mode === 'private' ? { content: text } : { agent: '妙空大师', content: text })
    sent.task.chunk({ data: new TextEncoder().encode('data: [DONE]\n\n').buffer })
    r.respond(sent, new ArrayBuffer(0))
  }
}
function unload(r) { for (const hook of r.hook('pages/chat/index.vue', 'onUnload')) hook() }
async function reopen(r, platform, owner = 'alice') {
  const next = await runtime({ platform, stored: Object.fromEntries(r.storage) })
  next.store.initFromStorage()
  const chat = await mount(next)
  assert.equal(chat.messages.value.some(item => item.content.includes('我的问题')), false, 'unverified cached identity cannot reveal history')
  const restoring = next.store.restoreSession({ retry: true }); await next.flush()
  const exchange = next.requests.at(-1)
  next.respond(exchange, { code: 0, data: platform === 'H5' ? { _id: owner } : { token: `fresh-${owner}`, userInfo: { _id: owner } } })
  await restoring; await next.flush()
  return { r: next, chat }
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  for (const mode of ['private', 'council']) {
    test(`${platform} ${mode}: completed long reply survives a new VM with bounded follow-up context`, async () => {
      const { r, chat } = await setup(platform); chat.switchMode(mode)
      const sent = await send(r, chat)
      const text = '完整长回复🧘'.repeat(3000)
      finish(r, sent, platform, mode, text); await r.flush(); unload(r)
      const recovered = await reopen(r, platform); recovered.chat.switchMode(mode)
      const reply = recovered.chat.messages.value.find(item => item.content === text)
      assert.ok(reply, 'full text was lost across page/VM recreation')
      assert.equal(reply.avatar, mode === 'private' ? '🔮' : '🧘')
      if (mode === 'council') assert.equal(reply.agentName, '妙空大师')
      assert.equal(recovered.chat.loading.value, false)
      assert.equal(chatRequests(recovered.r).length, 0, 'restoration must not replay generation')
      const followup = await send(recovered.r, recovered.chat, '继续')
      assert.equal(followup.data.messages.at(-1).content, '继续')
      assert.doesNotThrow(() => validateAIInput(plain(followup.data)))
      assert.ok(recovered.chat.messages.value.some(item => item.content === text))
      unload(recovered.r)
    })
  }
  test(`${platform}: switching modes keeps separate histories and flushes the outgoing conversation`, async () => {
    const { r, chat } = await setup(platform)
    finish(r, await send(r, chat), platform, 'private', '私聊答案'); await r.flush()
    chat.switchMode('council')
    assert.equal(chat.messages.value.some(item => item.content === '私聊答案'), false)
    finish(r, await send(r, chat, '圆桌问题'), platform, 'council', '圆桌答案'); await r.flush()
    chat.switchMode('private'); assert.ok(chat.messages.value.some(item => item.content === '私聊答案'))
    chat.switchMode('council'); assert.ok(chat.messages.value.some(item => item.content === '圆桌答案'))
    unload(r)
  })
  test(`${platform}: logout/account change isolates histories and late callbacks from the original owner`, async () => {
    const { r, chat } = await setup(platform)
    finish(r, await send(r, chat), platform, 'private', 'alice的秘密'); await r.flush()
    const late = await send(r, chat, 'alice未完成问题')
    const switching = r.store.loginAccount('bob', 'password'); await r.flush()
    assert.equal(chat.messages.value.some(item => /alice|秘密|我的问题/.test(item.content)), false)
    assert.equal(late.task.aborted, true)
    r.respond(r.requests.at(-1), { code: 0, data: { token: 'bob-token', userInfo: { _id: 'bob' } } })
    await switching; await r.flush()
    finish(r, late, platform, 'private', '晚到alice内容'); await r.advance(2000)
    assert.equal(chat.messages.value.some(item => /alice|秘密|我的问题/.test(item.content)), false)
    finish(r, await send(r, chat, 'bob的问题'), platform, 'private', 'bob答案'); await r.flush()
    r.store.logout(); await r.flush()
    assert.equal(chat.messages.value.some(item => /bob/.test(item.content)), false)
    await authenticate(r, 'alice', 'account')
    assert.ok(chat.messages.value.some(item => item.content === 'alice的秘密'))
    assert.equal(chat.messages.value.some(item => /bob|晚到/.test(item.content)), false)
    const cachedAlice = r.storage.get(historyKey('alice', 'private'))
    assert.ok(cachedAlice && !cachedAlice.includes('bob答案') && !cachedAlice.includes('晚到alice内容'))
    unload(r)
  })
  for (const recoveredOwner of ['alice', 'bob']) {
    test(`${platform}: 401 recovery ${recoveredOwner === 'alice' ? 'retains the same history and retries once' : 'cannot replay or save into a changed identity even without a version change'}`, async () => {
      const { r, chat } = await setup(platform)
      finish(r, await send(r, chat), platform, 'private', 'alice之前的答案'); await r.flush()
      const sent = await send(r, chat, 'alice待恢复问题')
      r.respond(sent, new ArrayBuffer(0), 401); await r.flush()
      assert.equal(chat.messages.value.some(item => /alice/.test(item.content)), false, 'hide history during unverified recovery')
      const recovery = r.requests.at(-1)
      assert.match(recovery.url, /login$/)
      r.respond(recovery, { code: 0, data: { token: 'fresh', userInfo: { _id: recoveredOwner } } }); await r.flush()
      const attempts = chatRequests(r)
      if (recoveredOwner === 'alice') {
        assert.equal(attempts.length, 3)
        assert.ok(chat.messages.value.some(item => item.content === 'alice之前的答案'))
        finish(r, attempts.at(-1), platform, 'private', '恢复后答案'); await r.flush()
        assert.ok(chat.messages.value.some(item => item.content === '恢复后答案'))
      } else {
        assert.equal(attempts.length, 2)
        assert.equal(chat.loading.value, false)
        assert.equal(chat.messages.value.some(item => /alice/.test(item.content)), false)
        assert.equal(Boolean(r.storage.get(historyKey('bob', 'private'))?.includes('alice')), false)
      }
      unload(r)
    })
  }
}

for (const mode of ['private', 'council']) {
  test(`MP-WEIXIN ${mode}: exiting a chunked reply keeps only received text with stopped status`, async () => {
    const { r, chat } = await setup('MP-WEIXIN'); chat.switchMode(mode)
    const sent = await send(r, chat)
    const text = '收到的部分🧘'.repeat(700)
    chunk(sent, mode === 'private' ? { content: text } : { agent: '妙空大师', event: 'start' })
    if (mode === 'council') chunk(sent, { agent: '妙空大师', content: text })
    await r.flush()
    chat.goBack(); unload(r)
    assert.equal(sent.task.aborted, true)
    chunk(sent, mode === 'private' ? { content: '晚到内容' } : { agent: '妙空大师', content: '晚到内容' })
    sent.success({ statusCode: 200, data: new ArrayBuffer(0) }); sent.complete()
    const recovered = await reopen(r, 'MP-WEIXIN'); recovered.chat.switchMode(mode)
    const reply = recovered.chat.messages.value.find(item => item.content === text)
    assert.ok(reply, 'received partial output was not saved on exit')
    assert.equal(reply.status, 'stopped')
    assert.equal(recovered.chat.loading.value, false)
    assert.equal(recovered.chat.messages.value.some(item => item.content.includes('晚到')), false)
    assert.equal(chatRequests(recovered.r).length, 0)
    await send(recovered.r, recovered.chat, '继续')
    assert.equal(chatRequests(recovered.r).length, 1)
    unload(recovered.r)
  })
}

test('stream persistence is coalesced, flushes recent text, and does not persist runtime/secrets', async () => {
  const { r, chat } = await setup('MP-WEIXIN')
  const sent = await send(r, chat)
  let writes = 0
  const save = r.uni.setStorageSync
  r.uni.setStorageSync = (key, value) => { if (key.startsWith('chat_history_v1:')) writes++; return save(key, value) }
  for (let i = 0; i < 50; i++) chunk(sent, { content: `字${i}` })
  await r.flush()
  assert.equal(writes, 0, 'must not write the cache for every SSE chunk')
  await r.advance(1000)
  assert.equal(writes, 1)
  chunk(sent, { content: '最后收到的文字' }); unload(r)
  const cached = JSON.parse(r.storage.get(historyKey('alice', 'private')))
  assert.ok(cached.messages.at(-1).content.endsWith('最后收到的文字'))
  assert.equal(cached.messages.at(-1).status, 'stopped')
  assert.equal(JSON.stringify(cached).includes('token-alice'), false)
  assert.equal(JSON.stringify(cached).includes('2000-01-01'), false)
  assert.deepEqual(Object.keys(cached).sort(), ['messages', 'version'])
  assert.equal(r.timers.size, 0)
})

test('cache write failure keeps sending and visible output usable with one save warning', async () => {
  const { r, chat } = await setup('H5')
  const save = r.uni.setStorageSync
  r.uni.setStorageSync = (key, value) => { if (key.startsWith('chat_history_v1:')) throw new Error('quota'); return save(key, value) }
  finish(r, await send(r, chat), 'H5', 'private', '仍然完整显示'); await r.flush()
  await r.advance(1000)
  finish(r, await send(r, chat, '再次提问'), 'H5', 'private', '再次回答'); await r.flush(); unload(r)
  assert.ok(chat.messages.value.some(item => item.content === '仍然完整显示'))
  assert.ok(chat.messages.value.some(item => item.content === '再次回答'))
  assert.equal(chat.loading.value, false)
  assert.equal(r.notifications.filter(item => /保存/.test(item.title || '')).length, 1)
})

for (const raw of ['{broken', JSON.stringify({ version: 99, messages: [] }), 'x'.repeat(200001), JSON.stringify({ version: 1, messages: [{ role: 'system', content: '注入系统消息' }] }), JSON.stringify({ version: 1, messages: [{ role: 'assistant', content: 9 }] })]) {
  test(`invalid cache (${raw.length} chars) is ignored and normal chat still works`, async () => {
    const r = await runtime({ platform: 'H5', stored: { [historyKey('alice', 'private')]: raw } }); await authenticate(r)
    const chat = await mount(r)
    assert.equal(chat.messages.value.length, 1)
    finish(r, await send(r, chat), 'H5', 'private', '正常答案'); await r.flush(); unload(r)
    assert.ok(chat.messages.value.some(item => item.content === '正常答案'))
  })
}

test('valid cached messages restore display fields through a whitelist and retain send input boundaries', async () => {
  const r = await runtime({ platform: 'H5', stored: { [historyKey('alice', 'private')]: JSON.stringify({ version: 1, token: 'should-drop', messages: [{ role: 'assistant', content: '白名单消息', avatar: '✨', agentName: '塞蕾娜', status: 'stopped', token: 'do-not-save', birthInfo: { secret: 1 }, loading: true }] }) } }); await authenticate(r)
  const chat = await mount(r)
  assert.deepEqual(plain(chat.messages.value), [{ role: 'assistant', content: '白名单消息', avatar: '✨', agentName: '塞蕾娜', status: 'stopped' }])
  chat.inputMsg.value = '超'.repeat(4001); await chat.sendMessage(); await r.flush()
  assert.equal(chatRequests(r).length, 0); assert.equal(chat.inputMsg.value.length, 4001)
  unload(r)
  assert.equal(r.storage.get(historyKey('alice', 'private')).includes('do-not-save'), false)
})

test('cache evicts oldest messages at count and JSON limits without clipping a reply', async () => {
  const { r, chat } = await setup('H5')
  chat.messages.value = Array.from({ length: 210 }, (_, i) => ({ role: 'assistant', content: `消息${i}` }))
  chat.switchMode('council'); chat.switchMode('private')
  assert.equal(chat.messages.value.length, 200)
  assert.equal(chat.messages.value[0].content, '消息10')
  const newest = '最新长回复'.repeat(6000)
  chat.messages.value = [{ role: 'assistant', content: '最老'.repeat(50000) }, { role: 'assistant', content: '较老'.repeat(40000) }, { role: 'assistant', content: newest }]
  chat.switchMode('council'); chat.switchMode('private')
  assert.equal(chat.messages.value.some(item => item.content === '最老'.repeat(50000)), false)
  assert.ok(chat.messages.value.some(item => item.content === newest))
  assert.ok(r.storage.get(historyKey('alice', 'private')).length <= 200000)
  unload(r)
})

test('a single oversized reply stays fully visible but cannot be cached', async () => {
  const { r, chat } = await setup('H5')
  const sent = await send(r, chat)
  const huge = '大'.repeat(200001)
  finish(r, sent, 'H5', 'private', huge); await r.flush(); unload(r)
  assert.ok(chat.messages.value.some(item => item.content === huge))
  assert.equal(historyEntries(r).some(([, raw]) => raw.includes(huge)), false)
  assert.ok(r.notifications.some(item => /保存/.test(item.title || '')))
})

test('MP-WEIXIN: a 401 invalidates old chunks immediately before recovery starts awaiting', async () => {
  const { r, chat } = await setup('MP-WEIXIN')
  const sent = await send(r, chat)
  sent.success({ statusCode: 401, data: new ArrayBuffer(0) })
  // Recovery is deliberately still before its first microtask here.
  chunk(sent, { content: '401之后的旧分片' })
  sent.complete(); await r.flush()
  r.respond(r.requests.at(-1), { code: 0, data: { token: 'fresh-alice', userInfo: { _id: 'alice' } } }); await r.flush()
  finish(r, chatRequests(r).at(-1), 'MP-WEIXIN', 'private', '恢复后有效回复'); await r.flush(); unload(r)
  assert.equal(chat.messages.value.some(item => item.content.includes('401之后的旧分片')), false)
  assert.equal(r.storage.get(historyKey('alice', 'private')).includes('401之后的旧分片'), false)
})

test('MP-WEIXIN: a completed chunked reply restores without a stopped label', async () => {
  const { r, chat } = await setup('MP-WEIXIN')
  finish(r, await send(r, chat), 'MP-WEIXIN', 'private', '完整完成'); await r.flush(); unload(r)
  const recovered = await reopen(r, 'MP-WEIXIN')
  assert.equal(recovered.chat.messages.value.find(item => item.content === '完整完成')?.status, undefined)
  unload(recovered.r)
})

test('MP-WEIXIN: a periodically saved live reply restores as stopped after a VM restart', async () => {
  const { r, chat } = await setup('MP-WEIXIN')
  const sent = await send(r, chat)
  chunk(sent, { content: '重启前已收到' }); await r.advance(1000)
  const recovered = await reopen(r, 'MP-WEIXIN')
  assert.equal(recovered.chat.messages.value.find(item => item.content === '重启前已收到')?.status, 'stopped')
  assert.equal(recovered.chat.loading.value, false)
  assert.equal(chatRequests(recovered.r).length, 0)
  unload(r); unload(recovered.r)
})

test('MP-WEIXIN: full-payload fallback preserves individual council agents on restoration', async () => {
  const { r, chat } = await setup('MP-WEIXIN'); chat.switchMode('council')
  const sent = await send(r, chat)
  const frames = [
    { agent: '妙空大师', event: 'start' }, { agent: '妙空大师', content: '第一位答案' }, { agent: '妙空大师', event: 'end' },
    { agent: '塞蕾娜', event: 'start' }, { agent: '塞蕾娜', content: '第二位答案' }, { agent: '塞蕾娜', event: 'end' }
  ]
  const payload = frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n'
  r.respond(sent, new TextEncoder().encode(payload).buffer); await r.flush(); unload(r)
  const recovered = await reopen(r, 'MP-WEIXIN'); recovered.chat.switchMode('council')
  const replies = plain(recovered.chat.messages.value.filter(item => item.agentName))
  assert.deepEqual(replies, [
    { role: 'assistant', agentName: '妙空大师', content: '第一位答案', avatar: '🧘' },
    { role: 'assistant', agentName: '塞蕾娜', content: '第二位答案', avatar: '✨' }
  ])
  unload(recovered.r)
})

test('chat cache read errors do not prevent a normal reply or retry', async () => {
  const r = await runtime({ platform: 'H5' }); await authenticate(r)
  const read = r.uni.getStorageSync
  r.uni.getStorageSync = key => { if (key.startsWith('chat_history_v1:')) throw new Error('storage unreadable'); return read(key) }
  const chat = await mount(r)
  finish(r, await send(r, chat), 'H5', 'private', '读取失败后正常回答'); await r.flush()
  assert.ok(chat.messages.value.some(item => item.content === '读取失败后正常回答'))
  assert.equal(chat.loading.value, false)
  unload(r)
})

test('MP-WEIXIN: council partial text and stopped state notify the visible Vue message', async () => {
  const { watch } = require('vue')
  const { r, chat } = await setup('MP-WEIXIN'); chat.switchMode('council')
  const sent = await send(r, chat)
  chunk(sent, { agent: '妙空大师', event: 'start' }); await r.flush()
  let observed = ''
  const stop = watch(() => [chat.messages.value.at(-1).content, chat.messages.value.at(-1).status], value => { observed = value.join(':') })
  chunk(sent, { agent: '妙空大师', content: '实时可见的部分' }); await r.flush()
  assert.equal(observed, '实时可见的部分:streaming')
  unload(r); await r.flush()
  assert.equal(observed, '实时可见的部分:stopped')
  stop()
})

for (const platform of ['H5', 'MP-WEIXIN']) {
  for (const mode of ['private', 'council']) {
    for (const outcome of ['complete', 'fail']) {
      test(`${platform} ${mode}: external profile 401 cancels the chat safely before its late ${outcome}`, async () => {
        const { r, chat } = await setup(platform); chat.switchMode(mode)
        finish(r, await send(r, chat, '先前问题'), platform, mode, '先前已完成答案'); await r.flush()
        const sent = await send(r, chat, '恢复前正在推演的问题')
        if (platform === 'MP-WEIXIN') chunk(sent, mode === 'private' ? { content: '恢复前已收到部分' } : { agent: '妙空大师', content: '恢复前已收到部分' })
        chat.inputMsg.value = '恢复后的继续问题'

        // App.onShow uses this actual store alias; the profile request owns the 401.
        const profile = r.store.checkLoginStatus(); await r.flush()
        const originalProfile = r.requests.at(-1)
        assert.match(originalProfile.url, /profile$/)
        r.respond(originalProfile, {}, 401); await r.flush()
        assert.equal(r.store.sessionStatus, 'restoring')
        const recovery = r.requests.at(-1)
        assert.match(recovery.url, /login$/)
        assert.equal(chat.loading.value, false, 'external authentication must finish the interrupted chat lifecycle')
        assert.equal(sent.task.aborted, true)
        assert.equal(chat.inputMsg.value, '恢复后的继续问题')
        assert.equal(chat.messages.value.some(item => /先前已完成|恢复前/.test(item.content)), false)

        if (outcome === 'complete') finish(r, sent, platform, mode, '认证期间晚到回复')
        else { sent.fail({ errMsg: 'late network failure' }); sent.complete() }
        const saved = JSON.parse(r.storage.get(historyKey('alice', mode)))
        assert.ok(saved.messages.some(item => item.content === '先前已完成答案'))
        assert.equal(saved.messages.some(item => item.content.includes('认证期间晚到回复')), false)
        if (platform === 'MP-WEIXIN') assert.equal(saved.messages.find(item => item.content === '恢复前已收到部分')?.status, 'stopped')

        r.respond(recovery, { code: 0, data: { token: 'fresh-alice', userInfo: { _id: 'alice' } } }); await r.flush()
        const retriedProfile = r.requests.at(-1)
        assert.match(retriedProfile.url, /profile$/)
        r.respond(retriedProfile, { code: 0, data: { _id: 'alice' } }); await profile; await r.flush()
        assert.equal(r.store.isLoggedIn, true)
        assert.equal(chat.loading.value, false)
        assert.ok(chat.messages.value.some(item => item.content === '先前已完成答案'))
        if (platform === 'MP-WEIXIN') assert.equal(chat.messages.value.find(item => item.content === '恢复前已收到部分')?.status, 'stopped')
        assert.equal(chat.messages.value.some(item => item.content.includes('认证期间晚到回复')), false)
        assert.equal(r.notifications.length, 0)
        const before = chatRequests(r).length
        await chat.sendMessage(); await r.flush()
        assert.equal(chatRequests(r).length, before + 1)
        assert.equal(chatRequests(r).at(-1).data.messages.at(-1).content, '恢复后的继续问题')
        finish(r, chatRequests(r).at(-1), platform, mode, '继续问题的答案'); await r.flush(); unload(r)
      })
    }
  }
}
