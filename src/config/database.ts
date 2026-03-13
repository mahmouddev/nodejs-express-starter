import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const {DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT} = process.env;

const db = mysql.createPool({
    host : DB_HOST,
    user : DB_USER,
    password : DB_PASSWORD,
    database : DB_NAME,
    port : Number(DB_PORT)
})

export default db
