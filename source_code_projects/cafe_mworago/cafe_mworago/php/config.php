<?php
// Error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', false);
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_samesite', 'Strict');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Database configuration
$host = 'localhost';
$dbname = 'kpop_cafe';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}
?>