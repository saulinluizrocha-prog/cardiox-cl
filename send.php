<?php
/**
 * send.php — Backend Cardiox Chile (Hostinger / cPanel)
 * Equivalente ao api/order.js do Vercel
 *
 * Aguardando: TOKEN e STREAM_CODE da nova campanha na DR Cash
 */

/* ============================================================
   CONFIGURAÇÃO — preencher com os dados do novo stream
   ============================================================ */
define('DR_TOKEN',      'COLE_SEU_TOKEN_AQUI');
define('DR_STREAM',     'COLE_SEU_STREAM_CODE_AQUI');
define('DR_API_URL',    'https://order.drcash.sh/v1/order');
define('SUCCESS_PAGE',  'cl-success.html');
define('HOME_PAGE',     'index.html');

/* ============================================================
   HELPERS
   ============================================================ */

// Só aceita POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . HOME_PAGE);
    exit;
}

// Pega campo do POST com fallback seguro
function post(string $key, string $default = ''): string {
    return isset($_POST[$key]) ? trim($_POST[$key]) : $default;
}

// Pega campo do GET com fallback seguro
function get(string $key, string $default = ''): string {
    return isset($_GET[$key]) ? trim($_GET[$key]) : $default;
}

/* ============================================================
   NORMALIZAÇÃO DE TELEFONE — CHILE
   Aceita: +569..., 569..., 0056..., 9XXXXXXXX, XXXXXXXX
   Normaliza para: +56XXXXXXXXX
   ============================================================ */
function normalizeChilePhone(string $raw): ?string {
    // Remove tudo que não for dígito
    $digits = preg_replace('/\D/', '', $raw);

    // 0056... → 56...
    if (str_starts_with($digits, '0056')) {
        $digits = substr($digits, 2);
    }

    // Já tem código do país: 56 + 8 ou 9 dígitos
    if (str_starts_with($digits, '56') && strlen($digits) >= 10 && strlen($digits) <= 11) {
        return '+' . $digits;
    }

    // Formato local: 9 dígitos começando com 9 (celular)
    if (str_starts_with($digits, '9') && strlen($digits) === 9) {
        return '+56' . $digits;
    }

    // 8 dígitos sem o 9 na frente
    if (strlen($digits) === 8) {
        return '+569' . $digits;
    }

    // 9 dígitos locais (fixo com código de área)
    if (strlen($digits) === 9) {
        return '+56' . $digits;
    }

    return null; // inválido
}

function isValidPhone(?string $normalized): bool {
    return $normalized && preg_match('/^\+56\d{9}$/', $normalized);
}

/* ============================================================
   VALIDAÇÕES
   ============================================================ */
$name     = post('name');
$rawPhone = post('phone');

if (empty($name) || empty($rawPhone)) {
    header('Location: ' . HOME_PAGE . '?error=missing_fields');
    exit;
}

$normalizedPhone = normalizeChilePhone($rawPhone);

if (!isValidPhone($normalizedPhone)) {
    // Volta pra LP com flag de erro (script_land.js pode mostrar mensagem)
    header('Location: ' . HOME_PAGE . '?phone_error=1');
    exit;
}

/* ============================================================
   CAPTURA DE RASTREAMENTO
   gclid vai para sub1 se sub1 estiver vazio
   ============================================================ */
$gclid = post('gclid') ?: get('gclid');
$sub1  = post('sub1')  ?: get('sub1') ?: $gclid;
$sub2  = post('sub2')  ?: get('sub2');
$sub3  = post('sub3')  ?: get('sub3');
$sub4  = post('sub4')  ?: get('sub4');
$sub5  = post('sub5')  ?: get('sub5');

// IP real do visitante (considera proxy/CDN)
$ip = $_SERVER['HTTP_X_FORWARDED_FOR']
    ? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]
    : ($_SERVER['REMOTE_ADDR'] ?? null);

/* ============================================================
   PAYLOAD PARA DR CASH
   ============================================================ */
$payload = json_encode([
    'stream_code' => DR_STREAM,
    'client'      => [
        'phone'   => $normalizedPhone,
        'name'    => $name,
        'surname' => post('surname') ?: null,
        'email'   => post('email')   ?: null,
        'address' => post('address') ?: null,
        'ip'      => $ip,
        'country' => 'CL',
        'city'    => post('city')    ?: null,
        'postcode'=> post('postcode') ?: null,
    ],
    'sub1' => $sub1 ?: null,
    'sub2' => $sub2 ?: null,
    'sub3' => $sub3 ?: null,
    'sub4' => $sub4 ?: null,
    'sub5' => $sub5 ?: null,
]);

/* ============================================================
   ENVIO VIA cURL PARA DR CASH API
   ============================================================ */
$ch = curl_init(DR_API_URL);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . DR_TOKEN,
        'Content-Length: ' . strlen($payload),
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

/* ============================================================
   REDIRECT PARA SUCCESS PAGE
   Passa nome e ID para personalização
   ============================================================ */
$chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
$orderId  = '';
for ($i = 0; $i < 7; $i++) {
    $orderId .= $chars[random_int(0, strlen($chars) - 1)];
}
$orderId .= '-CL';

$nameEncoded = urlencode($name);
$successUrl  = SUCCESS_PAGE . '?id=' . $orderId . '&name=' . $nameEncoded;

header('Location: ' . $successUrl);
exit;
