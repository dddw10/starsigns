<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">面相手相</text>
      <text class="subtitle">AI智能识别，趣味分析</text>
    </view>

    <view class="upload-section">
      <view class="upload-area" @click="chooseImage">
        <image v-if="imageSrc" :src="imageSrc" mode="aspectFit" class="preview-image"></image>
        <view v-else class="upload-placeholder">
          <text class="upload-icon">📷</text>
          <text class="upload-text">点击上传照片</text>
          <text class="upload-hint">支持面相或手相照片</text>
        </view>
        <!-- 实时 AI 视觉特征锚点扫描画布 -->
        <canvas 
          canvas-id="scanOverlayCanvas" 
          id="scanOverlayCanvas" 
          class="scan-overlay-canvas" 
          :style="{ opacity: (loading && imageSrc) ? 1 : 0 }"
        ></canvas>
        <!-- 金色激光扫描线 -->
        <view class="scanner-overlay" v-if="loading && imageSrc">
          <view class="scanner-line"></view>
          <text class="scanner-text">{{ activeScanText }}</text>
        </view>
      </view>
    </view>

    <view class="type-selector">
      <view class="type-item" :class="{ active: analysisType === 'face' }" @click="setAnalysisType('face')">
        <text class="type-icon">👤</text>
        <text class="type-name">面相分析</text>
      </view>
      <view class="type-item" :class="{ active: analysisType === 'palm' }" @click="setAnalysisType('palm')">
        <text class="type-icon">✋</text>
        <text class="type-name">手相分析</text>
      </view>
    </view>

    <button class="submit-btn" @click="analyze" :disabled="!imageSrc || loading">
      {{ loading ? '分析中...' : '开始分析' }}
    </button>

    <view class="result-section" v-if="result">
      <text class="section-title">AI分析结果</text>
      
      <view class="analysis-card">
        <text class="card-title">{{ result.featureTitle }}</text>
        <text class="analysis-text">{{ result.features }}</text>
      </view>

      <view class="analysis-card">
        <text class="card-title">运势解读</text>
        <text class="analysis-text">{{ result.fortune }}</text>
      </view>

      <view class="analysis-card">
        <text class="card-title">性格分析</text>
        <text class="analysis-text">{{ result.personality }}</text>
      </view>

      <button class="action-btn" @click="share">分享结果</button>
    </view>

    <view class="disclaimer">
      <text>本结果仅供娱乐参考，不构成任何决策建议</text>
      <text class="privacy">上传的照片仅用于分析，不会保存或分享</text>
    </view>

    <canvas id="detectCanvas" canvas-id="detectCanvas" class="detect-canvas"></canvas>
  </view>
</template>

<script setup>
import { getCurrentInstance, ref, nextTick } from 'vue'
import { facePalmAnalysisApi } from '@/api/fortune'
import { useUserStore } from '@/store/user'

const imageSrc = ref('')
const analysisType = ref('face')
const result = ref(null)
const loading = ref(false)
const instance = getCurrentInstance()
const CANVAS_ID = 'detectCanvas'
const DETECT_SIZE = 160
const userStore = useUserStore()

// AI 扫描动效相关变量
const scanTimer = ref(null)
const scanProgress = ref(0)
const canvasWidth = ref(300)
const canvasHeight = ref(300)
const activeScanText = ref('AI 正在初始化...')

