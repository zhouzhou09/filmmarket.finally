const BACKEND_URL = "http://47.110.90.38:3001";

exports.handler = async (event) => {
  const backendUrl = BACKEND_URL + "/uploads" + event.path + (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : '');

  const headers = {};
  const passHeaders = ['content-type', 'authorization'];
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
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      },
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
