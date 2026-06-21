const aiService = require('../services/aiService');
const multiAgentService = require('../services/multiAgentService');

/**
 * AI 命理大师流式聊天控制器
 */
exports.chatStream = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.userId : null;
    const { messages, birthInfo, gender, stream: streamRequested } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ code: 400, message: 'messages 必填且必须为数组' });
    }

    const useStream = streamRequested !== false;

    if (useStream) {
      // 设置 Server-Sent Events 流式响应头部
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); 

      // 立即向客户端发送响应头
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      // 获取大模型流式响应
      const stream = await aiService.chat({
        messages,
        birthInfo,
        gender,
        userId,
        stream: true,
      });

      // 循环迭代读取流数据并输出
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // 发送结束标识
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 非流式响应
      console.log('[AI Controller] Processing non-stream chat request...');
      const resultContent = await aiService.chat({
        messages,
        birthInfo,
        gender,
        userId,
        stream: false,
      });
      res.json({ code: 0, data: { content: resultContent } });
    }
  } catch (error) {
    console.error('AI Chat Stream Error:', error);
    
    // 如果头部还没发送，交给全局错误中间件处理
    if (!res.headersSent) {
      return next(error);
    }
    
    // 若头部已发送，则在流中返回错误信息并结束流
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

/**
 * AI 智能体圆桌会谈流式控制器
 */
exports.councilStream = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.userId : null;
    const { messages, birthInfo, gender, stream: streamRequested } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ code: 400, message: 'messages 必填且必须为数组' });
    }

    const useStream = streamRequested !== false;

    if (useStream) {
      // 设置 SSE 头部
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      // 启动多智能体圆桌会谈流
      const stream = multiAgentService.councilStream({
        messages,
        birthInfo,
        gender,
        userId,
      });

      // 管道输出流数据
      stream.on('data', (chunk) => {
        res.write(chunk);
      });

      stream.on('end', () => {
        res.end();
      });

      stream.on('error', (err) => {
        console.error('Council Stream Error in controller:', err.message);
        if (!res.headersSent) {
          return next(err);
        }
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });
    } else {
      // 非流式多智能体圆桌会谈响应
      console.log('[AI Controller] Processing non-stream council request...');
      const opinions = await multiAgentService.councilNonStream({
        messages,
        birthInfo,
        gender,
        userId,
      });
      res.json({ code: 0, data: { opinions } });
    }
  } catch (error) {
    console.error('AI Council Stream Route Error:', error);
    if (!res.headersSent) {
      return next(error);
    }
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