const facePoints = [
  // Forehead
  { x: 0.5, y: 0.20, label: '天庭' },
  { x: 0.4, y: 0.22 },
  { x: 0.6, y: 0.22 },
  // Left eye
  { x: 0.35, y: 0.38, label: '精舍' },
  { x: 0.42, y: 0.38 },
  { x: 0.385, y: 0.35 },
  { x: 0.385, y: 0.41 },
  // Right eye
  { x: 0.58, y: 0.38, label: '精舍' },
  { x: 0.65, y: 0.38 },
  { x: 0.615, y: 0.35 },
  { x: 0.615, y: 0.41 },
  // Nose
  { x: 0.5, y: 0.32, label: '山根' },
  { x: 0.5, y: 0.45, label: '年寿' },
  { x: 0.5, y: 0.54, label: '准头' },
  { x: 0.45, y: 0.55, label: '兰台' },
  { x: 0.55, y: 0.55, label: '廷尉' },
  // Mouth
  { x: 0.43, y: 0.68, label: '海角' },
  { x: 0.57, y: 0.68, label: '海角' },
  { x: 0.5, y: 0.65, label: '人中' },
  { x: 0.5, y: 0.72, label: '承浆' },
  // Jaw/Chin
  { x: 0.28, y: 0.42 },
  { x: 0.30, y: 0.60, label: '腮骨' },
  { x: 0.38, y: 0.78 },
  { x: 0.5, y: 0.84, label: '地阁' },
  { x: 0.62, y: 0.78 },
  { x: 0.70, y: 0.60, label: '腮骨' },
  { x: 0.72, y: 0.42 }
]

const startScanAnimation = async () => {
  await nextTick()
  // 微信/uni-app中通过 SelectorQuery 获取 canvas 宽高
  const query = uni.createSelectorQuery().in(instance?.proxy)
  query.select('#scanOverlayCanvas').boundingClientRect((rect) => {
    if (rect) {
      canvasWidth.value = rect.width
      canvasHeight.value = rect.height
    } else {
      canvasWidth.value = 300
      canvasHeight.value = 300
    }
    scanProgress.value = 0
    activeScanText.value = 'AI 正在初始化...'
    runScanFrame()
  }).exec()
}

const stopScanAnimation = () => {
  if (scanTimer.value) {
    clearTimeout(scanTimer.value)
    scanTimer.value = null
  }
}

const runScanFrame = () => {
  if (!loading.value) return

  const ctx = uni.createCanvasContext('scanOverlayCanvas', instance?.proxy)
  const W = canvasWidth.value
  const H = canvasHeight.value

  // 清除画布
  ctx.clearRect(0, 0, W, H)

  // 进度递增
  scanProgress.value += 1.2
  if (scanProgress.value > 100) {
    scanProgress.value = 100 // 保持在 100 阶段持续呼吸闪烁
  }

  const p = scanProgress.value

  if (analysisType.value === 'face') {
    drawFaceScan(ctx, W, H, p)
  } else {
    drawPalmScan(ctx, W, H, p)
  }

  ctx.draw()
  scanTimer.value = setTimeout(runScanFrame, 30)
}

