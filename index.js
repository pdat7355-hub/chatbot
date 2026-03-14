const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// Hàm chính để ghi dữ liệu vào Google Sheet
async function writeToSheet() {
    try {
        // 1. Lấy "chìa khóa" từ ngăn kéo Environment của Render
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            // Quan trọng: Chuyển đổi các ký tự \n trong chìa khóa để Google hiểu được
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

        // 2. Kết nối và tải thông tin tờ Sheet
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Chọn trang tính đầu tiên

        // 3. Thực hiện ghi một dòng mới
        await sheet.addRow({
            'Thời gian': new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            'Nội dung': 'Xin chào Đạt! Render đã kết nối thành công với Google Sheet rồi nhé.'
        });

        console.log("--- Đã ghi dữ liệu thành công vào lúc: " + new Date().toLocaleString() + " ---");
        return "Thành công rực rỡ!";
    } catch (error) {
        console.error("Lỗi kết nối hoặc ghi dữ liệu:", error);
        return "Thất bại! Lỗi: " + error.message;
    }
}

// Đường dẫn chính khi bạn nhấn vào link .onrender.com
app.get('/', async (req, res) => {
    const status = await writeToSheet();
    res.send(`
        <div style="text-align: center; padding: 50px; font-family: sans-serif;">
            <h1 style="color: #2ecc71;">Kết quả: ${status}</h1>
            <p>Bây giờ Đạt hãy mở file Google Sheet của bạn ra để kiểm tra nhé!</p>
            <a href="https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}" target="_blank" style="padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px;">Mở Google Sheet của tôi</a>
        </div>
    `);
});

app.listen(PORT, () => {
    console.log(`Bot đang lắng nghe tại cổng ${PORT}`);
});
