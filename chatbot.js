require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static('public')); 

// --- BỘ NHỚ LỊCH SỬ CHAT ---
let chatHistory = [];

const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getAppData() {
    try {
        const docInfo = new GoogleSpreadsheet(process.env.ID_FILE_INFO, auth);
        await docInfo.loadInfo();
        const infoRows = await docInfo.sheetsByIndex[0].getRows();
        const shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const prodRows = await docProd.sheetsByIndex[0].getRows();
        
        // Đọc dữ liệu từ file Danh_Sach_SP (có cột Ảnh)
        const khoHang = prodRows.map(r => 
            `- ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | Mô tả: ${r.get('Mô tả')} | LinkAnh: ${r.get('Ảnh') || ''}`
        ).join('\n');

        return { shopProfile, khoHang };
    } catch (err) {
        return { shopProfile: "Lỗi kết nối", khoHang: "Lỗi kết nối" };
    }
}

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const { shopProfile, khoHang } = await getAppData();

    chatHistory.push({ role: "user", content: userMessage });
    if (chatHistory.length > 15) chatHistory.shift();

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý ảo của shop "Hương Kid - Thời trang bé trai".
                    DỮ LIỆU: ${shopProfile}. KHO: ${khoHang}

                    QUY TRÌNH CHỐT ĐƠN 2 BƯỚC:
                    Bước 1: Khi đủ Tên, SĐT, Sản phẩm(Size), Địa chỉ -> Hiện BẢN TÓM TẮT ĐƠN HÀNG (kèm tiền hàng + ship) và hỏi: "Xác nhận đúng chưa để em cho đi đơn?". (Chưa ghi mã CHOT_DON).
                    Bước 2: Khi khách nói "Ok/Đúng/Ship đi" -> Ghi mã cuối câu: [CHOT_DON: Tên | Sản phẩm (Size) | SĐT | Địa chỉ]

                    QUY TẮC HÌNH ẢNH:
                    Khi giới thiệu sản phẩm, bắt buộc gửi kèm ảnh theo mẫu: ![img](Nội_dung_LinkAnh_trong_kho)`
                },
                ...chatHistory
            ]
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });

        let aiReply = response.data.choices[0].message.content;
        chatHistory.push({ role: "assistant", content: aiReply });

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
                    'Ghi chú (nếu có)': parts[3]
                });
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ ĐƠN ĐÃ LÊN HỆ THỐNG. CHỊ HƯƠNG SẼ GỌI NGAY!");
                chatHistory = []; 
            } catch (err) { console.error(err); }
        }
        res.json({ reply: aiReply });
    } catch (error) { res.status(500).json({ reply: "Lỗi hệ thống rồi anh Đạt ơi!" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