const drawFaceScan = (ctx, W, H, p) => {
  // 绘制太极八卦外圆辅助线
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.45, 0, 2 * Math.PI)
  ctx.strokeStyle = 'rgba(229, 193, 88, 0.15)'
  ctx.setLineDash([4, 4])
  ctx.stroke()
  ctx.setLineDash([])

  // 转换相对坐标为绝对像素
  const points = facePoints.map(pt => ({
    x: pt.x * W,
    y: pt.y * H,
    label: pt.label
  }))

  const drawPointLimit = Math.min(points.length, Math.floor((p / 100) * points.length * 1.2))

  // 更新进度提示文字
  if (p < 25) {
    activeScanText.value = '正在定位天庭、双目部位...'
  } else if (p < 50) {
    activeScanText.value = '正在扫描山根、鼻相结构...'
  } else if (p < 75) {
    activeScanText.value = '正在提取人中、口唇比例...'
  } else if (p < 90) {
    activeScanText.value = '正在分析地阁与腮骨轮廓...'
  } else {
    activeScanText.value = 'AI 正在融合生肖五行，测算运势中...'
  }

  // 连线定义
  const connections = [
    // 眼睛
    [3, 5], [5, 4], [4, 6], [6, 3],
    [7, 9], [9, 8], [8, 10], [10, 7],
    // 额头与眼鼻
    [1, 3], [2, 8], [0, 1], [0, 2], [0, 11],
    // 鼻梁与两侧
    [11, 12], [12, 13], [13, 14], [13, 15], [12, 3], [12, 8],
    // 嘴唇
    [16, 18], [18, 17], [17, 19], [19, 16],
    // 鼻子与嘴
    [13, 18], [14, 16], [15, 17],
    // 下颌骨
    [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 26],
    // 骨骼与五官
    [20, 3], [26, 8], [21, 16], [25, 17], [23, 19]
  ]

  // 绘制网格连线
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(229, 193, 88, 0.4)'
  connections.forEach(([i, j]) => {
    if (i < drawPointLimit && j < drawPointLimit) {
      ctx.beginPath()
      ctx.moveTo(points[i].x, points[i].y)
      ctx.lineTo(points[j].x, points[j].y)
      ctx.stroke()
    }
  })

  // 绘制金色五行特征锚点
  for (let i = 0; i < drawPointLimit; i++) {
    const pt = points[i]
    const pulse = Math.abs(Math.sin((Date.now() / 200) + i)) * 3 + 2

    // 金色外发光圈
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, pulse + 3, 0, 2 * Math.PI)
    ctx.fillStyle = 'rgba(229, 193, 88, 0.25)'
    ctx.fill()

    // 实体锚点
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI)
    ctx.fillStyle = '#e5c158'
    ctx.fill()

    // 绘制特征标签，增加玄学高科技质感
    if (pt.label && i % 3 === 0) {
      ctx.fillStyle = 'rgba(229, 193, 88, 0.9)'
      ctx.setFontSize(10)
      ctx.fillText(pt.label, pt.x + 8, pt.y + 4)
    }
  }
}

const drawPalmScan = (ctx, W, H, p) => {
  // 绘制太极八卦外圆辅助线
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.42, 0, 2 * Math.PI)
  ctx.strokeStyle = 'rgba(229, 193, 88, 0.12)'
  ctx.stroke()

  const lines = [
    {
      name: '生命线',
      p0: { x: 0.35, y: 0.3 },
      p1: { x: 0.35, y: 0.72 },
      p2: { x: 0.58, y: 0.85 },
      progressRange: [0, 33],
      color: 'rgba(229, 193, 88, 0.85)'
    },
    {
      name: '智慧线',
      p0: { x: 0.35, y: 0.32 },
      p1: { x: 0.55, y: 0.5 },
      p2: { x: 0.75, y: 0.65 },
      progressRange: [33, 66],
      color: 'rgba(229, 193, 88, 0.85)'
    },
    {
      name: '感情线',
      p0: { x: 0.78, y: 0.38 },
      p1: { x: 0.55, y: 0.32 },
      p2: { x: 0.28, y: 0.42 },
      progressRange: [66, 100],
      color: 'rgba(229, 193, 88, 0.85)'
    }
  ]

  if (p < 33) {
    activeScanText.value = '正在提取掌纹生命线...'
  } else if (p < 66) {
    activeScanText.value = '正在进行智慧线轨迹拟合...'
  } else if (p < 90) {
    activeScanText.value = '正在勾勒感情线走向...'
  } else {
    activeScanText.value = 'AI 正在解析掌丘五行，测算运势中...'
  }

  lines.forEach((line) => {
    const [startP, endP] = line.progressRange
    let tMax = 0
    if (p >= endP) {
      tMax = 1
    } else if (p <= startP) {
      tMax = 0
    } else {
      tMax = (p - startP) / (endP - startP)
    }

    if (tMax > 0) {
      const p0 = { x: line.p0.x * W, y: line.p0.y * H }
      const p1 = { x: line.p1.x * W, y: line.p1.y * H }
      const p2 = { x: line.p2.x * W, y: line.p2.y * H }

      // 绘制贝塞尔曲线
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      const steps = 30
      const currentSteps = Math.max(1, Math.floor(steps * tMax))
      for (let i = 1; i <= currentSteps; i++) {
        const t = (i / currentSteps) * tMax
        const pt = getQuadraticBezierPoint(t, p0, p1, p2)
        ctx.lineTo(pt.x, pt.y)
      }

      ctx.lineWidth = 3
      ctx.strokeStyle = line.color
      ctx.stroke()

      // 绘制笔尖光点
      const headPt = getQuadraticBezierPoint(tMax, p0, p1, p2)
      const pulse = Math.abs(Math.sin(Date.now() / 150)) * 6 + 4
      
      ctx.beginPath()
      ctx.arc(headPt.x, headPt.y, pulse, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(229, 193, 88, 0.3)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(headPt.x, headPt.y, 4, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      // 绘制掌纹名称
      if (tMax > 0.3) {
        const midT = tMax / 2
        const midPt = getQuadraticBezierPoint(midT, p0, p1, p2)
        ctx.fillStyle = '#e5c158'
        ctx.setFontSize(10)
        ctx.fillText(line.name, midPt.x + 8, midPt.y - 8)
      }
    }
  })
}

const getQuadraticBezierPoint = (t, p0, p1, p2) => {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y
  return { x, y }
}

const setAnalysisType = (type) => {
  if (analysisType.value === type) return
  analysisType.value = type
  result.value = null
}

const chooseImage = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      imageSrc.value = res.tempFilePaths[0]
      result.value = null
    }
  })
}

