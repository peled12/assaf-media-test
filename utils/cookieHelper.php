<?php
$cookieOptions = [
    "path" => "/",
    "secure" => false,
    "httponly" => true,
    "samesite" => "Lax"
];

// Cookie names
define('COOKIE_TOKEN', 'token');

function setAppCookie($name, $value, $expire = 3600) {
    global $cookieOptions;
    setcookie($name, $value, array_merge($cookieOptions, ["expires" => time() + $expire]));
}

function deleteAppCookie($name) {
    global $cookieOptions;
    setcookie($name, "", array_merge($cookieOptions, ["expires" => time() - 3600]));
}
