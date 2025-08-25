<?php

define("a328763fe27bba", "TRUE");

// Headers
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . "/utils/cookieHelper.php"; // Include cookie helper

function loadEnv($path)
{
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue; // skip comments
        }
        [$name, $value] = array_map('trim', explode('=', $line, 2));
        $value = trim($value, '"'); // remove optional quotes
        $_ENV[$name] = $value;
    }
}

// Load .env in the current folder
loadEnv(__DIR__ . '/.env');


// Include DB connection
require_once("config.php");

// Main login handler
function login()
{
    $data = json_decode(file_get_contents("php://input"), true);

    $username = trim($data["username"] ?? "");
    $password = ($data["password"] ?? "");
    $otp = trim($data["otp"] ?? "");
    $honeypot = trim($data["honeypot"] ?? "");
    $mode = $data["mode"] ?? "";

    // Bot check
    if (!empty($honeypot)) {
        echo json_encode(["success" => false, "message" => "Problem logging in."]);
        exit;
    }

    if ($username === "") {
        echo json_encode(["success" => false, "message" => "Username is required."]);
        exit;
    }

    switch ($mode) {
        case "login":
            verifyUser($username, $password);
            break;

        case "request_otp":
            requestOtp($username);
            break;

        case "verify_otp":
            verifyOtp($username, $otp);
            break;

        default:
            echo json_encode(["success" => false, "message" => "Invalid mode."]);
            break;
    }
}

function verifyUser($username, $password)
{
    // Fetch user for login
    $result = mysql_fetch_array(
        "SELECT id, username, password FROM users WHERE username = ? LIMIT 1",
        [$username]
    );
    if (!$result || count($result) === 0) {
        echo json_encode(["success" => false, "message" => "Invalid username or password."]);
        exit;
    }
    $user = $result[0];

    if ($password === "") {
        echo json_encode(["success" => false, "message" => "Password required."]);
        exit;
    }
    if (!password_verify($password, $user["password"])) {
        echo json_encode(["success" => false, "message" => "Invalid username or password."]);
        exit;
    }

    requestOtp($username); // Request OTP on successful login
}

function requestOtp($username)
{
    // Fetch user email and rate-limit info
    $result = mysql_fetch_array(
        "SELECT id, email, otp, otp_expires, otp_last_sent, otp_count_hour, otp_count_day, otp_hour_reset, otp_day_reset
         FROM users WHERE username = ? LIMIT 1",
        [$username]
    );

    if (!$result || count($result) === 0) {
        echo json_encode(["success" => false, "message" => "User not found."]);
        exit;
    }

    $user = $result[0];

    // Check rate limits
    $rateCheck = checkOtpRateLimit($user);
    if (!$rateCheck['success']) {
        echo json_encode($rateCheck);
        exit;
    }
    $user = $rateCheck['user'];

    // Generate OTP
    $otp_code = str_pad(rand(0, 999999), 6, "0", STR_PAD_LEFT);
    $expires_at = date('Y-m-d H:i:s', time() + 600); // 10 min

    // Update user in DB
    mysql_update(
        "users",
        [
            "otp" => $otp_code,
            "otp_expires" => $expires_at,
            "otp_last_sent" => date('Y-m-d H:i:s'),
            "otp_count_hour" => $user['otp_count_hour'] + 1,
            "otp_hour_reset" => $user['otp_hour_reset'],
            "otp_count_day" => $user['otp_count_day'] + 1,
            "otp_day_reset" => $user['otp_day_reset']
        ],
        ["id" => $user["id"]]
    );

    // Send OTP via Brevo
    $url = 'https://api.brevo.com/v3/smtp/email';
    $headers = [
        'accept: application/json',
        'api-key: ' . $_ENV['BREVO_API_KEY'],
        'content-type: application/json'
    ];
    $payload = [
        'sender' => [
            'name' => $_ENV['BREVO_SENDER_NAME'],
            'email' => $_ENV['BREVO_SENDER_EMAIL']
        ],
        'to' => [
            ['email' => $user['email'], 'name' => $username]
        ],
        'subject' => 'Your OTP',
        'htmlContent' => "<html><body>Your OTP is: " . $otp_code . "</body></html>"
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    $response = curl_exec($ch);
    curl_close($ch);

    $resp = json_decode($response, true);
    if (isset($resp['messageId'])) {
        echo json_encode(["success" => true, "message" => "OTP sent successfully."]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to send OTP."]);
    }
}

function verifyOtp($username, $otp)
{
    // Fetch user for OTP verification
    $result = mysql_fetch_array(
        "SELECT id, otp, otp_expires FROM users WHERE username = ? LIMIT 1",
        [$username]
    );
    if (!$result || count($result) === 0) {
        echo json_encode(["success" => false, "message" => "User not found."]);
        exit;
    }
    $user = $result[0];

    if ($otp === "") {
        echo json_encode(["success" => false, "message" => "OTP is required."]);
        exit;
    }
    if ($otp !== $user["otp"]) {
        echo json_encode(["success" => false, "message" => "Invalid OTP."]);
        exit;
    }
    if (strtotime($user["otp_expires"]) < time()) {
        echo json_encode(["success" => false, "message" => "Expired OTP"]);
        exit;
    }

    // Generate token valid for 1 hour
    $tokenLifetime = 3600;
    $token = bin2hex(random_bytes(32));
    $token_expires = date('Y-m-d H:i:s', time() + $tokenLifetime);

    mysql_update(
        "users",
        ["token" => $token, "token_expires" => $token_expires, "otp" => null, "otp_expires" => null],
        ["id" => $user["id"]]
    );

    // Set cookie
    setAppCookie(COOKIE_TOKEN, $token, $tokenLifetime);

    echo json_encode([
        "success" => true,
        "message" => "OTP verified. Login successful.",
        "user" => ["id" => $user["id"], "username" => $user["username"] ?? $username]
    ]);
}

// Handles rate limiting for OTP requests
function checkOtpRateLimit($user)
{
    $now = time();
    $currentHour = date('Y-m-d H:00:00', $now);
    $currentDay = date('Y-m-d', $now);

    // 30-second cooldown
    if ($user['otp_last_sent'] && strtotime($user['otp_last_sent']) > $now - 30) {
        return ["success" => false, "message" => "Please wait 30 seconds before requesting a new OTP."];
    }

    // Reset hourly counter if new hour
    if (!$user['otp_hour_reset'] || strtotime($user['otp_hour_reset']) < strtotime($currentHour)) {
        $user['otp_count_hour'] = 0;
        $user['otp_hour_reset'] = $currentHour;
    }

    // Reset daily counter if new day
    if (!$user['otp_day_reset'] || $user['otp_day_reset'] < $currentDay) {
        $user['otp_count_day'] = 0;
        $user['otp_day_reset'] = $currentDay;
    }

    // Max limits
    if ($user['otp_count_hour'] >= 4) {
        return ["success" => false, "message" => "You have reached the maximum of 4 OTPs per hour."];
    }
    if ($user['otp_count_day'] >= 10) {
        return ["success" => false, "message" => "You have reached the maximum of 10 OTPs per day."];
    }

    // Passed all checks
    return ["success" => true, "user" => $user];
}

// Call main function
login();
