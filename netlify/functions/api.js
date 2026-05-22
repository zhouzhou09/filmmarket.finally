const BACKEND_URL = "http://47.110.90.38:3001";

exports.handler = async (event) => {
  // Netlify strips the function path, so event.path is like "/auth/register"
  // We need to add back the "/api" prefix
  const backendUrl = BACKEND_URL + event.path + (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : '');

  const headers = {};
  const passHeaders = ['content-type', 'authorization', 'x-requested-with', 'cookie'];
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

    const respHeaders = {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    };

    return {
      statusCode: response.status,
      headers: respHeaders,
      body: data,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '后端服务暂时不可用', detail: error.message }),
    };
  }
};
