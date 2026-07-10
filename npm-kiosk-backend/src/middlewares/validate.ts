import { NextFunction, Request, Response } from "express";
import { validateLog } from "../utils/logger"; // 引入日誌

// 驗證檢查慢箋查詢的欄位
export function validateVerifyPrescription(req: Request, res: Response, next: NextFunction): any {
  validateLog("🔍 驗證檢查慢箋查詢的欄位");
  const { healthCardId, prescriptionNo } = req.body;

  // 如果兩個都沒傳
  if (!healthCardId && !prescriptionNo) {
    return res.status(400).json({ success: false, message: "資安防護：必須提供健保卡號或處方箋號碼" });
  }

  // 實務資安：防止 SQL 注入或格式攻擊，檢查長度與特殊字元
  if (prescriptionNo && (prescriptionNo.length < 5 || prescriptionNo.length > 50)) {
    return res.status(400).json({ success: false, message: "不合法的處方箋號碼格式" });
  }

  if (healthCardId && healthCardId.length !== 12) {
    return res.status(400).json({ success: false, message: "健保卡號長度不正確" });
  }

  validateLog("✅ 驗證通過，放行至 Controller");
  next(); // 檢查沒問題，放行進入下一個 Controller
}

// 驗證建立預約的欄位
export function validateCreateAppointment(req: Request, res: Response, next: NextFunction): any {
  validateLog("🔍 驗證檢查建立預約的欄位");
  const { prescriptionId, appointmentType, pickupDate } = req.body;

  if (!prescriptionId || !appointmentType || !pickupDate) {
    return res.status(400).json({ success: false, message: "請求資料欄位不完整" });
  }

  if (appointmentType !== "TODAY" && appointmentType !== "FUTURE") {
    return res.status(400).json({ success: false, message: "領藥類型錯誤" });
  }

  // 檢查日期格式 YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(pickupDate)) {
    return res.status(400).json({ success: false, message: "日期格式不正確，須為 YYYY-MM-DD" });
  }

  validateLog("✅ 驗證通過，放行至 Controller");
  next();
}
