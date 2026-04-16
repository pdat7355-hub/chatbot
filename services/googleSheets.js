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

const googleSheets = {
    // --- 1. LẤY TOÀN BỘ KHO HÀNG & NHÓM HÀNG ĐỘNG ---
    getInventoryData: async () => {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'khohang!A:Z', 
            });
            const rows = res.data.values;
            if (!rows || rows.length <= 1) return { inventory: {}, groups: [] };

            const header = rows[0];
            const inventory = {};
            const groupSet = new Set(); 

            const getVal = (row, colName) => {
                const index = header.indexOf(colName);
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

            const groups = Array.from(groupSet); 
            console.log(`🚀 Đã nạp ${Object.keys(inventory).length} mẫu và ${groups.length} nhóm hàng từ Excel.`);
            
            // Trả về cả inventory và groups để dùng cho analyzer và consult
            return { inventory, groups }; 
        } catch (error) {
            console.error("❌ Lỗi nạp kho từ Google Sheets:", error.message);
            return { inventory: {}, groups: [] };
        }
    },

    // --- 2. LẤY DỮ LIỆU CẤU HÌNH (DIMENSIONS) ---
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

    // --- 3. GHI DÒNG MỚI (LƯU ĐƠN HÀNG/LOG) ---
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