const getBase64Image = (filePath) => {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WECHAT
    uni.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: reject
    })
    // #endif
    // #ifndef MP-WECHAT
    if (typeof window !== 'undefined' && typeof window.FileReader !== 'undefined') {
      fetch(filePath)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64 = reader.result
            const rawBase64 = base64.split(',')[1]
            resolve(rawBase64)
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        .catch(reject)
    } else {
      resolve('') // 其他非浏览器非微信环境兜底
    }
    // #endif
  })
}

const analyze = async () => {
  loading.value = true
  result.value = null
  startScanAnimation()

  try {
    let isValid = false
    try {
      isValid = await validateImageContent(imageSrc.value, analysisType.value)
    } catch (e) {
      console.warn('图像前端预校验出错，跳过校验直接分析:', e.message)
      isValid = true
    }

    if (!isValid) {
      uni.showToast({
        title: '请确保照片清晰且光线均匀',
        icon: 'none'
      })
      // 仅做温和提示，不完全阻断用户操作，交由后端多模态大模型智能分析
    }

    // 运行扫描动效持续至少 2.5 秒，增强体验感
    const statsPromise = getImageStats(imageSrc.value).catch(err => {
      console.warn('获取图像像素指标失败，采用兜底指标:', err.message)
      return { skinRatio: 0.25, edgeAverage: 6.0, brightRatio: 0.15 }
    })
    const delayPromise = wait(2500)
    
    const [imageStats] = await Promise.all([statsPromise, delayPromise])
    
    // 如果未登录，提示自动登录
    if (!userStore.isLoggedIn) {
      uni.showLoading({ title: '登录中...' })
      const loginRes = await userStore.login()
      uni.hideLoading()
      if (!loginRes.success) {
        throw new Error(loginRes.message || '快捷登录失败')
      }
    }

    // 读取照片 Base64 数据
    let base64Data = ''
    try {
      base64Data = await getBase64Image(imageSrc.value)
    } catch (e) {
      console.warn('获取 Base64 图片数据失败，降级为模拟分析模式:', e.message)
    }

    const res = await facePalmAnalysisApi({
      type: analysisType.value,
      skinRatio: imageStats.skinRatio,
      edgeAverage: imageStats.edgeAverage,
      base64Image: base64Data
    })

    if (res.code === 0) {
      result.value = res.data
      uni.showToast({ title: '分析完成！', icon: 'success' })
      // 同步最新可用算命次数
      await userStore.fetchUserInfo()
    } else {
      uni.showToast({ title: res.message || '分析失败', icon: 'none' })
    }
  } catch (err) {
    uni.showToast({
      title: err.message || '识别失败，请重新上传照片试一试',
      icon: 'none'
    })
  } finally {
    loading.value = false
    stopScanAnimation()
  }
}

