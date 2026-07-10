import debug from "debug";

// 建立各個模組的專屬日誌發射器
export const dbLog = debug("kiosk:db");
export const validateLog = debug("kiosk:validate");
export const errorLog = debug("kiosk:error");

// 💡 可以額外客製化：讓特定日誌在終端機有不同顏色
// debug 套件會自動分配顏色，但 kiosk:error 我們希望它很顯眼
errorLog.color = "1"; // 紅色
