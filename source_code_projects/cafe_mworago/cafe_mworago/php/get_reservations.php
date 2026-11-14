<?php
require_once 'config.php';

header('Content-Type: application/json');

$date = $_GET['date'] ?? '';
$time = $_GET['time'] ?? '';

if (empty($date) || empty($time)) {
    http_response_code(400);
    echo json_encode(['error' => 'Date and time are required']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT table_number FROM reservations 
                          WHERE reservation_date = ? 
                          AND reservation_time = ?");
    $stmt->execute([$date, $time]);
    $reservedTables = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    
    echo json_encode($reservedTables);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>