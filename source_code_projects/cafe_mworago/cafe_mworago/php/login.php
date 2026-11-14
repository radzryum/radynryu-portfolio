<?php
require_once 'config.php';

header('Content-Type: application/json');

// Get input
$data = json_decode(file_get_contents('php://input'), true);
$login = $data['login'] ?? '';
$password = $data['password'] ?? '';

// Validate
if (empty($login) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit;
}

try {
    // Database query
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();
    
    if ($user && password_verify($password, $user['password'])) {
        // Successful login
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        
        unset($user['password']);
        echo json_encode([
            'success' => true,
            'user' => $user,
            'message' => 'Login successful'
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error']);
}
?>