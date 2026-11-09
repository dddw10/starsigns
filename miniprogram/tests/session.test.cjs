const { test } = require('node:test')
const assert = require('node:assert/strict')
const { runtime } = require('./runtime.cjs')
const session = (id = 'old') => ({ code: 0, data: { token: `${id}-token`, userInfo: { _id: id, nickname: id } } })

test('H5 cached profile is display only until token verification', async () => {
  const r = await runtime({ platform: 'H5', stored: { user_token: 'cached-token', user_info: JSON.stringify({ nickname: 'cached' }) } })
  r.store.initFromStorage()
  assert.equal(r.store.userInfo.nickname, 'cached')
  assert.equal(r.store.isLoggedIn, false)
})

test('session gate timeout rejects personalized request without sending guest data', async () => {
  const r = await runtime()
  r.request.setSessionReadyPromise(new Promise(() => {}))
  const result = r.request.get('/api/fortune/daily').catch(error => error)
  await r.flush()
  await r.advance(6001)
  assert.equal(r.requests.length, 0)
  const error = await result
  assert.equal(error.code, 'SESSION_NOT_READY')
})

test('logout invalidates in-flight login and persists explicit logout across restart', async () => {
  const r = await runtime()
  const pending = r.store.login()
  await r.flush()
  r.store.logout()
  r.respond(r.requests[0], session())
  await pending
  assert.equal(r.store.isLoggedIn, false)
  assert.equal(r.storage.has('user_token'), false)
  assert.equal(r.storage.get('user_logged_out'), true)
  const restarted = await runtime({ stored: Object.fromEntries(r.storage) })
  restarted.store.initFromStorage()
  await restarted.store.restoreSession()
  assert.equal(restarted.requests.length, 0)
})

test('old profile and old login cannot overwrite switched account', async () => {
  const r = await runtime({ platform: 'H5' })
  const old = r.store.login()
  await r.flush()
  r.respond(r.requests[0], session())
  await old
  const profile = r.store.fetchUserInfo()
  await r.flush()
  const switched = r.store.loginAccount('new', 'password')
  await r.flush()
  r.respond(r.requests.find(item => item.url.endsWith('/login-account')), session('new'))
  await switched
  r.respond(r.requests.find(item => item.url.endsWith('/profile')), { code: 0, data: { _id: 'old', nickname: 'late' } })
  await profile
  assert.equal(r.store.userInfo._id, 'new')
  assert.equal(r.storage.get('user_token'), 'new-token')
})

test('login 401 never recursively recovers itself', async () => {
  const r = await runtime()
  let result
  r.store.login().then(value => { result = value })
  await r.flush()
  r.respond(r.requests[0], { code: 401 }, 401)
  await r.flush()
  assert.equal(r.requests.length, 1)
  assert.equal(result?.success, false)
})

test('birth backfill does not block login or recover its own 401', async () => {
  const r = await runtime({ stored: { user_birth_backup: JSON.stringify({ solarDate: '1990-01-01', birthTime: '子时' }) } })
  let result
  r.store.login().then(value => { result = value })
  await r.flush()
  r.respond(r.requests[0], session())
  await r.flush()
  assert.equal(result?.success, true)
  const backfill = r.requests.find(item => item.url.endsWith('/birth-info'))
  r.respond(backfill, { code: 401 }, 401)
  await r.flush()
  assert.equal(r.requests.filter(item => item.url.endsWith('/login')).length, 1)
})

test('backfill response after account switch cannot overwrite current birth', async () => {
  const r = await runtime({ platform: 'H5', stored: { user_birth_backup: JSON.stringify({ solarDate: '1990-01-01', birthTime: '子时' }) } })
  r.store.login()
  await r.flush()
  r.respond(r.requests[0], session())
  await r.flush()
  const switched = r.store.loginAccount('new', 'password')
  await r.flush()
  r.respond(r.requests.find(item => item.url.endsWith('/login-account')), session('new'))
  await switched
  r.respond(r.requests.find(item => item.url.endsWith('/birth-info')), { code: 0, data: { solarDate: '1990-01-01', birthTime: '子时' } })
  await r.flush()
  assert.equal(r.store.userInfo._id, 'new')
  assert.equal(r.store.userInfo.birthInfo, undefined)
})

test('offline H5 cached token can verify again after cooldown without changing account', async () => {
  const r = await runtime({ platform: 'H5', stored: { user_token: 'account-token', auth_mode: 'account', user_info: '{"_id":"account"}' } })
  r.store.initFromStorage()
  const first = r.store.restoreSession()
  await r.flush()
  r.requests[0].fail({ errMsg: 'offline' }); await first
  await r.advance(30001)
  const retry = r.store.restoreSession()
  await r.flush()
  assert.equal(r.requests.length, 2)
  assert.equal(r.requests[1].header.Authorization, 'Bearer account-token')
  r.respond(r.requests[1], { code: 0, data: { _id: 'account' } })
  assert.equal((await retry).success, true)
})

test('late native login after timeout never exchanges an obsolete code', async () => {
  const r = await runtime()
  let finishNative
  r.uni.login = () => new Promise(resolve => { finishNative = resolve })
  const login = r.store.login()
  await r.flush()
  await r.advance(10001)
  assert.equal((await login).success, false)
  finishNative({ code: 'late' })
  await r.flush()
  assert.equal(r.requests.length, 0)
})

