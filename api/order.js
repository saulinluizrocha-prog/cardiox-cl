const https = require('https');

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */
const TOKEN       = 'YZA0ZJDLZWYTZDK4ZC00YMJJLWJJNJATODZKNGJJMTE2MZQ4';
const STREAM_CODE = '40myd';
const API_HOST    = 'order.drcash.sh';
const API_PATH    = '/v1/order';

/* ============================================================
   NORMALIZAÇÃO DE TELEFONE — CHILE (defesa em profundidade)
   ============================================================ */
function normalizeChilePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');

  // 0056... → 56...
  if (digits.startsWith('0056')) return '+' + digits.slice(2);
  // 56 + 9 dígitos ou 56 + 8 dígitos
  if (digits.startsWith('56') && digits.length >= 10 && digits.length <= 11) return '+' + digits;
  // 9 + 8 dígitos (local mobile) = 9 dígitos totais
  if (digits.startsWith('9') && digits.length === 9) return '+56' + digits;
  // 8 dígitos (sem o 9)
  if (digits.length === 8) return '+569' + digits;
  // 9 dígitos locais (fixo com código de área)
  if (digits.length === 9) return '+56' + digits;

  return null;
}

function isValidPhone(normalized) {
  return normalized && /^\+56\d{9}$/.test(normalized);
}

/* ============================================================
   HANDLER PRINCIPAL
   ============================================================ */
module.exports = async function handler(req, res) {

  // Só aceita POST
  if (req.method !== 'POST') {
    res.setHeader('Location', '/');
    return res.status(302).end();
  }

  const body  = req.body  || {};
  const query = req.query || {};

  // Campos obrigatórios
  const rawName  = (body.name  || '').trim();
  const rawPhone = (body.phone || '').trim();

  if (!rawName || !rawPhone) {
    console.warn('[cardiox-cl] Lead rejeitado: nome ou telefone ausente');
    res.setHeader('Location', '/');
    return res.status(302).end();
  }

  // Normalizar telefone
  const normalizedPhone = normalizeChilePhone(rawPhone);
  if (!isValidPhone(normalizedPhone)) {
    console.warn('[cardiox-cl] Telefone inválido após normalização:', rawPhone);
    // Redireciona de volta à LP com flag de erro
    res.setHeader('Location', '/?phone_error=1');
    return res.status(302).end();
  }

  // Captura de rastreamento — body tem prioridade, query é fallback
  const gclid = body.gclid || query.gclid || '';
  const sub1  = body.sub1  || query.sub1  || gclid || ''; // gclid → sub1 se sub1 vazio
  const sub2  = body.sub2  || query.sub2  || '';
  const sub3  = body.sub3  || query.sub3  || '';
  const sub4  = body.sub4  || query.sub4  || '';
  const sub5  = body.sub5  || query.sub5  || '';

  // IP do visitante
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || null;

  console.log(`[cardiox-cl] Novo lead | nome: ${rawName} | tel: ${normalizedPhone} | sub1: ${sub1} | ip: ${ip}`);

  /* ============================================================
     PAYLOAD PARA DR CASH
     ============================================================ */
  const payload = JSON.stringify({
    stream_code : STREAM_CODE,
    client: {
      phone   : normalizedPhone,
      name    : rawName,
      surname : body.surname || null,
      email   : body.email   || null,
      address : body.address || null,
      ip      : ip,
      country : 'CL',
      city    : body.city     || null,
      postcode: body.postcode || null,
    },
    sub1 : sub1  || null,
    sub2 : sub2  || null,
    sub3 : sub3  || null,
    sub4 : sub4  || null,
    sub5 : sub5  || null,
  });

  const options = {
    hostname: API_HOST,
    port    : 443,
    path    : API_PATH,
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Authorization' : 'Bearer ' + TOKEN,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  /* ============================================================
     ENVIO PARA A API + REDIRECT
     ============================================================ */
  try {
    const response = await new Promise((resolve, reject) => {
      const request = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => (data += chunk));
        apiRes.on('end', () => resolve({ code: apiRes.statusCode, body: data }));
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy(new Error('API timeout'));
      });

      request.write(payload);
      request.end();
    });

    // Gerar ID de pedido legível para a success page
    const chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomId = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const orderId  = randomId + '-CL';

    const nameEncoded = encodeURIComponent(rawName);
    const successUrl  = `/cl-success.html?id=${orderId}&name=${nameEncoded}`;

    if (response.code !== 200) {
      console.error('[cardiox-cl] API retornou status:', response.code, response.body);
    }

    res.setHeader('Location', successUrl);
    return res.status(302).end();

  } catch (err) {
    console.error('[cardiox-cl] Erro ao chamar API:', err.message);
    res.setHeader('Location', '/cl-success.html');
    return res.status(302).end();
  }
};
