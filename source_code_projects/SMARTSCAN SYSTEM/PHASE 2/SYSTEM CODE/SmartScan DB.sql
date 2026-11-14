DROP DATABASE SmartScanDB;
CREATE DATABASE IF NOT EXISTS SmartScanDB; -- Added IF NOT EXISTS
USE SmartScanDB;

-- create table for users of the smart scan system
CREATE TABLE IF NOT EXISTS Users ( -- Added IF NOT EXISTS
	user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    pass_hash VARCHAR(255) NOT NULL,
    user_role VARCHAR(10) NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ;

-- create table for students
CREATE TABLE IF NOT EXISTS Students (
	student_id INT PRIMARY KEY, 
	student_name VARCHAR(200) NOT NULL,
	course VARCHAR(255) NOT NULL,
	student_status VARCHAR(20) NOT NULL DEFAULT 'regular',
	profile_picture_path VARCHAR(255),
	registration_date DATETIME DEFAULT CURRENT_TIMESTAMP()
) ;

-- create table for scan log history
CREATE TABLE IF NOT EXISTS Scan_Records (
	scan_id INT PRIMARY KEY AUTO_INCREMENT,
    reference_number VARCHAR(50) NOT NULL UNIQUE,
    student_id INT,	
    result VARCHAR(50) DEFAULT 'verified',
    scan_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES Students(student_id)
);

CREATE TABLE IF NOT EXISTS Scanner_Configuration (
    configuration_id INT PRIMARY KEY,
    scanner_mode VARCHAR(10) NOT NULL, 
    last_updated DATETIME
);

-- Insert Users
INSERT INTO Users (username, pass_hash, user_role)
VALUES
('admin', 'adminpass123', 'admin'),
('student', 'studentpass123', 'student');

-- Insert Students (This will now work because student_id is NOT auto-incremented)
INSERT INTO Students (student_id, student_name, course, student_status, profile_picture_path)
VALUES
(2300511 , 'Mark Justin Alzona', 'Bachelor of Science in Information Technology', 'regular', '2300511.jpg'),
(2300479 ,'Leslie Anne Madula', 'Bachelor of Science in Information Technology', 'regular', '2300479.jpg'),
(2300577 , 'Ryan Angelo Villanueva', 'Bachelor of Science in Information Technology', 'regular', '2300577.jpg'),
(2300478 , 'Radyn Ryu Maloles', 'Bachelor of Science in Information Technology', 'irregular', '2300478.jpg'),
(2300445 , 'April Joy Franco', 'Bachelor of Science in Information Technology', 'irregular', '2300445.jpg'),
(2300578 , 'Christian Carl Silan', 'Bachelor of Science in Information Technology', 'irregular', '2300578.jpg'),
(2300592 , 'Clarence Montealegre', 'Bachelor of Science in Information Technology', 'regular', '2300592.jpg'),
(2300590 , 'Angel Luis Taac-Taac', 'Bachelor of Science in Information Technology', 'regular', '2300590.jpg'),
(2300480 , 'Elrob Jhon Irabon', 'Bachelor of Science in Information Technology', 'regular', '2300480.jpg'),
(2302415 ,'Shania Magda', 'Bachelor of Science in Information Technology', 'regular', '2302415.jpg'),
(2300588 , 'Chelsea Urbina', 'Bachelor of Science in Information Technology', 'regular', '2300588.jpg');

INSERT INTO Scan_Records (reference_number, student_id, scan_datetime)
VALUES
('VR-0001-2025', 2300511, '2025-11-15 10:30:46'),
('VR-0002-2025', 2300479, '2025-11-15 10:31:04'),
('VR-0003-2025', 2300577, '2025-11-16 10:32:18'),
('VR-0004-2025', 2300478, '2025-11-17 10:33:11'),
('VR-0005-2025', 2300590, '2025-11-18 10:34:32'),
('VR-0006-2025', 2300480, '2025-11-25 10:35:44'),
('VR-0007-2025', 2302415, '2025-12-02 10:36:21'),
('VR-0008-2025', 2300588, '2025-12-07 10:37:33'),
('VR-0009-2025', 2300578, '2025-12-10 10:37:46'),
('VR-0010-2025', 2300592, '2025-12-10 10:38:02'),
('VR-0011-2025', 2300445, '2025-12-10 10:38:26');

-- DATABASE SECURITY (Simplified: Full Access, No Password)
-- NOTE: We use DROP USER IF EXISTS to ensure a clean slate.

use smartscandb;
SELECT * from students where student_id = 2300511;
update scanner_configuration set scanner_mode = 'BOTH' WHERE configuration_id = 1;
SELECT * from scan_records;
Delete from scan_records where student_id = 2300577;		
SELECT COUNT(*) FROM Scan_Records WHERE student_id = 2300555 AND DATE(scan_datetime) = CURDATE();
Select * from scanner_configuration;
