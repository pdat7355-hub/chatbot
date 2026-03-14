const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình xác thực (Lấy từ biến môi trường Render)
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Giả sử đây là file Quản lý Sản phẩm/Giá của Đạt
const SHEET_ID = '1-2CB8yW-xgVeY7VMKvinfH1CwMKGiWZJkNC2ENqnl0g'; 

app.get('/', async (req, res) => {
    try {
        const doc = new GoogleSpreadsheet(SHEET_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        // Logic Chatbot: Ví dụ tìm giá sản phẩm "Bánh xe nước"
        const sanPham = rows.find(r => r.get('Tên') === 'Bánh xe nước');
        const gia = sanPham ? sanPham.get('Giá') : 'Liên hệ';

        res.send(`<h1>Bot Bán Hàng Đạt Phan</h1><p>Giá Bánh xe nước hiện tại: ${gia}</p>`);
    } catch (e) {
        res.send("Bot đang bận cập nhật dữ liệu...");
    }
});

app.listen(PORT, () => console.log(`Chatbot đang chạy trên cổng ${PORT}`));
