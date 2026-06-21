<template>
  <view class="page-container" :class="themeClass">
    <view class="mystic-orb orb-1"></view>
    <view class="mystic-orb orb-2"></view>

    <!-- 预览卡片 -->
    <view class="share-card-container">
      <view class="share-card">
        <view class="card-header">
          <text class="app-name">☯️ 算命大师小程序 ☯️</text>
          <text class="share-date">{{ shareDate }}</text>
        </view>

        <view class="card-body">
          <view class="fortune-section">
            <text class="fortune-title">{{ result.title }}</text>
            <view class="rating-row" v-if="result.score">
              <text class="score-label">契合数理:</text>
              <text class="score-num">{{ result.score }}分</text>
            </view>
            <view class="rating-stars" v-else>
              <text v-for="i in 5" :key="i" class="star">★</text>
            </view>
          </view>

          <view class="user-info-section" v-if="result.name">
            <text class="user-label">测算信士:</text>
            <text class="user-val">{{ result.name }}</text>
          </view>

          <view class="analysis-section">
            <scroll-view class="analysis-scroll" scroll-y>
              <text class="analysis-text">{{ result.analysis }}</text>
            </scroll-view>
          </view>
        </view>

        <view class="card-footer">
          <text class="footer-text">扫码叩问天机，测测您的气运 ➔</text>
          <view class="qrcode-wrapper">
            <view class="qrcode-placeholder">
              <text class="qrcode-logo">☯️</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 操作区 -->
    <view class="action-section">
      <button class="action-btn save-btn" @click="savePoster">保存海报至相册</button>
      <!-- #ifdef MP-WECHAT -->
      <button class="action-btn primary-btn" open-type="share">直接发送给好友</button>
      <!-- #endif -->
      <!-- #ifndef MP-WECHAT -->
      <button class="action-btn primary-btn" @click="shareOnH5">分享网页链接</button>
      <!-- #endif -->
    </view>

    <view class="tips-section">
      <text class="tips-title">💡 命运分享贴士</text>
      <text class="tips-text">1. 保存海报后可发布至微信朋友圈，与亲友探讨运势</text>
      <text class="tips-text">2. 分享合婚或契合度报告给对方，增进彼此数理联结</text>
    </view>

    <!-- 用于海报绘制的离屏 canvas (双倍高保真清晰度) -->
    <canvas canvas-id="shareCanvas" id="shareCanvas" class="hidden-canvas"></canvas>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { useThemeStore } from '@/store/theme'

const themeStore = useThemeStore()

const themeClass = computed(() => `theme-${themeStore.currentTheme}`)

const shareDate = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

const result = ref({
  type: 'bazi',
  title: '生辰八字命盘',
  name: '本命信士',
  score: 88,
  analysis: '今日运势气场充沛，利于开展新事务；财星引照，宜广结善缘，平稳守信。'
})

onLoad((options) => {
  if (options.type) result.value.type = options.type
  if (options.title) result.value.title = decodeURIComponent(options.title)
  if (options.name) result.value.name = decodeURIComponent(options.name)
  if (options.score) result.value.score = Number(options.score)
  if (options.analysis) result.value.analysis = decodeURIComponent(options.analysis)
})

// 微信原生转发好友
onShareAppMessage(() => {
  return {
    title: `【${result.value.title}】我的天命批语已送达，快来测测你的气运！`,
    path: `/pages/index/index`,
    imageUrl: '/static/share-cover.jpg' // 可选封面图
  }
})

