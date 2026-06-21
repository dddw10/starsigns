<template>
  <view class="chat-container" :class="themeClass">
    <!-- 头部：切换会谈模式 -->
    <view class="chat-header">
      <view class="nav-back" @click="goBack">⬅</view>
      <view class="mode-selector">
        <view 
          class="mode-tab" 
          :class="{ active: chatMode === 'private' }" 
          @click="switchMode('private')"
        >
          🔮 1对1私聊
        </view>
        <view 
          class="mode-tab" 
          :class="{ active: chatMode === 'council' }" 
          @click="switchMode('council')"
        >
          🐉 三教九流会谈
        </view>
      </view>
    </view>

    <!-- 浮动卡片：生辰八字设置 -->
    <view class="birth-info-card" :class="{ collapsed: isBirthCardCollapsed }">
      <view class="card-header" @click="toggleBirthCard">
        <text class="card-title">📝 您的生辰配置 (提升算命精度)</text>
        <text class="collapse-icon">{{ isBirthCardCollapsed ? '展开 ➕' : '收起 ➖' }}</text>
      </view>
      <view class="card-body" v-if="!isBirthCardCollapsed">
        <view class="form-row">
          <view class="form-item">
            <text class="label">公历生日</text>
            <picker mode="date" :value="birthInfo.solarDate" @change="onDateChange">
              <view class="picker-val">{{ birthInfo.solarDate || '点击选择日期' }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="label">出生时辰</text>
            <picker mode="selector" :range="hourRange" @change="onHourChange">
              <view class="picker-val">{{ birthInfo.birthTime ? birthInfo.birthTime + '点' : '点击选择时间' }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="label">性别</text>
            <view class="gender-btn-group">
              <view 
                class="gender-btn" 
                :class="{ active: gender === 'male' }" 
                @click="setGender('male')"
              >男</view>
              <view 
                class="gender-btn" 
                :class="{ active: gender === 'female' }" 
                @click="setGender('female')"
              >女</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 聊天内容区 -->
    <scroll-view 
      class="message-list" 
      scroll-y 
      :scroll-top="scrollTop" 
      :scroll-with-animation="true"
    >
      <view class="msg-padding-top"></view>
      <view 
        v-for="(msg, idx) in messages" 
        :key="idx" 
        class="message-item" 
        :class="msg.role"
      >
        <!-- 头像 -->
        <view class="avatar-box">
          <text class="avatar-emoji">{{ msg.avatar || '👤' }}</text>
        </view>
        
        <!-- 气泡 -->
        <view class="bubble-box">
          <text class="agent-name-tag" v-if="msg.agentName">{{ msg.agentName }}</text>
          <view class="bubble-content">
            <rich-text :nodes="formatMarkdown(msg.content)"></rich-text>
          </view>
        </view>
      </view>

      <!-- 大师正在推演的等待动效 -->
      <view class="loading-indicator" v-if="loading">
        <view class="loading-dots">
          <view class="dot"></view>
          <view class="dot"></view>
          <view class="dot"></view>
        </view>
        <text class="loading-text">{{ loadingText }}</text>
      </view>
      <view class="msg-padding-bottom"></view>
    </scroll-view>

    <!-- 底部输入区 -->
    <view class="chat-input-area">
      <!-- 模式选项：流式输出 vs 稳定模式 -->
      <view class="stream-toggle-bar">
        <view 
          class="toggle-item" 
          :class="{ active: useStream }" 
          @click="useStream = true"
        >
          ⚡ 流式输出 (极速)
        </view>
        <view 
          class="toggle-item" 
          :class="{ active: !useStream }" 
          @click="useStream = false"
        >
          🛡️ 稳定模式 (单次)
        </view>
      </view>

      <view class="chat-input-bar">
        <textarea 
          class="input-textarea" 
          v-model="inputMsg" 
          placeholder="向大师提问关于事业、婚姻、财运的门路..." 
          :auto-height="true"
          :maxlength="200"
          @confirm="sendMessage"
        />
        <button 
          class="send-btn" 
          @click="sendMessage" 
          :disabled="!inputMsg.trim() || loading"
        >
          发送
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, computed } from 'vue'
import { useUserStore } from '@/store/user'
import { useThemeStore } from '@/store/theme'
import { BASE_URL } from '@/api/request'

const userStore = useUserStore()
const themeStore = useThemeStore()

// 计算全局主题类名
const themeClass = computed(() => `theme-${themeStore.currentTheme}`)

const chatMode = ref('private') // 'private' 1对1, 'council' 圆桌
const inputMsg = ref('')
const messages = ref([])
const loading = ref(false)
const loadingText = ref('大师正在推演天机...')
const scrollTop = ref(0)
const isBirthCardCollapsed = ref(false)

const gender = ref('male')
const birthInfo = reactive({
  solarDate: '1998-06-18',
  birthTime: '12'
})

const hourRange = Array.from({ length: 24 }, (_, i) => `${i}`)

// 健壮的 UTF-8 字节流解码器，处理切片截断与多字节字符（如中文、Emoji）
class Utf8Decoder {
  constructor() {
    this.leftoverBytes = []
  }

  decode(uint8Array) {
    const bytes = [...this.leftoverBytes, ...uint8Array]
    this.leftoverBytes = []
    
    let i = 0
    const len = bytes.length
    let out = ""

    while (i < len) {
      const c = bytes[i]
      let charLen = 1

      if (c >= 0x00 && c <= 0x7F) {
        charLen = 1
      } else if ((c & 0xE0) === 0xC0) {
        charLen = 2
      } else if ((c & 0xF0) === 0xE0) {
        charLen = 3
      } else if ((c & 0xF8) === 0xF0) {
        charLen = 4
      } else {
        i++
        continue
      }

      if (i + charLen > len) {
        this.leftoverBytes = bytes.slice(i)
        break
      }

      if (charLen === 1) {
        out += String.fromCharCode(c)
      } else if (charLen === 2) {
        out += String.fromCharCode(((c & 0x1F) << 6) | (bytes[i + 1] & 0x3F))
      } else if (charLen === 3) {
        out += String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F))
      } else if (charLen === 4) {
        const c2 = bytes[i + 1]
        const c3 = bytes[i + 2]
        const c4 = bytes[i + 3]
        let codepoint = (((c & 0x07) << 18) | ((c2 & 0x3F) << 12) | ((c3 & 0x3F) << 6) | (c4 & 0x3F)) - 0x10000
        out += String.fromCharCode(0xD800 + (codepoint >> 10), 0xDC00 + (codepoint & 0x3FF))
      }
      i += charLen
    }
    return out
  }
}

