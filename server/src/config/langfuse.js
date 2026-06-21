const { Langfuse } = require('langfuse');

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;
const host = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

let langfuse = null;

// 判断是否有 Langfuse 密钥，若无则跳过（非强依赖，保证代码对无监控环境的兼容性）
if (publicKey && secretKey) {
  langfuse = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: host,
  });
  console.log('[Langfuse] 链路追踪初始化成功！');
} else {
  console.log('[Langfuse] 未检测到公私钥环境变量，链路追踪处于关闭状态。');
}

module.exports = langfuse;
