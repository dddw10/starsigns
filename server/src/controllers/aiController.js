const aiService = require('../services/aiService');
const multiAgentService = require('../services/multiAgentService');
const { validateAIInput } = require('../utils/aiInput');
const publicError = '推演暂时无法完成，请稍后重试';

async function respond(req, res, next, council) {
  const controller = new AbortController();
  const { signal } = controller;
  let activeStream;
  const abort = () => {
    controller.abort();
    activeStream?.destroy?.();
  };
  const onClose = () => { if (!res.writableFinished) abort(); };
  req.once('aborted', abort);
  res.once('close', onClose);
  const connected = () => !signal.aborted && !res.destroyed && !res.writableFinished;
  try {
    if (req.aborted || res.destroyed) { abort(); return; }
    let input;
    try { input = validateAIInput(req.body); }
    catch (error) { return res.status(400).json({ code: 400, message: error.message }); }
    const { messages, birthInfo, gender, stream: requested } = input;
    const params = { messages, birthInfo, gender, userId: req.user?.userId || null, signal };
    if (requested === false) {
      const data = council
        ? { opinions: await multiAgentService.councilNonStream(params) }
        : { content: await aiService.chat({ ...params, stream: false }) };
      if (connected()) res.json({ code: 0, data });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    if (council) {
      activeStream = multiAgentService.councilStream(params);
      // Keep cancellation listeners alive until this readable finishes or disconnects.
      await new Promise((resolve, reject) => {
        const onData = chunk => { if (connected()) res.write(chunk); };
        const cleanup = () => {
          activeStream.removeListener('data', onData);
          activeStream.removeListener('end', onEnd);
          activeStream.removeListener('close', onEnd);
          activeStream.removeListener('error', onError);
        };
        const onEnd = () => { cleanup(); resolve(); };
        const onError = error => { cleanup(); reject(error); };
        activeStream.on('data', onData);
        activeStream.once('end', onEnd);
        activeStream.once('close', onEnd);
        activeStream.once('error', onError);
        if (signal.aborted) activeStream.destroy();
      });
    } else {
      activeStream = await aiService.chat({ ...params, stream: true });
      for await (const chunk of activeStream) {
        if (!connected()) break;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) res.write('data: ' + JSON.stringify({ content }) + '\n\n');
      }
      if (connected()) res.write('data: [DONE]\n\n');
    }
    if (connected()) res.end();
  } catch (error) {
    if (!connected()) return;
    console.error('AI request failed:', error);
    if (!res.headersSent) return res.status(503).json({ code: 503, message: publicError });
    res.write('data: ' + JSON.stringify({ error: publicError }) + '\n\n');
    res.end();
  } finally {
    req.removeListener('aborted', abort);
    res.removeListener('close', onClose);
  }
}

exports.chatStream = (req, res, next) => respond(req, res, next, false);
exports.councilStream = (req, res, next) => respond(req, res, next, true);
