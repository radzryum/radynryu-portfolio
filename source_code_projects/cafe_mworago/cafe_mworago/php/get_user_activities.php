<?php
require_once 'config.php';

header('Content-Type: application/json');

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$userId = $_SESSION['user_id'];

try {
    // Get notifications
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5");
    $stmt->execute([$userId]);
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get recent activities
    $stmt = $pdo->prepare("SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 5");
    $stmt->execute([$userId]);
    $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get upcoming reservations
    $stmt = $pdo->prepare("SELECT * FROM reservations 
                          WHERE user_id = ? AND status = 'confirmed' 
                          AND CONCAT(reservation_date, ' ', reservation_time) >= NOW()
                          ORDER BY reservation_date, reservation_time LIMIT 3");
    $stmt->execute([$userId]);
    $reservations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'notifications' => $notifications,
        'activities' => $activities,
        'reservations' => $reservations
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>