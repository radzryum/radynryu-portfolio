<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'config.php';
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');
try {
    $pdo->query("SELECT 1");
} catch (PDOException $e) {
    die(json_encode(['success' => false, 'message' => 'Database connection failed']));
}
try {
    // Verify request method
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405); // Method Not Allowed
        throw new Exception('Invalid request method');
    }

    // Get and validate input
    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400); // Bad Request
        throw new Exception('Invalid JSON input');
    }

    // Check required fields
    $required = ['table', 'date', 'time', 'status', 'created_at', 
                'name', 'phone', 'email'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400); // Bad Request
            throw new Exception("Missing required field: $field");
        }
    }

    // Check user session
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401); // Unauthorized
        throw new Exception('User not logged in');
    }

    // Check table availability
    $stmt = $pdo->prepare("
        SELECT t.id 
        FROM cafe_tables t
        LEFT JOIN reservations r ON t.table_number = r.table_number 
            AND r.reservation_date = ? 
            AND r.reservation_time = ?
            AND r.status != 'cancelled'
        WHERE t.table_number = ? AND r.id IS NULL
    ");
    $stmt->execute([$input['date'], $input['time'], $input['table']]);
    
    if ($stmt->rowCount() === 0) {
        http_response_code(409); // Conflict
        throw new Exception('Table is not available for the selected time');
    }

    // Create reservation
    $stmt = $pdo->prepare("
        INSERT INTO reservations 
        (user_id, table_number, reservation_date, reservation_time, 
         special_requests, created_at, status, 
         customer_name, customer_phone, customer_email, occasion) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $success = $stmt->execute([
        $_SESSION['user_id'],
        $input['table'],
        $input['date'],
        $input['time'],
        $input['requests'] ?? '',
        $input['created_at'],
        $input['status'],
        $input['name'],
        $input['phone'],
        $input['email'],
        $input['occasion'] ?? 'none'
    ]);

    if (!$success) {
        http_response_code(500); // Internal Server Error
        throw new Exception('Failed to create reservation');
    }

    // Success response
    echo json_encode([
        'success' => true,
        'message' => 'Reservation successful',
        'reservation' => [
            'id' => $pdo->lastInsertId(),
            'table_number' => $input['table'],
            'reservation_date' => $input['date'],
            'reservation_time' => $input['time'],
            'status' => $input['status']
        ]
    ]);

} catch (Exception $e) {
    // Error response
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'error_code' => http_response_code()
    ]);
}
?>