<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['table_number'])) {
        echo json_encode(['success' => false, 'message' => 'Table number is required']);
        exit;
    }

    $tableNumber = $input['table_number'];

    // Database connection
    $conn = new mysqli('localhost', 'root', '', 'cafe_database');

    if ($conn->connect_error) {
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }

    // Check if the table already exists
    $checkStmt = $conn->prepare("SELECT COUNT(*) FROM cafe_tables WHERE table_number = ?");
    $checkStmt->bind_param('i', $tableNumber);
    $checkStmt->execute();
    $checkStmt->bind_result($count);
    $checkStmt->fetch();
    $checkStmt->close();

    if ($count > 0) {
        echo json_encode(['success' => false, 'message' => 'Table already exists']);
        $conn->close();
        exit;
    }

    // Insert table into cafe_tables
    $stmt = $conn->prepare("INSERT INTO cafe_tables (table_number) VALUES (?)");
    $stmt->bind_param('i', $tableNumber);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Table added successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to add table']);
    }

    $stmt->close();
    $conn->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}
?>
