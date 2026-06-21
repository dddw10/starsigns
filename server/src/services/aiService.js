const { OpenAI } = require('openai');
const fortuneService = require('./fortuneService');
const langfuse = require('../config/langfuse');

class AIService {
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
   * AI Agent chat with Function Calling support (Langfuse Traced)
   * @param {Object} params
   * @param {Array} params.messages - Chat history messages
   * @param {Object} params.birthInfo - User birth info (optional)
   * @param {string} params.gender - User gender (optional)
   * @param {string} params.userId - DB User ID (optional)
   * @param {boolean} params.stream - Whether to use streaming (default: true)
   */
  async chat({ messages, birthInfo, gender, userId, stream = true }) {
    const client = this.getClient();

    // 创建 Langfuse 追踪
    const trace = langfuse ? langfuse.trace({
      name: stream ? 'ai-chat-master-agent' : 'ai-chat-master-agent-nonstream',
      userId: userId || 'guest_user',
      metadata: { gender, birthInfo }
    }) : null;

    // Define tools for the Agent
    const tools = [
      {
        type: 'function',
        function: {
          name: 'analyze_bazi',
          description: '计算用户的生辰八字、五行盈缺和基本解读。当用户询问八字命理、运势、起名参考、五行性格等话题时使用此工具。',
          parameters: {
            type: 'object',
            properties: {
              solarDate: {
                type: 'string',
                description: '用户的公历出生日期，格式为 YYYY-MM-DD，例如: 1995-10-10',
              },
              birthTime: {
                type: 'string',
                description: '出生时辰，范围 0-23 的整数字符串，例如: 10',
              },
              gender: {
                type: 'string',
                enum: ['male', 'female'],
                description: '用户性别: male (男), female (女)',
              },
            },
            required: ['solarDate', 'birthTime', 'gender'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyze_tarot',
          description: '抽取塔罗牌进行占卜。当用户想通过抽塔罗牌解答具体人生抉择、感情发展、财务状况时使用。',
          parameters: {
            type: 'object',
            properties: {
              spreadType: {
                type: 'string',
                enum: ['loveMatch', 'threeCards', 'single'],
                description: '牌阵类型: single (单牌占卜), threeCards (三牌占卜: 过去/现在/未来), loveMatch (感情配对)',
              },
            },
            required: ['spreadType'],
          },
        },
      },
    ];

    // Define the AI Master System Prompt
    const systemPrompt = {
      role: 'system',
      content: `你是一位精通中国传统命理与西方神秘学的 AI 命理大宗师。你将使用温和、鼓励、心理疏导式的语言与用户沟通。
请遵循以下规则：
1. **科学态度**：不搞绝对化、宿命论，重在性格分析、运势趋势 and 心理层面的正向建议。
2. **拒绝盲目脑补**：如果需要算命，请通过 \`analyze_bazi\` 计算准确的八字五行；如果需要占卜，请通过 \`analyze_tarot\` 抽取真实的塔罗牌阵。千万不要自己虚构八字排盘或占卜牌面。
3. **结合计算结果解读**：工具返回 JSON 数据后，用你大师的口吻把晦涩的命理学概念（天干地支、五行盈缺、塔罗牌义等）转化成易懂且启发性强的话语分析给用户。
4. **现有用户信息**：
   - 用户的性别: ${gender === 'female' ? '女' : (gender === 'male' ? '男' : '未指定')}
   - 用户的出生信息: ${JSON.stringify(birthInfo || {})}
   若用户已经提供了公历生日等信息，在用户询问八字/命运时，请优先使用已有的出生信息调用 \`analyze_bazi\`。`
    };

    let currentMessages = [systemPrompt, ...messages];
    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      loopCount++;

      // 追踪每一次大模型决策循环的 LLM 调用
      const generation = trace ? trace.generation({
        name: `agent-thinking-loop-${loopCount}`,
        model: this.model,
        input: currentMessages,
      }) : null;
      
      const response = await client.chat.completions.create({
        model: this.model,
        messages: currentMessages,
        tools: tools,
        tool_choice: 'auto',
      });

      const responseMessage = response.choices[0].message;

      if (generation) {
        generation.update({
          output: responseMessage,
          usage: {
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
          }
        });
      }

      // If LLM decides to call tools
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        currentMessages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          let functionResult = '';

          // 追踪工具执行
          const toolSpan = trace ? trace.span({
            name: `tool-call-${functionName}`,
            input: functionArgs,
          }) : null;

          try {
            if (functionName === 'analyze_bazi') {
              const res = await fortuneService.baziAnalysis(userId || 'guest_user', {
                solarDate: functionArgs.solarDate,
                birthTime: functionArgs.birthTime,
                gender: functionArgs.gender,
              });
              functionResult = JSON.stringify(res);
            } else if (functionName === 'analyze_tarot') {
              const res = await fortuneService.tarotReading(userId || 'guest_user', {
                spreadType: functionArgs.spreadType,
              });
              functionResult = JSON.stringify(res);
            }
          } catch (err) {
            console.error(`Tool execution error [${functionName}]:`, err.message);
            functionResult = JSON.stringify({ error: err.message });
          }

          if (toolSpan) {
            toolSpan.update({
              output: functionResult,
            });
          }

          currentMessages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: functionResult,
          });
        }
        // Continue loop to let the LLM see the tool output and continue its reasoning
      } else {
        if (stream) {
          // Streaming mode
          const finalGeneration = trace ? trace.generation({
            name: 'agent-final-response-stream',
            model: this.model,
            input: currentMessages,
          }) : null;

          const responseStream = await client.chat.completions.create({
            model: this.model,
            messages: currentMessages,
            stream: true,
          });

          // 利用异步生成器拦截并汇总流式响应内容到 Langfuse 平台
          async function* streamInterceptor() {
            let fullContent = '';
            try {
              for await (const chunk of responseStream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullContent += content;
                yield chunk;
              }
              if (finalGeneration) {
                finalGeneration.update({
                  output: { role: 'assistant', content: fullContent }
                });
              }
            } catch (err) {
              if (finalGeneration) {
                finalGeneration.update({
                  output: { error: err.message }
                });
              }
              throw err;
            } finally {
              if (langfuse) {
                langfuse.shutdownAsync().catch(e => console.error('[Langfuse] Shutdown error:', e));
              }
            }
          }

          return streamInterceptor();
        } else {
          // Non-streaming mode
          const finalGeneration = trace ? trace.generation({
            name: 'agent-final-response-nonstream',
            model: this.model,
            input: currentMessages,
          }) : null;

          const response = await client.chat.completions.create({
            model: this.model,
            messages: currentMessages,
            stream: false,
          });

          const finalContent = response.choices[0].message.content || '';

          if (finalGeneration) {
            finalGeneration.update({
              output: { role: 'assistant', content: finalContent },
              usage: {
                promptTokens: response.usage?.prompt_tokens,
                completionTokens: response.usage?.completion_tokens,
              }
            });
          }

          if (langfuse) {
            langfuse.shutdownAsync().catch(e => console.error('[Langfuse] Shutdown error:', e));
          }

          return finalContent;
        }
      }
    }

    throw new Error('AI Agent exceeded maximum tool call loops.');
  }

  /**
   * Backward compatibility alias for streaming chat
   */
  async chatStream(params) {
    return this.chat({ ...params, stream: true });
  }


  /**
   * 分析面相或手相 (支持 VLM 视觉大模型与文本特征兜底)
   */
  async analyzeFacePalm({ type, base64Image, skinRatio, edgeAverage }) {
    const client = this.getClient();
    const visionModel = process.env.AI_VISION_MODEL || this.model;
    const isDeepSeek = this.model.includes('deepseek');

    // 兜底逻辑：如果使用的是不支持图片的 DeepSeek 且没有配置独立视觉模型，或没有传入图片数据
    if (isDeepSeek || !base64Image) {
      console.log('[AI Service] Using text-based fallback for Face/Palm analysis...');
      const prompt = `您是一位精通面相与手相学的大宗师。
用户上传了照片，系统提取出以下数值特征：
- 测算类型: ${type === 'face' ? '面相' : '手相'}
- 皮肤平滑红润度比值 (skinRatio): ${skinRatio || 0.15}
- 轮廓边缘纹理均值 (edgeAverage): ${edgeAverage || 4.5}

请基于上述参数，虚构一套极其逼真、高大上且符合传统相学的测算分析报告。
请直接输出以下 JSON 格式的结果（不要用 \`\`\`json 包裹，确保是一个合法的 JSON 对象，不含任何多余的前后缀文本）：
{
  "featureTitle": "核心相面特征总结（如：额部饱满，印堂润泽之吉相）",
  "features": "基于参数详细描述观察到的相学物理特征，字数 100-150 字",
  "fortune": "详细的运势剖析（包括事业、财运、健康运走势与建议），字数 150-200 字",
  "personality": "基于相学特征的性格分析，字数 100-150 字"
}`;

      const response = await client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.choices[0].message.content;
      return this._parseJSON(text);
    }

    // 视觉大模型多模态处理
    console.log(`[AI Service] Invoking VLM [${visionModel}] for direct visual analysis...`);
    const prompt = `你是一位精通传统相学的大宗师。
请细致分析用户上传的这幅 ${type === 'face' ? '面相' : '手相'} 照片。
1. 如果是面相，观察其天庭、眉目、山根、鼻翼、口角及腮部轮廓。
2. 如果是手相，观察生命线、智慧线、感情线的深浅走向与手掌饱满气色。

请直接输出以下 JSON 格式结果（不要用 \`\`\`json 包裹，确保是一个合法的 JSON 对象，不含任何多余的前后缀文本）：
{
  "featureTitle": "一句话核心相面/手相特征总结",
  "features": "详细描述从照片中识别到的面部五官气色或掌纹走向特征",
  "fortune": "给予运势剖析（包含事业、财运及健康建议）",
  "personality": "性格特质详细分析"
}`;

    const response = await client.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });

    const text = response.choices[0].message.content;
    return this._parseJSON(text);
  }

  _parseJSON(text) {
    if (!text) throw new Error('AI 返回内容为空');
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (innerError) {
          throw new Error(`JSON 解析失败: ${innerError.message}. 原文: ${text}`);
        }
      }
      throw new Error(`未找到合法的 JSON 对象. 原文: ${text}`);
    }
  }
}

module.exports = new AIService();
