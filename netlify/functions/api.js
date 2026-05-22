const BACKEND_URL = "http://47.110.90.38:3001";

exports.handler = async (event) => {
  // 从路径中去掉 /api 前缀
  const proxyPath = event.path.replace('/.netlify/functions/api', '');
  const backendUrl = BACKEND_URL + proxyPath;

  // 复制必要的请求头
  const headers = {};
  const passHeaders = ['content-type', 'authorization', 'x-requested-with'];
  for (const h of passHeaders) {
    const v = event.headers[h] || event.headers[h.toLowerCase()];
    if (v) headers[h] = v;
  }

  const options = {
    method: event.httpMethod,
    headers,
  };

  if (event.body && !['GET', 'HEAD'].includes(event.httpMethod)) {
    options.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
  }

  try {
    const response = await fetch(backendUrl, options);
    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: data,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '后端服务暂时不可用', detail: error.message }),
    };
  }
};
