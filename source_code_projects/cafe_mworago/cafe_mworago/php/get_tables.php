<?php
require_once 'config.php';

header('Content-Type: application/json');

try {
    // Validate input
    $date = $_GET['date'] ?? '';
    $time = $_GET['time'] ?? '';
    
    if (empty($date) || empty($time)) {
        throw new Exception('Date and time are required');
    }

    // Get all tables
    $stmt = $pdo->query("SELECT * FROM cafe_tables");
    $allTables = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get reserved tables for this timeslot
    $stmt = $pdo->prepare("SELECT table_number FROM reservations 
                          WHERE reservation_date = ? 
                          AND reservation_time = ?
                          AND status != 'cancelled'");
    $stmt->execute([$date, $time]);
    $reservedTables = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    
    // Mark reserved status
    $tables = array_map(function($table) use ($reservedTables) {
        $table['is_reserved'] = in_array($table['table_number'], $reservedTables);
        return $table;
    }, $allTables);
    
    echo json_encode([
        'success' => true,
        'tables' => $tables
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>