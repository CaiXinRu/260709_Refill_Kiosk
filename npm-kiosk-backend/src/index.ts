import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { getDb } from "./db";
import { validateCreateAppointment, validateVerifyPrescription } from "./middlewares/validate";

const app = express();

// 🔒 1. 安全性 Middleware：Helmet 會自動幫我們加上各種安全的 HTTP Header（防止 XSS、點擊劫持等）
app.use(helmet());

// 🔒 2. 流量限制 Middleware：防止有人用自動化腳本狂刷 Kiosk API 導致伺服器癱瘓
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 分鐘
  max: 30, // 同一個 IP 一分鐘內最多隻能請求 30 次
  message: { success: false, message: "請求過於頻繁，請稍後再試。" },
});
app.use("/api/", limiter);

app.use(cors());
app.use(express.json());

/**
 * API 1: 模擬透過 健保卡號 或 處方箋號碼 撈取慢箋資訊
 * 適用情境：民眾插卡、或掃描 QR code 後，Kiosk 畫面需要呈現「王小明先生/小姐 您好，您的慢箋資訊如下...」
 */
app.post(
  "/api/kiosk/verify-prescription",
  validateVerifyPrescription,
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { healthCardId, prescriptionNo } = req.body;
      const db = await getDb();

      let query = `
      SELECT p.name, p.identity_card, pr.id as prescription_id, pr.prescription_no, pr.total_phases, pr.current_phase, pr.valid_end_date
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      WHERE 1=1
    `;
      const params: any[] = [];

      if (healthCardId) {
        query += ` AND p.health_card_id = ?`;
        params.push(healthCardId);
      } else if (prescriptionNo) {
        query += ` AND pr.prescription_no = ?`;
        params.push(prescriptionNo);
      } else {
        return res.status(400).json({ success: false, message: "必須提供健保卡號或處方箋號碼" });
      }

      const data = await db.get(query, params);

      if (!data) {
        return res.status(404).json({ success: false, message: "查無對應的慢箋資料，請洽櫃檯。" });
      }

      return res.json({ success: true, data });
    } catch (error) {
      next(error); // 💡 將錯誤往後丟給全域錯誤處理 Middleware
    }
  },
);

/**
 * API 2: 建立預約 / 今日報到
 */
app.post(
  "/api/kiosk/create-appointment",
  validateCreateAppointment,
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { prescriptionId, appointmentType, pickupDate } = req.body;
      const db = await getDb();

      // 🔒 資安與邏輯商務檢查：檢查該處方箋是否還有剩餘次數可領
      const prescription = await db.get("SELECT current_phase, total_phases FROM prescriptions WHERE id = ?", [
        prescriptionId,
      ]);
      if (!prescription) {
        return res.status(404).json({ success: false, message: "處方箋不存在" });
      }
      if (prescription.current_phase >= prescription.total_phases) {
        return res.status(400).json({ success: false, message: "此處方箋領用次數已滿！" });
      }

      // 產生慢籤預約號 / 領藥號 (實務上會依據當天序號遞增，這裡用隨機號碼模擬)
      const randomNo = Math.floor(Math.random() * 900) + 100; // 100~999
      const sequenceNo = `${appointmentType === "TODAY" ? "T" : "F"}${randomNo}`;

      // 寫入預約紀錄
      await db.run(
        `INSERT INTO appointments (prescription_id, appointment_type, pickup_date, sequence_no, status)
       VALUES (?, ?, ?, ?, ?)`,
        [prescriptionId, appointmentType, pickupDate, sequenceNo, "PENDING"],
      );

      // 更新處方箋當前領取期數 (如果是今日領藥報到，實務上通常當場就+1，或是等藥局發藥再更新。這裡模擬報到即更新)
      if (appointmentType === "TODAY") {
        await db.run("UPDATE prescriptions SET current_phase = current_phase + 1 WHERE id = ?", [prescriptionId]);
      }

      return res.json({
        success: true,
        message: appointmentType === "TODAY" ? "報到成功" : "預約成功",
        data: {
          sequenceNo,
          pickupDate,
        },
      });
    } catch (error) {
      next(error); // 💡 將錯誤往後丟
    }
  },
);

// 🔒 全域錯誤處理 Middleware (必須放在所有 API 路由的最後面)
// 實務資安提點：絕對不能把內部的 SQL 錯誤（如: SQLite error near "FROM"...）直接丟給前端，那會洩漏資料庫欄位結構。
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("【系統全域錯誤日誌】:", err.stack || err); // 後端自己看得到詳細 Log

  res.status(500).json({
    success: false,
    message: "系統連線異常，請洽櫃檯服務人員。", // 給民眾看的模糊友善訊息
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend Server with Middlewares is running on http://localhost:${PORT}`);
});
