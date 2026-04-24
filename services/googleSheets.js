const { google } = require('googleapis');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_ID;

// --- CẤU HÌNH VỊ TRÍ CỘT (CHỈ CẦN SỬA Ở ĐÂY) ---
const COLUMN_MAP = {
    USER_ID: 0,      // Cột A
    HO_TEN: 1,       // Cột B
    SDT: 2,          // Cột C
    DIA_CHI: 3,      // Cột D
    TEN_BE: 4,       // Cột E
    TUOI_BE: 5,      // Cột F
    CAN_NANG_OLD: 6, // Cột G (Cũ)
    CAN_NANG_1: 7, // Cột H (Mới)
    CAN_NANG_2: 10, // Cột H (Mới)
    CAN_NANG_3: 13, // Cột H (Mới)
    LOG_TIME: 15     // Cột P (Sẽ tự động mở rộng dải ô đến cột này)
};

// Hàm hỗ trợ chuyển số thứ tự cột thành chữ cái (0 -> A, 15 -> P)
const columnToLetter = (column) => {
    let temp, letter = '';
    while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter || 'A';
};

// Tự động tính toán cột xa nhất để lấy dữ liệu
const MAX_COL_INDEX = Math.max(...Object.values(COLUMN_MAP));
const AUTO_RANGE = `DANH_SACH_KHACH!A:${columnToLetter(MAX_COL_INDEX + 1)}`;

const googleSheets = {
 

    // --- 1. TRA CỨU KHÁCH HÀNG (Đã dùng AUTO_RANGE) ---
    findCustomerById: async (userId) => {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: AUTO_RANGE,
            });
            const rows = res.data.values;
            if (!rows || rows.length <= 1) return null;

            const rowIndex = rows.findIndex(row => row[COLUMN_MAP.USER_ID] === userId);
            if (rowIndex !== -1) {
                const row = rows[rowIndex];
                return {
                    Ho_Ten: row[COLUMN_MAP.HO_TEN] || "",
                    SDT: row[COLUMN_MAP.SDT] || "",
                    Dia_Chi: row[COLUMN_MAP.DIA_CHI] || "",
                    Can_Nang_1: row[COLUMN_MAP.CAN_NANG_1] ||row[COLUMN_MAP.CAN_NANG_2] ||row[COLUMN_MAP.CAN_NANG_3] || row[COLUMN_MAP.CAN_NANG_OLD] || ""
                };
            }
            return null;
        } catch (error) {
            console.error("❌ Lỗi tìm khách hàng:", error.message);
            return null;
        }
    },

    // --- 2. ĐỒNG BỘ KHÁCH HÀNG (Tự động mở rộng mảng) ---
    syncCustomerToExcel: async (userId, data) => {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: AUTO_RANGE,
            });
            const rows = res.data.values || [];
            const rowIndex = rows.findIndex(row => row[COLUMN_MAP.USER_ID] === userId);
            const now = new Date().toLocaleString('vi-VN');

            if (rowIndex !== -1) {
                // KHÁCH CŨ: Cập nhật dòng
                let updatedRow = [...rows[rowIndex]];
                
                // Đảm bảo mảng đủ độ dài để ghi vào cột xa nhất
                while (updatedRow.length <= MAX_COL_INDEX) updatedRow.push("");

                if (data.name) updatedRow[COLUMN_MAP.HO_TEN] = data.name;
                if (data.phone) updatedRow[COLUMN_MAP.SDT] = data.phone;
                if (data.address) updatedRow[COLUMN_MAP.DIA_CHI] = data.address;
                if (data.weight) updatedRow[COLUMN_MAP.CAN_NANG_1] = data.weight;
                updatedRow[COLUMN_MAP.LOG_TIME] = now;

                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `DANH_SACH_KHACH!A${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [updatedRow] },
                });
                console.log(`✅ Cập nhật khách cũ thành công.`);
            } else {
                // KHÁCH MỚI: Tạo mảng rỗng theo độ dài cần thiết
                const newRow = new Array(MAX_COL_INDEX + 1).fill("");
                newRow[COLUMN_MAP.USER_ID] = userId;
                newRow[COLUMN_MAP.HO_TEN] = data.name || "";
                newRow[COLUMN_MAP.SDT] = data.phone || "";
                newRow[COLUMN_MAP.DIA_CHI] = data.address || "";
                newRow[COLUMN_MAP.CAN_NANG_1] = data.weight || "";
                newRow[COLUMN_MAP.LOG_TIME] = now;

                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'DANH_SACH_KHACH!A1',
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [newRow] },
                });
                console.log(`✅ Đã thêm khách mới.`);
            }
        } catch (error) {
            console.error("❌ Lỗi đồng bộ Excel:", error.message);
        }
    },
   // --- 3. LẤY KHO HÀNG (GIỮ NGUYÊN) ---
    getInventoryData: async () => {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'KhoHang!A:Z',
            });
            const rows = res.data.values;
            if (!rows || rows.length <= 1) return { inventory: {}, groups: [] };

            const header = rows[0];
            const inventory = {};
            const groupSet = new Set(); 

            const getVal = (row, colName) => {
                const index = header.findIndex(h => h.trim().toLowerCase() === colName.toLowerCase());
                return (index !== -1 && row[index]) ? row[index].toString().trim() : "";
            };

            rows.slice(1).forEach(row => {
                const code = getVal(row, "Code").toUpperCase();
                const groupName = getVal(row, "Group");
                if (code) {
                    inventory[code] = {
                        code,
                        name: getVal(row, "Name"),
                        group: groupName, 
                        category: getVal(row, "category"), 
                        price: getVal(row, "Price"),
                        image: getVal(row, "Image"),
                        description: getVal(row, "Mô tả chi tiết")
                    };
                    if (groupName) groupSet.add(groupName);
                }
            });
            return { inventory, groups: Array.from(groupSet) }; 
        } catch (error) {
            return { inventory: {}, groups: [] };
        }
    },
    // --- 4. LẤY DỮ LIỆU CẤU HÌNH (DIMENSIONS) ---
    getDimensions: async () => {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Dimensions!A:I',
            });
            const rows = res.data.values;
            if (!rows || rows.length <= 1) return [];
            
            return rows.slice(1).map(row => ({
                id: row[0],
                name: row[1],
                keywords: row[2] ? row[2].split(',').map(k => k.trim()) : [],
                exclude: row[3] ? row[3].split(',').map(k => k.trim()) : [],
                regex: row[4] || null,
                weight: parseInt(row[5]) || 0,
                position: row[6] || 'Body',
                template: row[7] || '',
                zone: row[8] || 'RETAIN'
            }));
        } catch (error) {
            console.error("❌ Lỗi tải Dimensions:", error.message);
            return [];
        }
    },

    // --- 5. GHI DÒNG MỚI (LƯU ĐƠN HÀNG/LOG) ---
    appendRow: async (sheetName, rowData) => {
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:Z`, 
                valueInputOption: 'USER_ENTERED',
                resource: { values: [rowData] },
            });
            console.log(`✅ Đã ghi dữ liệu vào sheet: ${sheetName}`);
            return true;
        } catch (error) {
            console.error(`❌ Lỗi ghi vào sheet ${sheetName}:`, error.message);
            return false;
        }
    }
};

module.exports = googleSheets;
