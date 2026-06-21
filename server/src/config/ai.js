// AI 服务配置
module.exports = {
  // OpenAI 配置
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'your_openai_api_key',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 2000,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
  },

  // 自定义 AI 模型配置（如本地部署的模型）
  custom: {
    apiKey: process.env.CUSTOM_AI_API_KEY || '',
    baseUrl: process.env.CUSTOM_AI_BASE_URL || '',
    model: process.env.CUSTOM_AI_MODEL || '',
  },

  // Prompt 模板配置
  prompts: {
    // 八字解读 prompt
    baziAnalysis: `你是一位精通命理学的大师，请根据以下八字信息进行详细解读：
八字：{bazi}
五行：{wuxing}
请从事业、财运、感情、健康等方面进行分析，给出建议。`,

    // 姓名测算 prompt
    nameAnalysis: `你是一位精通姓名学的大师，请根据以下姓名信息进行测算：
姓名：{name}
请从五行、三才、笔画等方面进行分析，给出评分和建议。`,

    // 风水分析 prompt
    fengshuiAnalysis: `你是一位精通风水学的大师，请根据以下信息进行风水分析：
朝向：{direction}
格局：{layout}
请给出风水评估和改善建议。`,

    // 每日运势 prompt
    dailyFortune: `请根据以下生辰八字生成今日运势预测：
八字：{bazi}
日期：{date}
请从整体运势、事业、财运、感情、健康等方面进行预测，给出幸运数字、幸运颜色。`,
  },

  // 重试配置
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
  },

  // 超时配置
  timeout: 30000,
};