test('concurrent 401 shares one recovery; late old-token 401 reuses fresh token', async () => {
  const r = await runtime()
  const login = r.store.login(); await r.flush(); r.respond(r.requests[0], session()); await login
  const one = r.request.get('/api/one'), two = r.request.get('/api/two'), late = r.request.get('/api/late')
  await r.flush()
  r.respond(r.requests[1], { code: 401 }, 401); r.respond(r.requests[2], { code: 401 }, 401)
  await r.flush()
  assert.equal(r.requests.filter(item => item.url.endsWith('/login')).length, 2)
  r.respond(r.requests.findLast(item => item.url.endsWith('/login')), session('fresh'))
  await r.flush()
  r.respond(r.requests[3], { code: 401 }, 401); await r.flush()
  const retries = r.requests.filter(item => item.header.Authorization === 'Bearer fresh-token')
  assert.equal(retries.length, 3)
  for (const item of retries) r.respond(item, { code: 0, data: { ok: true } })
  await Promise.all([one, two, late])
  assert.equal(r.requests.filter(item => item.url.endsWith('/login')).length, 2)
})

test('restoration retries twice then cooldown suppresses foreground login storm', async () => {
  const r = await runtime()
  r.store.initFromStorage()
  const one = r.store.restoreSession(), two = r.store.restoreSession()
  await r.flush()
  for (let i = 0; i < 2; i++) { r.requests[i].fail({ errMsg: 'offline' }); await r.flush() }
  assert.equal((await one).success, false); await two
  await r.store.restoreSession()
  assert.equal(r.requests.length, 2)
  await r.advance(30001)
  const next = r.store.restoreSession()
  await r.flush(); r.respond(r.requests[2], session())
  assert.equal((await next).success, true)
})

test('valid H5 token verified by profile and expired account token requires credentials', async () => {
  for (const status of [200, 401]) {
    const r = await runtime({ platform: 'H5', stored: { user_token: 'account-token', auth_mode: 'account' } })
    r.store.initFromStorage()
    const pending = r.store.restoreSession(); await r.flush()
    r.respond(r.requests[0], status === 200 ? { code: 0, data: { _id: 'account' } } : { code: 401 }, status)
    assert.equal((await pending).success, status === 200)
    assert.equal(r.requests.length, 1)
  }
})

test('finishing an older session promise does not clear the newer gate', async () => {
  const r = await runtime()
  let finishOld, finishNew
  r.request.setSessionReadyPromise(new Promise(resolve => { finishOld = resolve }))
  r.request.setSessionReadyPromise(new Promise(resolve => { finishNew = resolve }))
  finishOld({ success: true }); await r.flush()
  const protectedRequest = r.request.get('/api/profile').catch(error => error)
  await r.flush()
  assert.equal(r.requests.length, 0)
  await r.advance(6001)
  assert.equal((await protectedRequest).code, 'SESSION_NOT_READY')
  finishNew({ success: false }); await r.flush()
})

test('skipSessionGate does not grant cached token authorization or suppress 401 recovery', async () => {
  const r = await runtime({ stored: { user_token: 'unverified' } })
  r.store.initFromStorage()
  await assert.rejects(r.request.get('/api/profile', {}, { skipSessionGate: true }), error => error.code === 'SESSION_NOT_READY')
  const login = r.store.login(); await r.flush(); r.respond(r.requests[0], session()); await login
  const pending = r.request.get('/api/profile', {}, { skipSessionGate: true })
  await r.flush(); r.respond(r.requests[1], { code: 401 }, 401); await r.flush()
  r.respond(r.requests[2], session('fresh')); await r.flush()
  r.respond(r.requests[3], { code: 0, data: { _id: 'old' } }); await pending
  assert.equal(r.requests[3].header.Authorization, 'Bearer fresh-token')
})

test('account login and registration 401 return failure without any recovery', async () => {
  for (const action of ['loginAccount', 'registerAccount']) {
    const r = await runtime({ platform: 'H5' })
    const pending = r.store[action]('user', 'password'); await r.flush()
    r.respond(r.requests[0], { code: 401 }, 401)
    assert.equal((await pending).success, false)
    assert.equal(r.requests.length, 1)
  }
})

test('new account recovery does not wait for old account recovery still in flight', async () => {
  const r = await runtime()
  r.store.initFromStorage()
  const old = r.request.recoverSession(); await r.flush()
  r.store.logout()
  const login = r.store.login(); await r.flush(); r.respond(r.requests[1], session('new')); await login
  const next = r.request.recoverSession(); await r.flush()
  assert.equal(r.requests.length, 3)
  r.respond(r.requests[2], session('fresh')); assert.equal(await next, true)
  r.respond(r.requests[0], session('old')); assert.equal(await old, false)
  assert.equal(r.store.userInfo._id, 'fresh')
})

test('new login after timeout does not accept a late previous exchange', async () => {
  const r = await runtime()
  const old = r.store.login(); await r.flush(); await r.advance(10001)
  assert.equal((await old).success, false)
  const next = r.store.login(); await r.flush(); r.respond(r.requests[1], session('fresh')); await next
  r.respond(r.requests[0], session('old')); await r.flush()
  assert.equal(r.store.userInfo._id, 'fresh')
})
