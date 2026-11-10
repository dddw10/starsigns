const VERSION = 1
const MAX_MESSAGES = 200
const MAX_CHARS = 200000

function storageKey(owner, mode) {
  if (typeof owner !== 'string' || !owner.trim() || !['private', 'council'].includes(mode)) return null
  return `chat_history_v1:${encodeURIComponent(owner)}:${mode}`
}

function displayMessage(message, saving = false) {
  if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null
  const result = { role: message.role, content: message.content }
  for (const field of ['avatar', 'agentName']) {
    if (message[field] === undefined) continue
    if (typeof message[field] !== 'string') return null
    result[field] = message[field]
  }
  if (message.status !== undefined) {
    if (message.status !== 'stopped' && !(saving && message.status === 'streaming')) return null
    // 周期保存时也按中断记录，冷启动不会把旧生成误当成已完成。
    result.status = 'stopped'
  }
  return result
}

export function readChatHistory(owner, mode) {
  try {
    const key = storageKey(owner, mode)
    if (!key) return null
    const raw = uni.getStorageSync(key)
    if (typeof raw !== 'string' || raw.length > MAX_CHARS) return null
    const cache = JSON.parse(raw)
    if (cache?.version !== VERSION || !Array.isArray(cache.messages) || cache.messages.length > MAX_MESSAGES) return null
    const messages = cache.messages.map(message => displayMessage(message))
    return messages.every(Boolean) ? messages : null
  } catch (error) {
    return null
  }
}

export function writeChatHistory(owner, mode, entries) {
  try {
    const key = storageKey(owner, mode)
    if (!key || !Array.isArray(entries)) return false
    const messages = entries.slice(-MAX_MESSAGES).map(message => displayMessage(message, true))
    if (!messages.every(Boolean)) return false
    // 单条异常超大拒绝保存，不能通过截字或丢弃这条回复伪装成功。
    if (messages.some(message => JSON.stringify({ version: VERSION, messages: [message] }).length > MAX_CHARS)) return false
    let raw = JSON.stringify({ version: VERSION, messages })
    while (raw.length > MAX_CHARS && messages.length > 1) {
      messages.shift()
      raw = JSON.stringify({ version: VERSION, messages })
    }
    uni.setStorageSync(key, raw)
    return true
  } catch (error) {
    return false
  }
}
