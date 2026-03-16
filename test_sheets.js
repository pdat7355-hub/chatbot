require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// 1. Cấu hình xác thực
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function testConnection() {
    console.log("--- BẮT ĐẦU KIỂM TRA KẾT NỐI ---");

    try {
        // KIỂM TRA FILE 1: THÔNG TIN SHOP
        console.log("1. Đang thử kết nối File INFO...");
        const docInfo = new GoogleSpreadsheet(process.env.ID_FILE_INFO, auth);
        await docInfo.loadInfo();
        const sheet1 = docInfo.sheetsByIndex[0];
        const rows1 = await sheet1.getRows();
        console.log("✅ Kết nối File INFO thành công!");
        console.log("Dữ liệu dòng đầu tiên:", rows1[0]?.get('Hạng mục') || "Không tìm thấy cột 'Hạng mục'");

        // KIỂM TRA FILE 2: SẢN PHẨM
        console.log("\n2. Đang thử kết nối File PRODUCT...");
        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const sheet2 = docProd.sheetsByIndex[0];
        const rows2 = await sheet2.getRows();
        console.log("✅ Kết nối File PRODUCT thành công!");
        console.log("Dữ liệu dòng đầu tiên:", rows2[0]?.get('Tên') || "Không tìm thấy cột 'Tên'");

        // KIỂM TRA FILE 3: GHI THỬ ĐƠN HÀNG
        console.log("\n3. Đang thử GHI dữ liệu vào File ORDER...");
        const docOrder = new GoogleSpreadsheet(process.env.ID_FILE_ORDER, auth);
        await docOrder.loadInfo();
        const sheet3 = docOrder.sheetsByIndex[0];
        await sheet3.addRow({
            'Thời gian': new Date().toLocaleString('vi-VN'),
            'Tên khách': 'Khách Test',
            'Sản phẩm': 'Sản phẩm Test',
            'Số điện thoại': '0900000000'
        });
        console.log("✅ Ghi dữ liệu File ORDER thành công!");

        console.log("\n--- KẾT LUẬN: MỌI THỨ ĐỀU CHUẨN! ---");

    } catch (error) {
        console.log("\n❌ PHÁT HIỆN LỖI:");
        if (error.message.includes("403")) {
            console.log("LỖI 403: Anh chưa Share quyền Editor cho Email Service Account!");
        } else if (error.message.includes("404")) {
            console.log("LỖI 404: Sai ID file rồi anh Đạt ơi, kiểm tra lại ID trên Render/File .env");
        } else {
            console.log("LỖI CHI TIẾT:", error.message);
        }
    }
}

testConnection();
