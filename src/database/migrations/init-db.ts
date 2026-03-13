// Write a function that:
// 1. Creates the database if it doesn't exist
// 2. Creates the tasks table with columns:
//    - id: INT AUTO_INCREMENT PRIMARY KEY
//    - title: VARCHAR(255) NOT NULL
//    - description: TEXT
//    - status: ENUM('active', 'inactive', 'completed') DEFAULT 'active'
//    - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//    - updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// 3. Export the function so app.ts can call it on startup

import db from "../../config/database";

export async function initDB() {
    
    const connection = await db.getConnection();

    // 2. Creates the tasks table with columns:
    //    - id: INT AUTO_INCREMENT PRIMARY KEY
    //    - title: VARCHAR(255) NOT NULL
    //    - description: TEXT
    //    - status: ENUM('active', 'inactive', 'completed') DEFAULT 'active'
    //    - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    //    - updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    await connection.query(`
        CREATE TABLE IF NOT EXISTS tasks (
         id INT AUTO_INCREMENT PRIMARY KEY, 
         title VARCHAR(255) NOT NULL, 
         description TEXT, 
         status ENUM('active', 'inactive', 'completed') DEFAULT 'active', 
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
         )`
        )

    await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('admin', 'user') DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`)

    await connection.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(500) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

    connection.release();

}