const share = () => {
  if (!result.value) return
  const query = {
    type: analysisType.value === 'face' ? 'face' : 'palm',
    title: result.value.featureTitle || (analysisType.value === 'face' ? 'AI面相精细剖析' : 'AI手相精细剖析'),
    name: '本命信士',
    score: 90,
    analysis: `${result.value.features}\n\n【运势解读】\n${result.value.fortune}\n\n【性格特质】\n${result.value.personality}`
  }
  uni.navigateTo({
    url: `/pages/share/index?type=${query.type}&title=${encodeURIComponent(query.title)}&name=${encodeURIComponent(query.name)}&score=${query.score}&analysis=${encodeURIComponent(query.analysis)}`
  })
}

const validateImageContent = async (filePath, type) => {
  const imageStats = await getImageStats(filePath)
  const faceResult = await detectFace(imageStats.imageData)

  if (type === 'face') {
    if (faceResult.supported) return faceResult.hasFace
    return isLikelySkinImage(imageStats)
  }

  if (faceResult.supported && faceResult.hasFace) return false

  return isLikelyPalmImage(imageStats)
}

const detectFace = (imageData) => {
  return new Promise((resolve) => {
    const wxApi = typeof wx !== 'undefined' ? wx : null
    if (!wxApi || typeof wxApi.faceDetect !== 'function') {
      resolve({ supported: false, hasFace: false })
      return
    }

    wxApi.faceDetect({
      frameBuffer: imageData.data.buffer,
      width: imageData.width,
      height: imageData.height,
      success: (res) => {
        const faceInfo = res.faceInfo || res.faceInfos || []
        const faceCount = Array.isArray(faceInfo) ? faceInfo.length : Number(!!faceInfo)
        resolve({ supported: true, hasFace: faceCount > 0 })
      },
      fail: () => {
        resolve({ supported: true, hasFace: false })
      }
    })
  })
}

const getImageStats = async (filePath) => {
  const imageInfo = await getImageInfo(filePath)
  await drawImageToCanvas(imageInfo.path)
  const imageData = await getCanvasImageData()

  let skinPixels = 0
  let brightPixels = 0
  let edgeScore = 0
  const { data, width, height } = imageData

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (isSkinPixel(r, g, b)) skinPixels++
    if ((r + g + b) / 3 > 170) brightPixels++
  }

  for (let y = 1; y < height; y += 2) {
    for (let x = 1; x < width; x += 2) {
      const idx = (y * width + x) * 4
      const leftIdx = (y * width + x - 1) * 4
      const topIdx = ((y - 1) * width + x) * 4
      const current = getLuma(data[idx], data[idx + 1], data[idx + 2])
      const left = getLuma(data[leftIdx], data[leftIdx + 1], data[leftIdx + 2])
      const top = getLuma(data[topIdx], data[topIdx + 1], data[topIdx + 2])
      edgeScore += Math.abs(current - left) + Math.abs(current - top)
    }
  }

  const pixelCount = width * height
  const sampledEdgeCount = Math.floor((width / 2) * (height / 2))

  return {
    skinRatio: skinPixels / pixelCount,
    brightRatio: brightPixels / pixelCount,
    edgeAverage: edgeScore / Math.max(sampledEdgeCount, 1),
    imageData
  }
}

const getImageInfo = (src) => {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({
      src,
      success: resolve,
      fail: reject
    })
  })
}

