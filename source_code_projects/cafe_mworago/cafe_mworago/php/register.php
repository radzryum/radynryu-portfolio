<?php
require_once 'config.php';

// Set header first
header('Content-Type: application/json');

// Get input data
$data = json_decode(file_get_contents('php://input'), true);

// Validate input
if (empty($data['username']) || empty($data['email']) || empty($data['password'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'All fields are required',
        'received_data' => $data // For debugging
    ]);
    exit;
}

try {
    // Check if user exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$data['username'], $data['email']]);
    
    if ($stmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Username or email already exists'
        ]);
        exit;
    }
    
    // Hash password
    $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
    
    // Insert user
    $stmt = $pdo->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
    $stmt->execute([$data['username'], $data['email'], $hashedPassword]);
    
    // Return success with user data (excluding password)
    echo json_encode([
        'success' => true,
        'message' => 'Registration successful',
        'user' => [
            'id' => $pdo->lastInsertId(),
            'username' => $data['username'],
            'email' => $data['email']
        ]
    ]);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error',
        'error' => $e->getMessage()
    ]);
    exit;
}
?>