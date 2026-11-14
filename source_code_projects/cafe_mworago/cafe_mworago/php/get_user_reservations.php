<?php
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT id, table_number, reservation_date, reservation_time, 
               special_requests, status, created_at 
        FROM reservations 
        WHERE user_id = ? 
        ORDER BY reservation_date DESC, reservation_time DESC
        LIMIT 50
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $reservations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'reservations' => $reservations
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>