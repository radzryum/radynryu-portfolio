CREATE DATABASE IF NOT EXISTS kpop_cafe;
USE kpop_cafe;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cafe tables
CREATE TABLE IF NOT EXISTS cafe_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_number INT NOT NULL UNIQUE,
    capacity INT NOT NULL,
    location VARCHAR(50)
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    table_number INT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    special_requests TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    occasion VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- Insert sample tables
INSERT INTO cafe_tables (table_number, capacity, location) VALUES
(1, 2, 'Window'),
(2, 4, 'Center'),
(3, 2, 'Window'),
(4, 6, 'Private'),
(5, 4, 'Center'),
(6, 2, 'Window'),
(7, 8, 'VIP'),
(8, 4, 'Patio');

-- Create a test user (password: 'password')
INSERT INTO users (username, email, password) VALUES
('testuser', 'test@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