const drawImageToCanvas = (path) => {
  return new Promise((resolve, reject) => {
    const ctx = uni.createCanvasContext(CANVAS_ID, instance?.proxy)
    ctx.clearRect(0, 0, DETECT_SIZE, DETECT_SIZE)
    ctx.drawImage(path, 0, 0, DETECT_SIZE, DETECT_SIZE)
    ctx.draw(false, () => {
      setTimeout(resolve, 120)
    })

    setTimeout(() => reject(new Error('canvas draw timeout')), 2000)
  })
}

const getCanvasImageData = () => {
  return new Promise((resolve, reject) => {
    uni.canvasGetImageData({
      canvasId: CANVAS_ID,
      x: 0,
      y: 0,
      width: DETECT_SIZE,
      height: DETECT_SIZE,
      success: resolve,
      fail: reject
    }, instance?.proxy)
  })
}

const isSkinPixel = (r, g, b) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return r > 80 && g > 45 && b > 30 && r > g && r > b && max - min > 15 && Math.abs(r - g) > 8
}

const getLuma = (r, g, b) => {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

const isLikelySkinImage = (stats) => {
  return stats.skinRatio >= 0.12 && stats.brightRatio >= 0.08 && stats.edgeAverage >= 4
}

const isLikelyPalmImage = (stats) => {
  return stats.skinRatio >= 0.18 && stats.brightRatio >= 0.1 && stats.edgeAverage >= 5
}

const wait = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
</script>

<style scoped>
.page-container {
  padding: 30rpx;
  background: var(--bg-color, #f5f0e8);
  min-height: 100vh;
}

.header {
  margin-bottom: 30rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  display: block;
}

.subtitle {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  margin-top: 8rpx;
  display: block;
}

.upload-section {
  margin-bottom: 24rpx;
}

.upload-area {
  background: var(--card-bg, #fff);
  border-radius: 20rpx;
  overflow: hidden;
  aspect-ratio: 1;
  position: relative;
}

/* 激光扫描线动效 */
.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.scanner-line {
  position: absolute;
  width: 100%;
  height: 6rpx;
  background: linear-gradient(to right, transparent, #f1c40f, #f39c12, #f1c40f, transparent);
  box-shadow: 0 0 16rpx #f1c40f, 0 0 8rpx #f39c12;
  animation: scan 2s linear infinite;
  z-index: 11;
}

@keyframes scan {
  0% { top: 0%; }
  50% { top: 100%; }
  100% { top: 0%; }
}

.scanner-text {
  font-size: 26rpx;
  color: #f1c40f;
  font-weight: bold;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.8);
  animation: pulse 1.5s ease-in-out infinite;
  z-index: 12;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.scan-overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 11;
  pointer-events: none;
}

.preview-image {
  width: 100%;
  height: 100%;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.upload-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.upload-text {
  font-size: 30rpx;
  color: var(--text-primary, #333);
}

.upload-hint {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  margin-top: 8rpx;
}

.type-selector {
  display: flex;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.type-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx;
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  border: 2rpx solid transparent;
}

.type-item.active {
  border-color: var(--primary-color, #c41e3a);
  background: rgba(196, 30, 58, 0.05);
}

.type-icon {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.type-name {
  font-size: 28rpx;
  color: var(--text-primary, #333);
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  font-size: 32rpx;
  border-radius: 44rpx;
  margin-bottom: 30rpx;
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.result-section {
  background: var(--card-bg, #fff);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 20rpx;
  display: block;
}

.analysis-card {
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  margin-bottom: 12rpx;
  display: block;
}

.analysis-text {
  font-size: 26rpx;
  color: var(--text-primary, #333);
  line-height: 1.8;
}

.action-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: var(--primary-color, #c41e3a);
  color: #fff;
  border-radius: 40rpx;
  margin-top: 24rpx;
}

.disclaimer {
  text-align: center;
  padding: 20rpx;
  font-size: 22rpx;
  color: var(--text-secondary, #999);
}

.privacy {
  display: block;
  margin-top: 8rpx;
}

.detect-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 160px;
  height: 160px;
  opacity: 0;
  pointer-events: none;
}
</style>
