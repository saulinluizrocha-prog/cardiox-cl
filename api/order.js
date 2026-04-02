const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const CONFIG = {
  api_key: 'c66289394c2a6e8515c8e8b382fba719',
  offer_id: '6999',
  user_id: '75329',
  api_domain: 'https://t-api.org',
};

function checkSum(jsonData) {
  return crypto.createHash('sha1').update(jsonData + CONFIG.api_key).digest('hex');
}

function makeRequest(data, model, method) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      user_id: CONFIG.user_id,
      data: data,
    });

    const checkSumValue = checkSum(payload);
    const apiUrl = `${CONFIG.api_domain}/api/${model}/${method}?check_sum=${checkSumValue}`;

    const url = new URL(apiUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          http_code: res.statusCode,
          result: body,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Location', '/');
    res.status(302).end();
    return;
  }

  const body = req.body || {};

  if (!body.name || !body.phone) {
    res.setHeader('Location', '/');
    res.status(302).end();
    return;
  }

  const notRequireParams = [
    'tz', 'address', 'region', 'city', 'zip', 'stream_id', 'count',
    'email', 'user_comment', 'utm_source', 'utm_medium', 'utm_campaign',
    'utm_term', 'utm_content', 'sub_id', 'sub_id_1', 'sub_id_2',
    'sub_id_3', 'sub_id_4', 'referer', 'user_agent', 'ip',
  ];

  const data = {
    name: (body.name || '').trim(),
    phone: (body.phone || '').trim(),
    offer_id: CONFIG.offer_id,
    country: (body.country || 'CL').trim(),
  };

  // Add optional params
  const allParams = { ...body, ...(req.query || {}) };
  for (const key of notRequireParams) {
    if (allParams[key] !== undefined && allParams[key] !== null) {
      data[key] = allParams[key];
    }
  }

  // Add referer
  if (!data.referer && req.headers.referer) {
    data.referer = req.headers.referer;
  }

  try {
    const response = await makeRequest(data, 'lead', 'create');

    if (response.http_code === 200) {
      const result = JSON.parse(response.result);
      if (result.status === 'ok') {
        res.setHeader('Location', '/success.html?id=' + (result.data.id || ''));
        res.status(302).end();
        return;
      } else if (result.status === 'error') {
        // Redirect to success anyway to avoid showing error to user
        res.setHeader('Location', '/success.html');
        res.status(302).end();
        return;
      }
    }

    // Fallback: redirect to success
    res.setHeader('Location', '/success.html');
    res.status(302).end();
  } catch (err) {
    console.error('API Error:', err.message);
    res.setHeader('Location', '/success.html');
    res.status(302).end();
  }
};
