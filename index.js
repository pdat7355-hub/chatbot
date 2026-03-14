const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 1. DANH SÁCH FILE SHEET CỦA ĐẠT (Cập nhật ID tại đây)
// ============================================================
const DANH_SACH_SHEET = {
    'chinh': '14n9UPiw6-Bx8VzTqVMbTyZrpGjaWOgkgm46PKrs5b48', 
    'kho': '1-2CB8yW-xgVeY7VMKvinfH1CwMKGiWZJkNC2ENqnl0g' 
};

// Cấu hình xác thực dùng chung
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ============================================================
// 2. CÁC CHỨC NĂNG CHÍNH (ĐỌC VÀ GHI)
// ============================================================

// Hàm Ghi dữ liệu
async function ghiVaoSheet(fileKey, noiDungMoi) {
    const doc = new GoogleSpreadsheet(DANH_SACH_SHEET[fileKey], auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
        'Thời gian': new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        'Nội dung': noiDungMoi
    });
    return `Đã ghi vào file: ${doc.title}`;
}

// Hàm Đọc dữ liệu
async function docTuSheet(fileKey) {
    const doc = new GoogleSpreadsheet(DANH_SACH_SHEET[fileKey], auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    return rows.map(row => ({
        thoigian: row.get('Thời gian'),
        noidung: row.get('Nội dung')
    }));
}

// ============================================================
// 3. ĐIỀU KHIỂN QUA TRÌNH DUYỆT (Giao diện link)
// ============================================================

// Trang chủ hiển thị menu
app.get('/', (req, res) => {
    let html = `<div style="font-family:sans-serif; padding:20px;"><h1>Chào Đạt! Chọn thao tác:</h1>`;
    for (let key in DANH_SACH_SHEET) {
        html += `<h3>File: ${key}</h3>
                 <a href="/ghi/${key}">[Ghi dòng mới]</a> | 
                 <a href="/xem/${key}">[Đọc dữ liệu]</a><br>`;
    }
    html += `</div>`;
    res.send(html);
});

// Đường dẫn Ghi: /ghi/kho hoặc /ghi/chinh
app.get('/ghi/:tenfile', async (req, res) => {
    try {
        const result = await ghiVaoSheet(req.params.tenfile, "Lệnh ghi tự động từ Render");
        res.send(`<h2>${result}</h2><a href="/">Quay lại</a>`);
    } catch (e) { res.send("Lỗi Ghi: " + e.message); }
});

// Đường dẫn Đọc: /xem/kho hoặc /xem/chinh
app.get('/xem/:tenfile', async (req, res) => {
    try {
        const data = await docTuSheet(req.params.tenfile);
        res.json({ file: req.params.tenfile, du_lieu: data });
    } catch (e) { res.send("Lỗi Đọc: " + e.message); }
});

app.listen(PORT, () => console.log(`Hệ thống chạy tại cổng ${PORT}`));
