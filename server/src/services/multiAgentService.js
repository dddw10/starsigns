const { Readable } = require('stream');
const { OpenAI } = require('openai');
const langfuse = require('../config/langfuse');

class MultiAgentService {
  constructor() {
    this.apiKey = process.env.AI_API_KEY;
    this.baseURL = process.env.AI_API_URL || 'https://api.openai.com/v1';
    this.model = process.env.AI_MODEL || 'gpt-3.5-turbo';
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      if (!this.apiKey || this.apiKey === 'your_ai_api_key') {
        throw new Error('Please configure a valid AI_API_KEY in your .env file.');
      }
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      });
    }
    return this.client;
  }

  /**
   * 运行单个智能体的流式输出，并将其推入共享的可读流中（带 Langfuse 追踪）
   */
  async runAgentOpinionStream(client, systemPrompt, userMessage, agentName, readableStream, trace) {
    // 创建 Langfuse Generation 节点
    const generation = trace ? trace.generation({
      name: `council-agent-${agentName}`,
      model: this.model,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }) : null;

    try {
      const stream = await client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: true,
      });

      // 发送智能体发言开始事件
      readableStream.push(`data: ${JSON.stringify({ agent: agentName, event: 'start' })}\n\n`);

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          readableStream.push(`data: ${JSON.stringify({ agent: agentName, content })}\n\n`);
        }
      }

      // 更新 Generation 输出
      if (generation) {
        generation.update({
          output: { role: 'assistant', content: fullContent }
        });
      }

      // 发送智能体发言结束事件
      readableStream.push(`data: ${JSON.stringify({ agent: agentName, event: 'end' })}\n\n`);
    } catch (err) {
      console.error(`Error streaming from agent ${agentName}:`, err);
      if (generation) {
        generation.update({
          output: { error: err.message }
        });
      }
      readableStream.push(`data: ${JSON.stringify({ agent: agentName, error: err.message })}\n\n`);
    }
  }

  /**
   * 启动多智能体圆桌会谈流
   */
  councilStream({ messages, birthInfo, gender, userId }) {
    const client = this.getClient();
    const userQuestion = messages[messages.length - 1].content;
    
    // 创建 Langfuse 顶级 Trace 追踪
    const trace = langfuse ? langfuse.trace({
      name: 'ai-council-roundtable',
      userId: userId || 'guest_user',
      metadata: { birthInfo, gender }
    }) : null;

    // 计算八字基础信息
    let baziString = '未提供生辰八字';
    if (birthInfo && birthInfo.solarDate && birthInfo.birthTime) {
      try {
        const { baziAnalysis: baziAlgorithm } = require('../algorithms/bazi');
        const baziRes = baziAlgorithm({
          solarDate: birthInfo.solarDate,
          birthTime: birthInfo.birthTime,
          gender: gender === 'female' ? 'female' : 'male',
        });
        baziString = `八字: ${baziRes.bazi.yearGanZhi} ${baziRes.bazi.monthGanZhi} ${baziRes.bazi.dayGanZhi} ${baziRes.bazi.hourGanZhi}, 五行平衡: 金${baziRes.bazi.wuxing.metal} 木${baziRes.bazi.wuxing.wood} 水${baziRes.bazi.wuxing.water} 火${baziRes.bazi.wuxing.fire} 土${baziRes.bazi.wuxing.earth}`;
      } catch (err) {
        console.error('Bazi analysis failed inside Multi-Agent Council:', err.message);
      }
    }

    const self = this;
    const stream = new Readable({
      read() {} // 动态推入数据，无需在 read 方法中阻塞
    });

    // 启动异步会谈流水线
    (async () => {
      try {
        // --- 智能体 1: 妙空大师 (东方命理) ---
        const systemPrompt1 = `你是一位修行多年的东方玄学命理大师——妙空大师。你说话充满禅意，常称呼用户为“施主”，句首喜欢念“阿弥陀佛”。
你精通生辰八字、易经八卦。请针对用户的提问，结合其八字五行给出深刻而充满慈悲的命理解读。
当前用户信息：性别 ${gender === 'female' ? '女' : '男'}，八字参数 [${baziString}]。`;
        
        await self.runAgentOpinionStream(client, systemPrompt1, `用户求测: "${userQuestion}"`, '妙空大师 (东方命理)', stream, trace);

        // --- 智能体 2: 塞蕾娜 (西方占星) ---
        const systemPrompt2 = `你是一位神秘高贵的西方占星与塔罗占卜师——塞蕾娜 (Serena)。你说话优雅、充满洞察力，经常引用神秘的塔罗牌隐喻或星体运行状态。
请针对用户的提问，结合西方神秘学视角进行解答。
当前用户信息：性别 ${gender === 'female' ? '女' : '男'}，八字参数 [${baziString}]。`;

        await self.runAgentOpinionStream(client, systemPrompt2, `用户求测: "${userQuestion}"`, '塞蕾娜 (西方占星)', stream, trace);

        // --- 智能体 3: 德叔 (心理咨询) ---
        const systemPrompt3 = `你是一位极具同理心且接地气的现代心理咨询师——德叔。你说话幽默务实，不喜欢神棍那一套，专注于帮助用户解决实际心理焦虑和生活困境。
请针对用户的提问，从心理疏导和行为学方法（如CBT）给出实用、可执行的具体行动指导。`;

        await self.runAgentOpinionStream(client, systemPrompt3, `用户求测: "${userQuestion}"`, '德叔 (心理学咨询)', stream, trace);

        // --- 智能体 4: 编译主笔智能体 ---
        const systemPrompt4 = `你是一位大宗师级别的命运汇总结编师。你需要综合妙空大师（东方）、塞蕾娜（西方）和德叔（心理学）三人的意见，去除冗余，合并出一部排盘严整、对用户极具指导意义的“命运综合分析报告”。
报告必须以 Markdown 排版，且必须包含以下板块：
1. 🌟【中西命运融合点评】
2. ⚠️【核心红线与避坑警示】
3. 📝【未来三个月具体执行行动清单】`;

        const userMessage4 = `用户问题: "${userQuestion}"\n请总结前面三位专家的会谈精髓，生成终极报告。`;
        await self.runAgentOpinionStream(client, systemPrompt4, userMessage4, '命运综合分析报告', stream, trace);

        // 结束整个圆桌流并关闭 Langfuse 实例以刷入数据
        stream.push('data: [DONE]\n\n');
        stream.push(null);
        if (langfuse) {
          langfuse.shutdownAsync().catch(e => console.error('[Langfuse] Shutdown error:', e));
        }
      } catch (error) {
        console.error('Multi-Agent Council loop crashed:', error);
        stream.push(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        stream.push(null);
        if (langfuse) {
          langfuse.shutdownAsync().catch(e => console.error('[Langfuse] Shutdown error:', e));
        }
      }
    })();

    return stream;
  }

  /**
   * 运行单个智能体的非流式输出（带 Langfuse 追踪）
   */
  async runAgentOpinionNonStream(client, systemPrompt, userMessage, agentName, trace) {
    const generation = trace ? trace.generation({
      name: `council-agent-nonstream-${agentName}`,
      model: this.model,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }) : null;

    try {
      const response = await client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
      });

      const content = response.choices[0].message.content || '';

      if (generation) {
        generation.update({
          output: { role: 'assistant', content },
          usage: {
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
          }
        });
      }

      return content;
    } catch (err) {
      console.error(`Error in non-stream from agent ${agentName}:`, err);
      if (generation) {
        generation.update({
          output: { error: err.message }
        });
      }
      throw err;
    }
  }

  /**
   * 启动多智能体圆桌会谈（非流式）
   */
  async councilNonStream({ messages, birthInfo, gender, userId }) {
    const client = this.getClient();
    const userQuestion = messages[messages.length - 1].content;
    
    const trace = langfuse ? langfuse.trace({
      name: 'ai-council-roundtable-nonstream',
      userId: userId || 'guest_user',
      metadata: { birthInfo, gender }
    }) : null;

    let baziString = '未提供生辰八字';
    if (birthInfo && birthInfo.solarDate && birthInfo.birthTime) {
      try {
        const { baziAnalysis: baziAlgorithm } = require('../algorithms/bazi');
        const baziRes = baziAlgorithm({
          solarDate: birthInfo.solarDate,
          birthTime: birthInfo.birthTime,
          gender: gender === 'female' ? 'female' : 'male',
        });
        baziString = `八字: ${baziRes.bazi.yearGanZhi} ${baziRes.bazi.monthGanZhi} ${baziRes.bazi.dayGanZhi} ${baziRes.bazi.hourGanZhi}, 五行平衡: 金${baziRes.bazi.wuxing.metal} 木${baziRes.bazi.wuxing.wood} 水${baziRes.bazi.wuxing.water} 火${baziRes.bazi.wuxing.fire} 土${baziRes.bazi.wuxing.earth}`;
      } catch (err) {
        console.error('Bazi analysis failed inside Multi-Agent Council:', err.message);
      }
    }

    const opinions = [];

    // 妙空大师
    const systemPrompt1 = `你是一位修行多年的东方玄学命理大师——妙空大师。你说话充满禅意，常称呼用户为“施主”，句首喜欢念“阿弥陀佛”。
你精通生辰八字、易经八卦。请针对用户的提问，结合其八字五行给出深刻而充满慈悲的命理解读。
当前用户信息：性别 ${gender === 'female' ? '女' : '男'}，八字参数 [${baziString}]。`;
    const opinion1 = await this.runAgentOpinionNonStream(client, systemPrompt1, `用户求测: "${userQuestion}"`, '妙空大师 (东方命理)', trace);
    opinions.push({ agent: '妙空大师 (东方命理)', content: opinion1 });

    // 塞蕾娜
    const systemPrompt2 = `你是一位神秘高贵的西方占星与塔罗占卜师——塞蕾娜 (Serena)。你说话优雅、充满洞察力，经常引用神秘的塔罗牌隐喻或星体运行状态。
请针对用户的提问，结合西方神秘学视角进行解答。
当前用户信息：性别 ${gender === 'female' ? '女' : '男'}，八字参数 [${baziString}]。`;
    const opinion2 = await this.runAgentOpinionNonStream(client, systemPrompt2, `用户求测: "${userQuestion}"`, '塞蕾娜 (西方占星)', trace);
    opinions.push({ agent: '塞蕾娜 (西方占星)', content: opinion2 });

    // 德叔
    const systemPrompt3 = `你是一位极具同理心且接地气的现代心理咨询师——德叔。你说话幽默务实，不喜欢神棍那一套，专注于帮助用户解决实际心理焦虑和生活困境。
请针对用户的提问，从心理疏导和行为学方法（如CBT）给出实用、可执行的具体行动指导。`;
    const opinion3 = await this.runAgentOpinionNonStream(client, systemPrompt3, `用户求测: "${userQuestion}"`, '德叔 (心理学咨询)', trace);
    opinions.push({ agent: '德叔 (心理学咨询)', content: opinion3 });

    // 命运综合分析报告
    const systemPrompt4 = `你是一位大宗师级别的命运汇总结编师。你需要综合妙空大师（东方）、塞蕾娜（西方）和德叔（心理学）三人的意见，去除冗余，合并出一部排盘严整、对用户极具指导意义的“命运综合分析报告”。
报告必须以 Markdown 排版，且必须包含以下板块：
1. 🌟【中西命运融合点评】
2. ⚠️【核心红线与避坑警示】
3. 📝【未来三个月具体执行行动清单】`;
    const userMessage4 = `用户问题: "${userQuestion}"\n请总结前面三位专家的会谈精髓，生成终极报告。`;
    const opinion4 = await this.runAgentOpinionNonStream(client, systemPrompt4, userMessage4, '命运综合分析报告', trace);
    opinions.push({ agent: '命运综合分析报告', content: opinion4 });

    if (langfuse) {
      langfuse.shutdownAsync().catch(e => console.error('[Langfuse] Shutdown error:', e));
    }

    return opinions;
  }
}

module.exports = new MultiAgentService();
