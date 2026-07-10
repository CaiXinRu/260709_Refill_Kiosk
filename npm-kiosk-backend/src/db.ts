import path from "path";
import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";
import { dbLog } from "./utils/logger"; // 引入日誌

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

  // 塞入測試假資料（依處方箋號補齊，避免舊資料庫缺少新測試資料）
  const seedData = [
    {
      patient: ["000012345678", "A123456789", "王小明", "1980-01-01"],
      prescription: ["QR001992", 3, 1, "2026-07-01", "2026-10-01"],
    },
    {
      patient: ["000098765432", "B234567890", "李小華", "1975-05-15"],
      prescription: ["QR002145", 2, 0, "2026-07-05", "2026-09-05"],
    },
    {
      patient: ["000055667788", "C345678901", "陳大同", "1990-12-20"],
      prescription: ["QR003456", 3, 2, "2026-06-01", "2026-11-01"],
    },
    {
      patient: ["000011223344", "D456789012", "林美玲", "1988-03-08"],
      prescription: ["QR004789", 4, 1, "2026-07-10", "2026-12-10"],
    },
  ] as const;

  for (const { patient, prescription } of seedData) {
    const [prescriptionNo] = prescription;
    const existing = await database.get("SELECT id FROM prescriptions WHERE prescription_no = ?", [prescriptionNo]);
    if (existing) continue;

    dbLog(`補齊測試假資料：${prescriptionNo}`);

    let patientRow = await database.get("SELECT id FROM patients WHERE health_card_id = ?", [patient[0]]);
    if (!patientRow) {
      const result = await database.run(
        `INSERT INTO patients (health_card_id, identity_card, name, birth_date) VALUES (?, ?, ?, ?)`,
        [...patient],
      );
      patientRow = { id: result.lastID };
    }

    await database.run(
      `INSERT INTO prescriptions (prescription_no, patient_id, total_phases, current_phase, valid_start_date, valid_end_date) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [prescriptionNo, patientRow.id, ...prescription.slice(1)],
    );
  }
}
