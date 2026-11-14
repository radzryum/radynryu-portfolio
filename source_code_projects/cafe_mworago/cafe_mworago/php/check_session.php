<?php
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$response = [
    'loggedIn' => isset($_SESSION['user_id']),
    'user' => isset($_SESSION['user_id']) ? [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username']
    ] : null
];

echo json_encode($response);
?>