const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// BƯỚC 1: QUẢN LÝ DANH SÁCH FILE SHEET CỦA BẠN TẠI ĐÂY
// ============================================================
const DANH_SACH_SHEET = {
    'chinh': '14n9UPiw6-Bx8VzTqVMbTyZrpGjaWOgkgm46PKrs5b48', // File ban đầu
    'kho': 'ID_FILE_KHO_MOI_CUA_BAN',                        // Dán ID file mới vào đây
    'donhang': 'ID_FILE_DON_HANG_MOI_CUA_BAN'               // Thêm bao nhiêu tùy ý
};

// Hàm xử lý ghi dữ liệu chung
async function ghiDuLieu(fileKey) {
    try {
        const sheetId = DANH_SACH_SHEET[fileKey];
        if (!sheetId || sheetId.includes('ID_CUA_FILE')) {
            return `Lỗi: Bạn chưa cấu hình ID cho file "${fileKey}" trong code!`;
        }

        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        await sheet.addRow({
            'Thời gian': new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            'Nội dung': `Ghi từ hệ thống đa nhiệm vào file: ${fileKey}`
        });

        return `Thành công! Đã ghi vào file: "${doc.title}"`;
    } catch (error) {
        console.error(error);
        return "Thất bại! Lỗi: " + error.message;
    }
}

// ============================================================
// BƯỚC 2: CÁC ĐƯỜNG DẪN ĐỂ BẠN ĐIỀU KHIỂN
// ============================================================

// Trang chủ hiện danh sách các link để bạn bấm cho tiện
app.get('/', (req, res) => {
    let html = `<h1>Bảng điều khiển của Đạt</h1><ul>`;
    for (let key in DANH_SACH_SHEET) {
        html += `<li><a href="/ghi/${key}">Ghi vào file: ${key}</a></li>`;
    }
    html += `</ul>`;
    res.send(html);
});

// Đường dẫn dùng chung: /ghi/kho hoặc /ghi/chinh hoặc /ghi/donhang
app.get('/ghi/:tenfile', async (req, res) => {
    const tenFileYeuCau = req.params.tenfile;
    const ketQua = await ghiDuLieu(tenFileYeuCau);
    
    res.send(`
        <div style="text-align: center; padding: 50px; font-family: sans-serif;">
            <h2 style="color: #2ecc71;">${ketQua}</h2>
            <br>
            <a href="/" style="color: #3498db;"> Quay lại bảng điều khiển</a>
        </div>
    `);
});

app.listen(PORT, () => {
    console.log(`Hệ thống đang chạy tại cổng ${PORT}`);
});
