<?php
header('Content-Type: application/json');

try {
    // Database connection
    $conn = new mysqli('localhost', 'root', '', 'kpop_cafe');

    if ($conn->connect_error) {
        throw new Exception('Database connection failed: ' . $conn->connect_error);
    }

    // Get JSON input
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['table_number'], $data['capacity'], $data['location'])) {
        throw new Exception('Invalid input data');
    }

    // Prepare and execute SQL query (exclude id as it should be auto-incremented)
    $stmt = $conn->prepare("INSERT INTO cafe_tables (table_number, capacity, location) VALUES (?, ?, ?)");
    $stmt->bind_param('iis', $data['table_number'], $data['capacity'], $data['location']);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Failed to save table details: ' . $stmt->error);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
