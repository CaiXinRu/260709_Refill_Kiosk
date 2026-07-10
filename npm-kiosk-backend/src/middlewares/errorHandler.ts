import { NextFunction, Request, Response } from "express";
import { errorLog } from "../utils/logger"; // 引入日記

/**
 * Express 5.x 全域錯誤處理中間件
 * 負責攔截所有由 async 函式自動拋出或手動拋出的錯誤
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // 💡 用 errorLog 取代 console.error
  errorLog("❌ 發生未捕捉錯誤！URL: %s %s", req.method, req.url);
  errorLog(err.stack || err);

  // 2. 判斷是否為我們已知或特定的錯誤類型（例如自訂的密碼錯誤、格式錯誤等，此處可擴充）
  const statusCode = err.status || err.statusCode || 500;

  // 3. 🔒 資安防護：隱藏底層細節，回傳給 Kiosk 前端乾淨且模糊的訊息
  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "系統連線異常，請洽櫃檯服務人員。" // 隱藏 SQLite 欄位或連線錯誤
        : err.message || "請求處理失敗",
  });
}
