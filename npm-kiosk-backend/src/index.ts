import cors from "cors";
import express, { Request, Response } from "express";
import { getDb } from "./db";

const app = express();

app.use(cors());
app.use(express.json());

/**
 * API 1: 模擬透過 健保卡號 或 處方箋號碼 撈取慢箋資訊
 * 適用情境：民眾插卡、或掃描 QR code 後，Kiosk 畫面需要呈現「王小明先生/小姐 您好，您的慢箋資訊如下...」
 */
app.post("/api/kiosk/verify-prescription", async (req: Request, res: Response): Promise<any> => {
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
    console.error(error);
    return res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

/**
 * API 2: 建立預約 / 今日報到
 */
app.post("/api/kiosk/create-appointment", async (req: Request, res: Response): Promise<any> => {
  try {
    const { prescriptionId, appointmentType, pickupDate } = req.body;
    // 簡單驗證
    if (!prescriptionId || !appointmentType || !pickupDate) {
      return res.status(400).json({ success: false, message: "欄位缺失" });
    }

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
    console.error(error);
    return res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