const useStream = ref(true) // 是否开启流式输出，默认开启

// 初始问候语
const initWelcome = () => {
  messages.value = [
    {
      role: 'assistant',
      content: '施主，老夫在此守候多时。凡人一生，皆有定数，亦有变数。请在上方输入你的生辰八字，然后点击告诉我你的疑惑，老夫将为你拨云见日。',
      avatar: '🔮'
    }
  ]
}

onMounted(() => {
  initWelcome()
})

const switchMode = (mode) => {
  if (chatMode.value === mode) return
  chatMode.value = mode
  messages.value = []
  if (mode === 'private') {
    initWelcome()
  } else {
    messages.value = [
      {
        role: 'assistant',
        content: '欢迎来到【三教九流命理圆桌会谈】。\n在这里，东方命理妙空大师、西方占星师塞蕾娜以及心理咨询专家德叔将共同会诊施主的命运，并提供最终的命运综合报告。',
        avatar: '🐉'
      }
    ]
  }
}

const toggleBirthCard = () => {
  isBirthCardCollapsed.value = !isBirthCardCollapsed.value
}

const onDateChange = (e) => {
  birthInfo.solarDate = e.detail.value
}

const onHourChange = (e) => {
  birthInfo.birthTime = hourRange[e.detail.value]
}

const setGender = (val) => {
  gender.value = val
}

const getAgentAvatar = (agentName) => {
  if (!agentName) return '📜'
  if (agentName.includes('妙空')) return '🧘'
  if (agentName.includes('塞蕾娜')) return '✨'
  if (agentName.includes('德叔')) return '☕'
  return '📜'
}