// 绘制海报
const drawPosterOnCanvas = () => {
  return new Promise((resolve, reject) => {
    const ctx = uni.createCanvasContext('shareCanvas')
    if (!ctx) {
      reject(new Error('无法创建 Canvas 上下文'))
      return
    }

    const canvasW = 750
    const canvasH = 1200

    // 1. 绘制古风渐变背景
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH)
    grad.addColorStop(0, '#1c1012')
    grad.addColorStop(1, '#32161a')
    ctx.setFillStyle(grad)
    ctx.fillRect(0, 0, canvasW, canvasH)

    // 2. 绘制金色描边边框
    ctx.setStrokeStyle('#c8a261')
    ctx.setLineWidth(4)
    ctx.strokeRect(20, 20, canvasW - 40, canvasH - 40)

    // 内部细边线
    ctx.setStrokeStyle('rgba(200, 162, 97, 0.4)')
    ctx.setLineWidth(1)
    ctx.strokeRect(30, 30, canvasW - 60, canvasH - 60)

    // 3. 绘制祥云角落花纹 (简易中国结线描绘制)
    const drawCornerDecoration = (x, y, rotation) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation * Math.PI / 180)
      ctx.setStrokeStyle('#c8a261')
      ctx.setLineWidth(2)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(25, 0)
      ctx.lineTo(25, 25)
      ctx.moveTo(10, 10)
      ctx.lineTo(20, 10)
      ctx.lineTo(20, 20)
      ctx.stroke()
      ctx.restore()
    }
    drawCornerDecoration(35, 35, 0)
    drawCornerDecoration(canvasW - 35, 35, 90)
    drawCornerDecoration(canvasW - 35, canvasH - 35, 180)
    drawCornerDecoration(35, canvasH - 35, 270)

    // 4. 绘制小程序主标题
    ctx.setFillStyle('#e5c158')
    ctx.setFontSize(28)
    ctx.setTextAlign('center')
    ctx.fillText('☯️ 算命大师小程序 ☯️', canvasW / 2, 80)

    // 5. 绘制卷轴主图 (羊皮纸色背景区域)
    const scrollW = canvasW - 100
    const scrollH = 750
    const scrollX = 50
    const scrollY = 150

    ctx.setFillStyle('#fdf8eb')
    ctx.fillRect(scrollX, scrollY, scrollW, scrollH)

    ctx.setStrokeStyle('#aa7c11')
    ctx.setLineWidth(3)
    ctx.strokeRect(scrollX, scrollY, scrollW, scrollH)

    // 绘制卷轴边缘阴影及轴头
    ctx.setFillStyle('#8a640f')
    ctx.fillRect(scrollX - 8, scrollY, 8, scrollH) // 左卷轴轴身
    ctx.fillRect(scrollX + scrollW, scrollY, 8, scrollH) // 右卷轴轴身

    // 6. 卷轴内文字绘制
    ctx.setTextAlign('center')
    ctx.setFillStyle('#3e2723')
    ctx.setFontSize(36)
    ctx.fillText(result.value.title, canvasW / 2, scrollY + 80)

    // 绘制下划线
    ctx.setStrokeStyle('rgba(138, 100, 15, 0.3)')
    ctx.setLineWidth(2)
    ctx.beginPath()
    ctx.moveTo(canvasW / 2 - 120, scrollY + 105)
    ctx.lineTo(canvasW / 2 + 120, scrollY + 105)
    ctx.stroke()

    // 测算信士
    if (result.value.name) {
      ctx.setTextAlign('left')
      ctx.setFontSize(26)
      ctx.setFillStyle('#6d4c41')
      ctx.fillText(`测算信士: ${result.value.name}`, scrollX + 40, scrollY + 170)
    }

    // 契合评分
    if (result.value.score) {
      ctx.setTextAlign('right')
      ctx.setFontSize(26)
      ctx.setFillStyle('#c41e3a')
      ctx.fillText(`数理评分: ${result.value.score}分`, scrollX + scrollW - 40, scrollY + 170)
    }

    // 分割虚线
    ctx.setStrokeStyle('rgba(138, 100, 15, 0.2)')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(scrollX + 30, scrollY + 205)
    ctx.lineTo(scrollX + scrollW - 30, scrollY + 205)
    ctx.stroke()

    // 批注解读 (自动换行)
    ctx.setTextAlign('left')
    ctx.setFillStyle('#3e2723')
    ctx.setFontSize(26)
    
    const maxTextW = scrollW - 80
    const startX = scrollX + 40
    const startY = scrollY + 260
    const lineHeight = 44

    // 自动换行实现
    const text = result.value.analysis || ''
    let line = ''
    let currentY = startY

    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i)
      const testLine = line + char
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxTextW && i > 0) {
        ctx.fillText(line, startX, currentY)
        line = char
        currentY += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, startX, currentY)

    // 7. 绘制下方引导二维码区
    const qrY = scrollY + scrollH + 50
    ctx.setTextAlign('left')
    ctx.setFillStyle('#e5c158')
    ctx.setFontSize(24)
    ctx.fillText('扫码测测您的生辰与流年运势 ➔', scrollX + 20, qrY + 60)

    // 绘制二维码方框
    const qrSize = 130
    const qrX = canvasW - scrollX - qrSize
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(qrX, qrY, qrSize, qrSize)
    ctx.setStrokeStyle('#c8a261')
    ctx.strokeRect(qrX, qrY, qrSize, qrSize)

    // 二维码内部太极阴阳图占位
    ctx.save()
    ctx.translate(qrX + qrSize/2, qrY + qrSize/2)
    
    // 阴阳鱼绘制
    ctx.beginPath()
    ctx.arc(0, 0, 45, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#161012'
    ctx.lineWidth = 2
    ctx.stroke()

    // 黑色半圆
    ctx.beginPath()
    ctx.arc(0, 0, 45, Math.PI / 2, (3 * Math.PI) / 2)
    ctx.fillStyle = '#161012'
    ctx.fill()

    // 上方鱼眼小半圆
    ctx.beginPath()
    ctx.arc(0, -22.5, 22.5, 0, 2 * Math.PI)
    ctx.fillStyle = '#161012'
    ctx.fill()

    // 下方鱼眼小半圆
    ctx.beginPath()
    ctx.arc(0, 22.5, 22.5, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // 小圆孔鱼眼
    ctx.beginPath()
    ctx.arc(0, -22.5, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(0, 22.5, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#161012'
    ctx.fill()

    ctx.restore()

    // 结束绘制
    ctx.draw(false, () => {
      resolve()
    })
  })
}

// 保存海报到系统相册
const savePoster = async () => {
  uni.showLoading({ title: '正在画符绘卷...' })
  try {
    await drawPosterOnCanvas()
    // 延迟 200ms 等待 Canvas 渲染刷新
    await new Promise(resolve => setTimeout(resolve, 200))
    
    uni.canvasToTempFilePath({
      canvasId: 'shareCanvas',
      success: (res) => {
        uni.hideLoading()
        const tempFilePath = res.tempFilePath
        
        // #ifdef H5
        // H5环境直接触发浏览器下载
        const a = document.createElement('a')
        a.href = tempFilePath
        a.download = `${result.value.title || '运势海报'}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        
        uni.showModal({
          title: '💾 画卷已生成',
          content: '运势批注法卷已生成并触发下载！如果在手机端浏览器中未成功保存，请长按页面中的海报卡片进行保存。',
          showCancel: false
        })
        // #endif

        // #ifndef H5
        // 保存相册
        uni.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => {
            uni.showModal({
              title: '💾 画卷已存入相册',
              content: '运势批注法卷已成功保存至您的手机相册，快去分享给亲友看吧！',
              showCancel: false
            })
          },
          fail: (err) => {
            if (err.errMsg.indexOf('auth deny') >= 0 || err.errMsg.indexOf('denied') >= 0) {
              uni.showModal({
                title: '需要授权',
                content: '保存海报需要写入您的相册，请在“设置”中开启相册权限。',
                success: (settingRes) => {
                  if (settingRes.confirm) {
                    uni.openSetting()
                  }
                }
              })
            } else {
              uni.showToast({ title: '保存相册失败: ' + err.errMsg, icon: 'none' })
            }
          }
        })
        // #endif
      },
      fail: (err) => {
        uni.hideLoading()
        uni.showToast({ title: '导出海报文件失败: ' + err.errMsg, icon: 'none' })
      }
    }, this)
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '绘制海报异常: ' + e.message, icon: 'none' })
  }
}

// H5 网页复制链接分享
const shareOnH5 = () => {
  // #ifdef H5
  const url = window.location.href
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showModal({
        title: '🔗 链接已复制',
        content: '网页链接已成功复制到剪贴板，您可以直接粘贴发送给微信好友或发到朋友圈！',
        showCancel: false
      })
    },
    fail: () => {
      uni.showModal({
        title: '分享提示',
        content: `请复制当前浏览器地址栏的网址分享给好友：\n${url}`,
        showCancel: false
      })
    }
  })
  // #endif
}
</script>

<style scoped>
.page-container {
  padding: 30rpx;
  background: var(--bg-color, #f5f0e8);
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  box-sizing: border-box;
}

.page-container.theme-chinese {
  background: linear-gradient(135deg, #161012, #241416, #161012);
  color: #e2dcf0;
}

/* 背景模糊球 */
.mystic-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120rpx);
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
}
.orb-1 {
  width: 500rpx;
  height: 500rpx;
  background: #c41e3a;
  top: -100rpx;
  left: -200rpx;
}
.orb-2 {
  width: 600rpx;
  height: 600rpx;
  background: #aa7c11;
  bottom: -100rpx;
  right: -250rpx;
}

/* 分享预览卡 */
.share-card-container {
  display: flex;
  justify-content: center;
  margin-top: 20rpx;
  margin-bottom: 40rpx;
  z-index: 1;
  position: relative;
}

.share-card {
  width: 100%;
  background: linear-gradient(135deg, #1b1113 0%, #281417 100%);
  border: 2rpx solid #c8a261;
  box-shadow: 0 10rpx 40rpx rgba(153, 15, 38, 0.25);
  border-radius: 24rpx;
  padding: 30rpx 24rpx;
}

.card-header {
  text-align: center;
  margin-bottom: 24rpx;
}

.app-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #e5c158;
}

.share-date {
  font-size: 20rpx;
  color: #887fa3;
  margin-top: 8rpx;
  display: block;
}

.card-body {
  background: #fdf8eb;
  border: 2rpx solid #aa7c11;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: inset 0 0 30rpx rgba(138, 100, 15, 0.1);
}

.fortune-section {
  text-align: center;
  margin-bottom: 20rpx;
}

.fortune-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #3e2723;
  display: block;
  margin-bottom: 12rpx;
}

.rating-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10rpx;
}

.score-label {
  font-size: 24rpx;
  color: #6d4c41;
}

.score-num {
  font-size: 32rpx;
  font-weight: bold;
  color: #c41e3a;
}

.rating-stars {
  font-size: 28rpx;
  color: #d4af37;
}

.user-info-section {
  display: flex;
  gap: 12rpx;
  font-size: 24rpx;
  border-bottom: 1rpx dashed rgba(138, 100, 15, 0.2);
  padding-bottom: 12rpx;
  margin-bottom: 16rpx;
}

.user-label {
  color: #6d4c41;
}

.user-val {
  font-weight: bold;
  color: #3e2723;
}

.analysis-section {
  margin-bottom: 10rpx;
}

.analysis-scroll {
  max-height: 400rpx;
}

.analysis-text {
  font-size: 26rpx;
  color: #3e2723;
  line-height: 1.8;
  display: block;
  text-align: justify;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed rgba(200, 162, 97, 0.2);
}

.footer-text {
  font-size: 22rpx;
  color: #a69ebd;
}

.qrcode-wrapper {
  background: #ffffff;
  padding: 8rpx;
  border-radius: 8rpx;
  border: 1rpx solid #c8a261;
}

.qrcode-placeholder {
  width: 90rpx;
  height: 90rpx;
  background: #161012;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qrcode-logo {
  font-size: 36rpx;
  color: #e5c158;
}

/* 操作区域 */
.action-section {
  display: flex;
  gap: 20rpx;
  margin-bottom: 40rpx;
  z-index: 1;
  position: relative;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 26rpx;
  border-radius: 44rpx;
  font-weight: bold;
  border: none;
}

.save-btn {
  background: #e5c158;
  color: #161012;
  box-shadow: 0 4rpx 12rpx rgba(229, 193, 88, 0.3);
}

.primary-btn {
  background: linear-gradient(135deg, #c41e3a, #990f26);
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(196, 30, 58, 0.4);
}

.tips-section {
  background: rgba(30, 20, 22, 0.6);
  border: 1rpx solid #3e282c;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 50rpx;
  z-index: 1;
  position: relative;
}

.tips-title {
  font-size: 24rpx;
  font-weight: bold;
  color: #e5c158;
  margin-bottom: 12rpx;
  display: block;
}

.tips-text {
  font-size: 22rpx;
  color: #a69ebd;
  line-height: 1.6;
  display: block;
}

/* 离屏高精度 canvas */
.hidden-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 750px;
  height: 1200px;
  visibility: hidden;
}
</style>
