<?php
if (!function_exists('curl_version')) {
    echo 'Curl is not installed';
}

if ($_SERVER["REQUEST_METHOD"]=="POST") {
    // Required params
    $token = 'YZA0ZJDLZWYTZDK4ZC00YMJJLWJJNJATODZKNGJJMTE2MZQ4';
    $stream_code = 'celab';

    $ip = $_SERVER['REMOTE_ADDR'];
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    }

    // Fields to send
    $post_fields = [
        'stream_code'   => $stream_code,    // required
        'client'        => [
            'phone'     => $_POST['phone'] ?? '', // required
            'name'      => $_POST['name'] ?? '',
            'surname'   => empty($_POST['surname']) ? null : $_POST['surname'],
            'email'     => empty($_POST['email']) ? null : $_POST['email'],
            'address'   => empty($_POST['address']) ? null : $_POST['address'],
            'ip'        => empty($_POST['ip']) ? $ip : $_POST['ip'],
            'country'   => empty($_POST['country']) ? 'CL' : $_POST['country'],
            'city'      => empty($_POST['city']) ? null : $_POST['city'],
            'postcode'  => empty($_POST['postcode']) ? null : $_POST['postcode'],
        ],
        'sub1'      => empty($_POST['sub1']) ? ($_GET['sub1'] ?? null) : $_POST['sub1'],
        'sub2'      => empty($_POST['sub2']) ? ($_GET['sub2'] ?? null) : $_POST['sub2'],
        'sub3'      => empty($_POST['sub3']) ? ($_GET['sub3'] ?? null) : $_POST['sub3'],
        'sub4'      => empty($_POST['sub4']) ? ($_GET['sub4'] ?? null) : $_POST['sub4'],
        'sub5'      => empty($_POST['sub5']) ? ($_GET['sub5'] ?? null) : $_POST['sub5'],
    ];

    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL,"https://order.drcash.sh/v1/order");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($post_fields));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close ($ch);

    $redirectUrl = '/success.html';
    if ($httpcode == 200) {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $randomId = '';
        for ($i = 0; $i < 7; $i++) {
            $randomId .= $chars[rand(0, strlen($chars) - 1)];
        }
        $redirectUrl .= '?id=' . $randomId . '-CL';
    }

    header('Location: ' . $redirectUrl);
    exit;
} else {
    header('Location: /');
    exit;
}
?>