// 模拟简易 Markdown 转 HTML
const formatMarkdown = (text) => {
  if (!text) return ''
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
    .replace(/^- (.*?)/gm, '<li>$1</li>')
    .replace(/### (.*?)/g, '<h4>$1</h4>')
    .replace(/## (.*?)/g, '<h3>$1</h3>')
  return html
}

const scrollToBottom = () => {
  nextTick(() => {
    scrollTop.value = scrollTop.value > 100000 ? scrollTop.value + 1 : 100000
  })
}

// 核心：发送消息
const sendMessage = async () => {
  if (!inputMsg.value.trim() || loading.value) return

  // 1. 如果未登录，强制进行静默登录获取 Token，保证后端 Mongoose 能够正确存库
  if (!userStore.isLoggedIn) {
    uni.showLoading({ title: '大天机推演中，正在准备登录...' })
    try {
      const loginRes = await userStore.login()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '登录失败')
      }
    } catch (e) {
      uni.showToast({ title: '快捷登录失败，将以游客身份提问', icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  }

  const userQuery = inputMsg.value.trim()
  inputMsg.value = ''
  
  // 收起生辰设置卡片
  isBirthCardCollapsed.value = true

  // 用户发言加入气泡
  messages.value.push({
    role: 'user',
    content: userQuery,
    avatar: gender.value === 'female' ? '👩' : '👨'
  })
  
  loading.value = true
  loadingText.value = chatMode.value === 'private' ? '大师正在推演天机...' : '三位大师正在展开研讨...'
  scrollToBottom()

  // 构建历史记录
  const apiHistory = messages.value
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map(m => ({
      role: m.role,
      content: m.content
    }))

  const requestUrl = chatMode.value === 'private' 
    ? `${BASE_URL}/api/fortune/ai-chat` 
    : `${BASE_URL}/api/fortune/council`

  // 获取 Bearer 认证 Token
  const token = uni.getStorageSync('user_token') || ''
  const headers = {
    'content-type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let isWechat = false
  // #ifdef MP-WECHAT
  isWechat = true
  // #endif

  // 如果选择非流式稳定模式，或者不是微信平台，都走稳定网络路径 (普通 POST 请求)
  if (!useStream.value || !isWechat) {
    console.log('[AI Chat] Initiating stable non-stream request...')
    uni.request({
      url: requestUrl,
      method: 'POST',
      data: {
        messages: apiHistory,
        birthInfo: {
          solarDate: birthInfo.solarDate,
          birthTime: birthInfo.birthTime
        },
        gender: gender.value,
        stream: false
      },
      header: headers,
      timeout: 60000,
      success: (res) => {
        console.log('[AI Chat] Stable request success:', res.statusCode)
        loading.value = false
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          if (chatMode.value === 'private') {
            const replyContent = res.data.data?.content || ''
            messages.value.push({
              role: 'assistant',
              content: replyContent,
              avatar: '🔮'
            })
          } else {
            const opinions = res.data.data?.opinions || []
            opinions.forEach(op => {
              messages.value.push({
                role: 'assistant',
                agentName: op.agent,
                content: op.content,
                avatar: getAgentAvatar(op.agent)
              })
            })
          }
          scrollToBottom()
        } else {
          uni.showModal({
            title: '推演天机失败',
            content: `服务器错误码: ${res.statusCode}\n信息: ${JSON.stringify(res.data)}`,
            showCancel: false
          })
        }
      },
      fail: (err) => {
        console.error('[AI Chat] Stable request failed:', err)
        loading.value = false
        uni.showModal({
          title: '推演天机失败',
          content: `请检查网络是否畅通。\n错误原因: ${err.errMsg || JSON.stringify(err)}`,
          showCancel: false
        })
      },
      complete: () => {
        loading.value = false
        scrollToBottom()
      }
    })
    return
  }

  // #ifdef MP-WECHAT
  // 流式输出模式 (使用原生微信请求以获得更可靠的 SSE chunked 流接收能力)
  let activeAgentMsg = null
  let isFirstChunk = true
  const decoder = new Utf8Decoder()
  let leftover = ''
  let receivedAnyChunk = false

  const requestTask = wx.request({
    url: requestUrl,
    method: 'POST',
    responseType: 'arraybuffer', // 强制指定 ArrayBuffer 类型
    timeout: 60000, // 增加超时时间到 60 秒
    data: {
      messages: apiHistory,
      birthInfo: {
        solarDate: birthInfo.solarDate,
        birthTime: birthInfo.birthTime
      },
      gender: gender.value,
      stream: true
    },
    enableChunked: true,
    header: headers,
    success: (res) => {
      console.log('Native SSE Stream Request Success, Status Code:', res.statusCode)
      loading.value = false
      
      if (res.statusCode === 200) {
        // 兜底逻辑：如果 onChunkReceived 没有被触发过
        if (!receivedAnyChunk) {
          console.log('[AI Chat Fallback] Chunked mode failed or ignored. Decoding full payload...')
          let fullText = ''
          try {
            const uint8 = new Uint8Array(res.data)
            fullText = decoder.decode(uint8)
          } catch (e) {
            console.error('Failed to decode full response:', e)
          }

          if (fullText) {
            const lines = fullText.split('\n')
            let compiledContent = ''
            
            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const dataVal = line.replace('data: ', '').trim()
                if (dataVal === '[DONE]') continue
                try {
                  const parsed = JSON.parse(dataVal)
                  if (parsed.agent) {
                    if (parsed.content) {
                      compiledContent += parsed.content
                    }
                  } else if (parsed.content) {
                    compiledContent += parsed.content
                  }
                } catch (e) {
                  // 忽略截断
                }
              }
            }

            if (compiledContent) {
              messages.value.push({
                role: 'assistant',
                content: compiledContent,
                avatar: chatMode.value === 'private' ? '🔮' : '🐉'
              })
              scrollToBottom()
            }
          }
        }
      } else {
        let errBody = ''
        try {
          const uint8 = new Uint8Array(res.data)
          errBody = decoder.decode(uint8)
        } catch (e) {
          errBody = JSON.stringify(res.data)
        }
        
        uni.showModal({
          title: '大师推演错误',
          content: `服务器状态码: ${res.statusCode}\n详细信息: ${errBody}`,
          showCancel: false
        })
      }
    },
    fail: (err) => {
      console.error('Native SSE Stream Request Failed:', err)
      loading.value = false
      uni.showModal({
        title: '推演天机失败',
        content: `请检查网络是否畅通或接口是否开启。\n错误原因: ${err.errMsg || JSON.stringify(err)}`,
        showCancel: false
      })
    },
    complete: () => {
      loading.value = false
      scrollToBottom()
    }
  })

  // 监听 Chunk 数据并实时解码渲染
  requestTask.onChunkReceived((res) => {
    receivedAnyChunk = true
    loading.value = false
    const buffer = res.data
    const uint8Array = new Uint8Array(buffer)
    
    // 使用纯 JS 的 Utf8Decoder 解码字节流，保障分片边界绝不出现乱码
    const chunkStr = decoder.decode(uint8Array)
    if (!chunkStr) return

    // 拼接前一次遗留的残包
    const dataToProcess = leftover + chunkStr
    leftover = ''

    // 按行切分 chunk 处理
    const lines = dataToProcess.split('\n')
    
    // 如果 chunk 没有以换行符结束，说明末尾行残缺，暂存到 leftover 待下次拼接
    if (!chunkStr.endsWith('\n')) {
      leftover = lines.pop() || ''
    } else {
      lines.pop()
    }

    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        const dataVal = line.replace('data: ', '').trim()
        if (dataVal === '[DONE]') {
          activeAgentMsg = null
          break
        }
        try {
          const parsed = JSON.parse(dataVal)
          
          if (parsed.agent) {
            // --- 多智能体圆桌会谈流模式 ---
            if (parsed.event === 'start') {
              activeAgentMsg = {
                role: 'assistant',
                agentName: parsed.agent,
                content: '',
                avatar: getAgentAvatar(parsed.agent)
              }
              messages.value.push(activeAgentMsg)
            } else if (parsed.event === 'end') {
              activeAgentMsg = null
            } else if (parsed.content) {
              if (activeAgentMsg) {
                activeAgentMsg.content += parsed.content
              } else {
                activeAgentMsg = {
                  role: 'assistant',
                  agentName: parsed.agent,
                  content: parsed.content,
                  avatar: getAgentAvatar(parsed.agent)
                }
                messages.value.push(activeAgentMsg)
              }
            }
          } else if (parsed.content) {
            // --- 1对1私聊模式 ---
            if (isFirstChunk) {
              messages.value.push({
                role: 'assistant',
                content: parsed.content,
                avatar: '🔮'
              })
              isFirstChunk = false
            } else {
              const lastMsg = messages.value[messages.value.length - 1]
              if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content += parsed.content
              }
            }
          }
          scrollToBottom()
        } catch (e) {
          // JSON 截断忽略，等待下个 chunk 拼全
        }
      }
    }
  })
  // #endif
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-color, #faf8f2);
  color: var(--text-color, #1a0f0a);
  font-family: var(--font-family-body, -apple-system, sans-serif);
}

