require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Nhận diện giao diện từ thư mục public

// --- 1. CẤU HÌNH XÁC THỰC GOOGLE SHEETS (CHỈ KHAI BÁO 1 LẦN) ---
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// --- 2. HÀM ĐỌC DỮ LIỆU TỪ EXCEL ---
async function getAppData() {
    try {
        const docInfo = new GoogleSpreadsheet(process.env.ID_FILE_INFO, auth);
        await docInfo.loadInfo();
        const infoRows = await docInfo.sheetsByIndex[0].getRows();
        const shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const prodRows = await docProd.sheetsByIndex[0].getRows();
        const khoHang = prodRows.map(r => `- ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | Mô tả: ${r.get('Mô tả')}`).join('\n');

        return { shopProfile, khoHang };
    } catch (err) {
        console.error("Lỗi đọc Sheets:", err);
        return { shopProfile: "Lỗi kết nối", khoHang: "Lỗi kết nối" };
    }
}

// --- 3. XỬ LÝ CHAT VÀ GHI ĐƠN HÀNG ---
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const { shopProfile, khoHang } = await getAppData();

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý bán hàng shop "Hương Kid - Thời trang bé trai". 
                    DỮ LIỆU: Shop Profile: ${shopProfile}. Kho hàng: ${khoHang}.
                    QUY TRÌNH: 1. Hỏi cân nặng bé để tư vấn size. 2. Chốt đơn cần: Tên, SĐT, Sản phẩm (Size), Địa chỉ.
                    Khi đủ 4 thông tin, tóm tắt đơn và ghi cú pháp cuối: [CHOT_DON: Tên | Sản phẩm (Size) | SĐT | Địa chỉ]`
                },
                { role: "user", content: userMessage }
            ]
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });

        let aiReply = response.data.choices[0].message.content;

        if (aiReply.includes("[CHOT_DON:")) {
            try {
                const docOrder = new GoogleSpreadsheet(process.env.ID_FILE_ORDER, auth);
                await docOrder.loadInfo();
                const orderSheet = docOrder.sheetsByIndex[0];
                const orderRaw = aiReply.split("[CHOT_DON:")[1].split("]")[0];
                const parts = orderRaw.split("|").map(p => p.trim());

                await orderSheet.addRow({
                    'Thời gian': new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                    'Tên khách': parts[0],
                    'Sản phẩm': parts[1],
                    'Số điện thoại': parts[2],
                    'Địa chỉ': parts[3]
                });
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Đã ghi nhận đơn hàng thành công! Chị Hương sẽ gọi ngay ạ.");
            } catch (err) { console.error("Lỗi ghi đơn:", err); }
        }
        res.json({ reply: aiReply });
    } catch (error) { res.status(500).json({ reply: "Lỗi hệ thống rồi chị ơi!" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chatbot running on port ${PORT}`));
