<?php
define("a328763fe27bba", "TRUE");

#region start
require_once("config.php");
$allowed_origins = [
    "http://localhost:3000",
    "http://localhost/Assaf_Media"
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Content type for JSON responses
header("Content-Type: application/json; charset=utf-8");


$data = $_GET["data"] ?? $_POST["data"] ?? null;
$globals["_GET_DATA"] = $data;
#endregion start

#region token validation
function validate_token($username, $token)
{
    if (!$username || !$token) {
        return false;
    }

    $query = "SELECT `token`, `token_expires` FROM users WHERE `username` = ? LIMIT 1;";
    $result = mysql_fetch_array($query, [$username]);
    $row = $result[0] ?? null;

    if (!$row)
        return false;
    if ($row['token'] !== $token)
        return false;
    if (strtotime($row['token_expires']) < time())
        return false;

    return true;
}

// Global token validation
$username = $_POST["username"] ?? $_GET["username"] ?? null;
$token = $_POST["token"] ?? $_GET["token"] ?? $_COOKIE["token"] ?? null;

// Skip token validation for logout_user
if ($data !== "logout_user") {
    if (!validate_token($username, $token)) {
        http_response_code(401);
        echo json_encode(["success" => false, "error" => "Invalid or expired token"]);
        die();
    }
}
#endregion token validation

switch ($data) {

    case "get_chats":
        #region get_chats
        $username = $_POST["username"] ?? $_GET["username"] ?? null;
        if (!$username) {
            error_log("ERROR 547389478934729837493287649827634");
            echo json_encode(false);
            die();
        }

        $limit = $_POST["limit"] ?? $_GET["limit"] ?? "6";

        $query = "
            SELECT
                m.contact_id,
                m.msg_type,
                m.msg_body,
                m.msg_datetime,
                c.contact_name,
                c.profile_picture_url
            FROM messages m
            INNER JOIN (
                SELECT contact_id, MAX(msg_datetime) AS latest_msg
                FROM messages
                WHERE belongs_to_username = ?
                GROUP BY contact_id
            ) latest
                ON m.contact_id = latest.contact_id AND m.msg_datetime = latest.latest_msg
            LEFT JOIN contacts c
                ON c.belongs_to_username = ? AND c.contact_id = m.contact_id
            WHERE m.belongs_to_username = ?
            ORDER BY m.msg_datetime DESC
            LIMIT $limit;
        ";

        $results = mysql_fetch_array($query, [$username, $username, $username]);
        echo json_encode($results);
        die();
        #endregion get_chats
        break;

    case "get_msgs":
        #region get_msgs
        $username = $_POST["username"] ?? $_GET["username"] ?? null;
        $contact_id = $_POST["contact_id"] ?? $_GET["contact_id"] ?? null;

        if (!$username) {
            error_log("ERROR 4355408743987597759348098734985739745");
            echo json_encode(false);
            die();
        }

        if (!$contact_id) {
            error_log("ERROR 43509743598567439865439786543874568743");
            echo json_encode(false);
            die();
        }

        $limit = $_POST["limit"] ?? $_GET["limit"] ?? "6";

        $query = "SELECT * FROM messages WHERE `belongs_to_username` = ? AND `contact_id` = ? ORDER BY `msg_datetime` DESC LIMIT $limit;";
        $results = mysql_fetch_array($query, [$username, $contact_id]);
        echo json_encode($results);
        die();
        #endregion get_msgs
        break;

    case "get_new_msgs":
        #region get_new_msgs
        $last_id = isset($_POST["last_id"]) ? (int) $_POST["last_id"] : (isset($_GET["last_id"]) ? (int) $_GET["last_id"] : null);
        $username = $_POST["username"] ?? $_GET["username"] ?? null;
        $contact_id = $_POST["contact_id"] ?? $_GET["contact_id"] ?? null;

        if (!$last_id) {
            error_log("ERROR 1049785978436553489267542384627363444");
            echo json_encode(false);
            die();
        }

        if (!$username) {
            error_log("ERROR 34249837498327498327478374837498273974");
            echo json_encode(false);
            die();
        }

        if (!$contact_id) {
            error_log("ERROR 34082374983279487398748392748725637861");
            echo json_encode(false);
            die();
        }

        $query = "SELECT * FROM messages WHERE `row_id` > ? AND `belongs_to_username` = ? AND `contact_id` = ? ORDER BY `msg_datetime` DESC;";
        $results = mysql_fetch_array($query, [$last_id, $username, $contact_id]);
        echo json_encode($results);
        die();
        #endregion get_new_msgs
        break;

    case "get_contact_name_by_contact_id":
        #region get_contact_name_by_contact_id
        $username = $_POST["username"] ?? $_GET["username"] ?? null;
        $contact_id = $_POST["contact_id"] ?? $_GET["contact_id"] ?? null;

        if (!$username) {
            error_log("ERROR 34984723987463278648237648723648768326");
            echo json_encode(false);
            die();
        }

        if (!$contact_id) {
            error_log("ERROR 10297830812753349873988467364764255871");
            echo json_encode(false);
            die();
        }

        $query = "SELECT `contact_name` FROM contacts WHERE `belongs_to_username` = ? AND `contact_id` = ? LIMIT 1;";
        $results = mysql_fetch_array($query, [$username, $contact_id]);
        echo json_encode($results);
        die();
        #endregion get_contact_name_by_contact_id
        break;

    case "get_profile_pic_by_contact_id":
        #region get_profile_pic_by_contact_id
        $username = $_POST["username"] ?? $_GET["username"] ?? null;
        $contact_id = $_POST["contact_id"] ?? $_GET["contact_id"] ?? null;

        if (!$username) {
            error_log("ERROR 39087443298764378263837276549873264643");
            echo json_encode(false);
            die();
        }

        if (!$contact_id) {
            error_log("ERROR 543087432896723498673427896328658437256");
            echo json_encode(false);
            die();
        }

        $query = "SELECT profile_picture_url FROM contacts WHERE `belongs_to_username` = ? AND `contact_id` = ? LIMIT 1;";
        $results = mysql_fetch_array($query, [$username, $contact_id]);
        echo json_encode($results);
        die();
        #endregion get_profile_pic_by_contact_id
        break;

    case "send_wa_txt_msg":
        #region send_wa_txt_msg
        $msg = $_POST["msg"] ?? $_GET["msg"] ?? null;
        $contact_id = $_POST["contact_id"] ?? $_GET["contact_id"] ?? null;
        $username = $_POST["username"] ?? $_GET["username"] ?? null;

        if (!$msg) {
            error_log("ERROR 34097329087643298674938647892367364647");
            echo json_encode(false);
            die();
        }

        if (!$username) {
            error_log("ERROR 35408437590347698007689068997689867866");
            echo json_encode(false);
            die();
        }

        if (!$contact_id) {
            error_log("ERROR 1115439720378540937409-095479854768954");
            echo json_encode(false);
            die();
        }

        $my_contact_id_query = "SELECT `id` FROM users WHERE `username` = ?  LIMIT 1";
        $des_username_query = "SELECT `username` FROM users WHERE `id` = ?  LIMIT 1";

        $my_contact_id = mysql_fetch_array($my_contact_id_query, [$username]);
        $des_username = mysql_fetch_array($des_username_query, [$contact_id]);

        $my_contact_id = $my_contact_id[0][0] ?? null;
        $des_username = $des_username[0][0] ?? null;

        if (!$my_contact_id || !$des_username) {
            error_log("ERROR 203987923846793274683297649238745637826458726");
            echo json_encode(false);
            die();
        }

        $results1 = mysql_insert("messages", [
            "belongs_to_username" => $username,
            "contact_id" => $contact_id,
            "is_from_me" => 1,
            "msg_type" => "text",
            "msg_body" => $msg,
        ]);

        $results2 = mysql_insert("messages", [
            "belongs_to_username" => $des_username,
            "contact_id" => $my_contact_id,
            "is_from_me" => 0,
            "msg_type" => "text",
            "msg_body" => $msg,
        ]);

        if ($results1["success"] && $results2["success"]) {
            echo json_encode(true);
            die();
        }

        echo json_encode(false);
        #endregion send_wa_txt_msg
        break;
    case "send_wa_voice_msg":
        #region send_wa_voice_msg
        $contact_id = $_POST["contact_id"] ?? $_GET["contact_id"] ?? null;
        $username = $_POST["username"] ?? $_GET["username"] ?? null;
        $audio_data = $_POST["audio_data"] ?? $_GET["audio_data"] ?? null;

        if (!$username) {
            error_log("ERROR 34987432987432987432987432987432987432");
            echo json_encode(false);
            die();
        }

        if (!$contact_id) {
            error_log("ERROR 34987432987432987432987432987432987433");
            echo json_encode(false);
            die();
        }

        if (!$audio_data) {
            error_log("ERROR 34987432987432987432987432987432987434");
            echo json_encode(false);
            die();
        }

        // Look up both users to get their IDs
        $my_contact_id_query = "SELECT `id` FROM users WHERE `username` = ? LIMIT 1";
        $des_username_query = "SELECT `username` FROM users WHERE `id` = ? LIMIT 1";

        $my_contact_id = mysql_fetch_array($my_contact_id_query, [$username]);
        $des_username = mysql_fetch_array($des_username_query, [$contact_id]);

        $my_contact_id = $my_contact_id[0][0] ?? null;
        $des_username = $des_username[0][0] ?? null;

        if (!$my_contact_id || !$des_username) {
            error_log("ERROR 203987923846793274683297649238745637826458726");
            echo json_encode(false);
            die();
        }

        // Insert for sender (is_from_me = 1)
        $results1 = mysql_insert("messages", [
            "belongs_to_username" => $username,
            "contact_id" => $contact_id,
            "is_from_me" => 1,
            "msg_type" => "audio",
            "msg_body" => $audio_data, // Store raw base64
        ]);

        // Insert for receiver (is_from_me = 0)
        $results2 = mysql_insert("messages", [
            "belongs_to_username" => $des_username,
            "contact_id" => $my_contact_id,
            "is_from_me" => 0,
            "msg_type" => "audio",
            "msg_body" => $audio_data, // Store same base64
        ]);

        if ($results1["success"] && $results2["success"]) {
            echo json_encode(true);
            die();
        }

        echo json_encode(false);
        #endregion send_wa_voice_msg
        break;
    case "delete_wa_msg":
        #region delete_wa_msg
        $msg_id = $_POST["msg_id"] ?? $_GET["msg_id"] ?? null;
        if (!$msg_id) {
            error_log("ERROR 34987432987432987432987432987432987435");
            echo json_encode(false);
            die();
        }

        // Query to change the message type to 'revoked'
        $my_msg_query = "UPDATE messages SET msg_type = 'revoked' WHERE row_id = " . (int) $msg_id;
        $des_msg_query = "UPDATE messages SET msg_type = 'revoked' WHERE row_id = " . ((int) $msg_id + 1);

        $my_msg_result = mysql_query($my_msg_query);
        $des_msg_result = mysql_query($des_msg_query); // Destination message is the next one

        if ($my_msg_result && $des_msg_result) {
            echo json_encode(["success" => true]);
            die();
        }

        echo json_encode(["success" => false, "error" => "Failed to delete message"]);
        #endregion delete_wa_msg
        break;

    case "logout_user":
        #region logout_user
        $username = $_POST["username"] ?? $_GET["username"] ?? null;
        if (!$username) {
            echo json_encode(["success" => false, "error" => "No username provided"]);
            die();
        }

        // Escape username for safety
        $escaped_username = mysqli_real_escape_string(get_mysqli_connection(), $username);

        // Invalidate the token in the database
        $query = "UPDATE users SET token = NULL, token_expires = NULL WHERE username = '$escaped_username' LIMIT 1;";
        $result = mysql_query($query);

        // Invalidate the cookie
        setcookie(
            "token",
            "",
            [
                "expires" => time() - 3600,  // past time to delete it
                "path" => "/",
                "secure" => false,           // true if using HTTPS
                "httponly" => true,
                "samesite" => "Lax"
            ]
        );

        if ($result) {
            echo json_encode(["success" => true]);
        } else {
            echo json_encode(["success" => false, "error" => "Failed to log out"]);
        }
        die();
        #endregion logout_user
        break;

}

include_all_plugins("api.php");
die();
?>