/* 头部样式 */
.chat-header {
  display: flex;
  align-items: center;
  padding: 88rpx 30rpx 20rpx 30rpx;
  background-color: var(--bg-secondary, #f3edd8);
  border-bottom: 1px solid var(--border-color, #e6d4b6);
}
.nav-back {
  font-size: 38rpx;
  color: var(--primary-color, #b81d22);
  padding-right: 30rpx;
}
.mode-selector {
  flex: 1;
  display: flex;
  background-color: var(--bg-color, #faf8f2);
  border-radius: 40rpx;
  padding: 6rpx;
  border: 1px solid var(--border-color, #e6d4b6);
}
.mode-tab {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  padding: 12rpx 0;
  color: var(--text-secondary, #4a3830);
  border-radius: 35rpx;
  transition: all 0.3s;
}
.mode-tab.active {
  background-color: var(--primary-color, #b81d22);
  color: var(--card-bg, #ffffff);
  font-weight: bold;
}

/* 生辰卡片样式 */
.birth-info-card {
  background-color: var(--card-bg, #ffffff);
  margin: 20rpx;
  border-radius: var(--border-radius-md, 12rpx);
  border: 1px solid var(--border-color, #e6d4b6);
  box-shadow: 0 4rpx 16rpx var(--card-shadow, rgba(0, 0, 0, 0.02));
  overflow: hidden;
  transition: all 0.3s ease-in-out;
}
.card-header {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background-color: var(--bg-secondary, #f3edd8);
  align-items: center;
}
.card-title {
  font-size: 24rpx;
  color: var(--primary-color, #b81d22);
  font-weight: bold;
}
.collapse-icon {
  font-size: 22rpx;
  color: var(--text-secondary, #4a3830);
}
.card-body {
  padding: 24rpx 30rpx;
}
.form-row {
  display: flex;
  justify-content: space-between;
}
.form-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-right: 15rpx;
}
.form-item:last-child {
  margin-right: 0;
}
.form-item .label {
  font-size: 20rpx;
  color: var(--text-light, #7c685f);
  margin-bottom: 8rpx;
}
.picker-val {
  background-color: var(--bg-color, #faf8f2);
  padding: 12rpx;
  border-radius: var(--border-radius-sm, 8rpx);
  font-size: 22rpx;
  text-align: center;
  border: 1px solid var(--border-color, #e6d4b6);
  color: var(--text-color, #1a0f0a);
}
.gender-btn-group {
  display: flex;
  background-color: var(--bg-color, #faf8f2);
  border-radius: var(--border-radius-sm, 8rpx);
  padding: 2rpx;
  border: 1px solid var(--border-color, #e6d4b6);
}
.gender-btn {
  flex: 1;
  font-size: 22rpx;
  padding: 10rpx 0;
  text-align: center;
  color: var(--text-secondary, #4a3830);
  border-radius: 6rpx;
}
.gender-btn.active {
  background-color: var(--primary-color, #b81d22);
  color: var(--card-bg, #ffffff);
  font-weight: bold;
}

/* 消息列表 */
.message-list {
  flex: 1;
  overflow: hidden;
}
.msg-padding-top {
  height: 20rpx;
}
.msg-padding-bottom {
  height: 40rpx;
}
.message-item {
  display: flex;
  padding: 20rpx;
  margin-bottom: 20rpx;
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

.message-item.user {
  flex-direction: row-reverse;
}
.avatar-box {
  width: 76rpx;
  height: 76rpx;
  background-color: var(--bg-secondary, #f3edd8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color, #e6d4b6);
  margin: 0 16rpx;
}
.avatar-emoji {
  font-size: 38rpx;
}
.bubble-box {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}
.message-item.user .bubble-box {
  align-items: flex-end;
}
.agent-name-tag {
  font-size: 20rpx;
  color: var(--primary-color, #b81d22);
  margin-bottom: 6rpx;
  background-color: var(--bg-secondary, #f3edd8);
  border: 1px solid var(--border-color, #e6d4b6);
  padding: 2rpx 10rpx;
  border-radius: var(--border-radius-sm, 8rpx);
  width: fit-content;
}
.bubble-content {
  background-color: var(--card-bg, #ffffff);
  padding: 24rpx;
  border-radius: 4px var(--border-radius-md, 12rpx) var(--border-radius-md, 12rpx) var(--border-radius-md, 12rpx);
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--text-color, #1a0f0a);
  word-break: break-all;
  border: 1px solid var(--border-color, #e6d4b6);
  box-shadow: 0 4rpx 12rpx var(--card-shadow, rgba(0, 0, 0, 0.01));
}
.message-item.user .bubble-content {
  background-color: var(--primary-color, #b81d22);
  color: var(--card-bg, #ffffff);
  border-radius: var(--border-radius-md, 12rpx) 4px var(--border-radius-md, 12rpx) var(--border-radius-md, 12rpx);
  font-weight: 500;
  border: 1px solid var(--primary-dark, #800e13);
}

/* 等待动效 */
.loading-indicator {
  display: flex;
  align-items: center;
  padding: 20rpx 40rpx;
}
.loading-dots {
  display: flex;
  margin-right: 15rpx;
}
.dot {
  width: 12rpx;
  height: 12rpx;
  background-color: var(--primary-color, #b81d22);
  border-radius: 50%;
  margin-right: 8rpx;
  animation: bounce 1.4s infinite ease-in-out both;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1.0); }
}
.loading-text {
  font-size: 22rpx;
  color: var(--text-secondary, #4a3830);
}

/* 底部输入区 */
.chat-input-area {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary, #f3edd8);
  border-top: 1px solid var(--border-color, #e6d4b6);
}
.stream-toggle-bar {
  display: flex;
  justify-content: center;
  padding: 10rpx 30rpx 0 30rpx;
  gap: 30rpx;
}
.toggle-item {
  font-size: 20rpx;
  color: var(--text-light, #7c685f);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background-color: rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}
.toggle-item.active {
  color: var(--primary-color, #b81d22);
  background-color: var(--card-bg, #ffffff);
  font-weight: bold;
  box-shadow: 0 2rpx 8rpx var(--card-shadow, rgba(0, 0, 0, 0.05));
}
.chat-input-bar {
  display: flex;
  align-items: flex-end;
  padding: 15rpx 30rpx 50rpx 30rpx;
}
.input-textarea {
  flex: 1;
  background-color: var(--card-bg, #ffffff);
  border-radius: var(--border-radius-sm, 8rpx);
  padding: 20rpx;
  font-size: 28rpx;
  color: var(--text-color, #1a0f0a);
  min-height: 40rpx;
  max-height: 160rpx;
  border: 1px solid var(--border-color, #e6d4b6);
}
.send-btn {
  background-color: var(--primary-color, #b81d22);
  color: var(--card-bg, #ffffff);
  font-size: 26rpx;
  font-weight: bold;
  padding: 10rpx 30rpx;
  border-radius: var(--border-radius-sm, 8rpx);
  margin-left: 20rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.send-btn[disabled] {
  background-color: var(--bg-color, #faf8f2);
  color: var(--text-light, #7c685f);
  border: 1px solid var(--border-color, #e6d4b6);
}

/* 隐藏小程序默认滚动条 track */
::-webkit-scrollbar {
  display: none;
  width: 0 !important;
  height: 0 !important;
  -webkit-appearance: none;
  background: transparent;
}
</style>
