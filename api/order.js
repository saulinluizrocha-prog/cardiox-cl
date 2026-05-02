const https = require('https');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Location', '/');
    res.status(302).end();
    return;
  }

  const token = 'YZA0ZJDLZWYTZDK4ZC00YMJJLWJJNJATODZKNGJJMTE2MZQ4';
  const stream_code = '40myd';
  const body = req.body || {};

  if (!body.name || !body.phone) {
    res.setHeader('Location', '/');
    res.status(302).end();
    return;
  }

  const post_fields = {
    stream_code: stream_code,
    client: {
      phone: body.phone,
      name: body.name,
      surname: body.surname || null,
      email: body.email || null,
      address: body.address || null,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      country: body.country || 'CL',
      city: body.city || null,
      postcode: body.postcode || null,
    },
    sub1: body.sub1 || req.query.sub1 || null,
    sub2: body.sub2 || req.query.sub2 || null,
    sub3: body.sub3 || req.query.sub3 || null,
    sub4: body.sub4 || req.query.sub4 || null,
    sub5: body.sub5 || req.query.sub5 || null,
  };

  const payload = JSON.stringify(post_fields);

  const options = {
    hostname: 'order.drcash.sh',
    port: 443,
    path: '/v1/order',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  try {
    const response = await new Promise((resolve, reject) => {
      const request = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => resolve({ code: res.statusCode, body: responseBody }));
      });
      request.on('error', (err) => reject(err));
      request.write(payload);
      request.end();
    });

    let redirectUrl = '/success.html';
    if (response.code === 200) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomId = '';
      for (let i = 0; i < 7; i++) {
        randomId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      redirectUrl += '?id=' + randomId + '-CL';
    }

    res.setHeader('Location', redirectUrl);
    res.status(302).end();
  } catch (err) {
    console.error('API Error:', err.message);
    res.setHeader('Location', '/success.html');
    res.status(302).end();
  }
};
