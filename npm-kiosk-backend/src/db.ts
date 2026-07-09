import path from "path";
import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: path.resolve(process.cwd(), "kiosk.db"),
    driver: sqlite3.Database,
  });

  // 開啟外鍵約束
  await db.exec("PRAGMA foreign_keys = ON");

  // 初始化資料表
  await initDatabase(db);
  return db;
}

async function initDatabase(database: Database) {
  // 1. 病患表
  await database.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      health_card_id TEXT UNIQUE,
      identity_card TEXT UNIQUE,
      name TEXT,
      birth_date TEXT
    )
  `);

  // 2. 處方箋表
  await database.exec(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_no TEXT UNIQUE,
      patient_id INTEGER,
      total_phases INTEGER,
      current_phase INTEGER,
      valid_start_date TEXT,
      valid_end_date TEXT,
      FOREIGN KEY(patient_id) REFERENCES patients(id)
    )
  `);

  // 3. 預約紀錄表
  await database.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER,
      appointment_type TEXT,
      pickup_date TEXT,
      sequence_no TEXT,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(prescription_id) REFERENCES prescriptions(id)
    )
  `);

  // 塞入測試假資料 (如果資料庫是空的)
  const patientCheck = await database.get("SELECT id FROM patients LIMIT 1");
  if (!patientCheck) {
    // 塞入一個測試病患：王小明
    const result = await database.run(
      `INSERT INTO patients (health_card_id, identity_card, name, birth_date) 
       VALUES (?, ?, ?, ?)`,
      ["000012345678", "A123456789", "王小明", "1980-01-01"],
    );

    const patientId = result.lastID;

    // 幫王小明建一張慢箋 QR001992
    await database.run(
      `INSERT INTO prescriptions (prescription_no, patient_id, total_phases, current_phase, valid_start_date, valid_end_date) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["QR001992", patientId, 3, 1, "2026-07-01", "2026-10-01"],
    );
    console.log("溫馨提醒：已成功初始化測試假資料！");
  }
}
