<template>
  <view class="page-container" :class="themeClass">
    <view class="header">
      <text class="title">用户服务协议</text>
      <text class="update-time">更新时间：2024年1月1日</text>
    </view>
    
    <view class="content-section">
      <view class="section">
        <text class="section-title">一、总则</text>
        <text class="section-content">
          欢迎使用"算命小程序"（以下简称"本小程序"）。请您在使用本小程序之前，仔细阅读并充分理解本协议的全部内容。如果您不同意本协议的任何条款，请停止使用本小程序。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">二、服务内容</text>
        <text class="section-content">
          本小程序提供以下服务：
        </text>
        <text class="section-content">1. 生辰八字分析</text>
        <text class="section-content">2. 星座运势查询</text>
        <text class="section-content">3. 塔罗牌占卜</text>
        <text class="section-content">4. 姓名测算</text>
        <text class="section-content">5. 风水分析</text>
        <text class="section-content">6. 每日运势推送</text>
        <text class="section-content">
          本小程序保留随时变更、暂停或终止全部或部分服务的权利。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">三、用户注册</text>
        <text class="section-content">
          1. 用户应提供真实、准确、完整的个人信息，并在信息变更时及时更新。
        </text>
        <text class="section-content">
          2. 用户应妥善保管账号和密码，因用户原因导致的账号安全问题，由用户自行承担。
        </text>
        <text class="section-content">
          3. 用户不得以任何方式转让、借用、出租账号。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">四、付费服务</text>
        <text class="section-content">
          1. 本小程序提供的部分服务为付费服务，用户在购买前应仔细阅读服务说明。
        </text>
        <text class="section-content">
          2. 付费服务为虚拟商品，一经开通，不支持退款，法律法规另有规定的除外。
        </text>
        <text class="section-content">
          3. 用户应通过官方渠道进行支付，如因非官方渠道支付造成的损失，由用户自行承担。
        </text>
        <text class="section-content">
          4. 本小程序保留调整服务价格的权利，但不影响已购买服务的使用。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">五、用户行为规范</text>
        <text class="section-content">
          用户在使用本小程序时，应遵守以下规范：
        </text>
        <text class="section-content">1. 遵守国家法律法规和社会公德</text>
        <text class="section-content">2. 不得利用本小程序从事违法违规活动</text>
        <text class="section-content">3. 不得干扰本小程序的正常运行</text>
        <text class="section-content">4. 不得利用本小程序传播恶意软件或进行网络攻击</text>
        <text class="section-content">5. 不得侵犯他人合法权益</text>
      </view>
      
      <view class="section">
        <text class="section-title">六、知识产权</text>
        <text class="section-content">
          1. 本小程序的所有内容（包括但不限于文字、图片、音频、视频、软件、程序、版面设计等）的知识产权归本小程序所有。
        </text>
        <text class="section-content">
          2. 未经本小程序书面许可，任何人不得以任何方式复制、转载、修改、传播本小程序的内容。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">七、免责声明</text>
        <text class="section-content">
          1. 本小程序提供的所有分析结果仅供娱乐参考，不构成任何形式的承诺、保证或建议。
        </text>
        <text class="section-content">
          2. 用户因使用或依赖本小程序所提供的内容而产生的任何直接或间接损失，本小程序不承担任何责任。
        </text>
        <text class="section-content">
          3. 因不可抗力（如自然灾害、政策变化等）导致的服务中断或数据丢失，本小程序不承担责任。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">八、协议修改</text>
        <text class="section-content">
          本小程序有权根据需要修改本协议的内容。修改后的协议将在本小程序内公布。如用户继续使用本小程序，即视为接受修改后的协议。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">九、法律适用</text>
        <text class="section-content">
          本协议的订立、执行和解释均适用中华人民共和国法律。如发生争议，应友好协商解决；协商不成的，应提交本小程序所在地有管辖权的人民法院诉讼解决。
        </text>
      </view>
      
      <view class="section">
        <text class="section-title">十、联系我们</text>
        <text class="section-content">
          如您对本协议有任何疑问，请联系：
        </text>
        <text class="section-content">客服邮箱：support@example.com</text>
        <text class="section-content">客服微信：example_service</text>
      </view>
    </view>
  </view>
</template>

<script setup>
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-color, #f5f0e8);
  padding: 30rpx;
}

.header {
  margin-bottom: 30rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--primary-color, #c41e3a);
  display: block;
}

.update-time {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  margin-top: 8rpx;
  display: block;
}

.content-section {
  background: var(--card-bg, #fff);
  border-radius: 16rpx;
  padding: 30rpx;
}

.section {
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary, #333);
  margin-bottom: 12rpx;
  display: block;
}

.section-content {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  line-height: 1.8;
  margin-bottom: 8rpx;
  display: block;
}
</style>
