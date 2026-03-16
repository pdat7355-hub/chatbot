require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- BỘ NHỚ TẠM (LƯU LỊCH SỬ CHAT) ---
// Biến này nằm trong bộ nhớ RAM của Render, giúp AI nhớ khách đã nói gì
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
        const khoHang = prodRows.map(r => `- ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | Mô tả: ${r.get('Mô tả')}`).join('\n');

        return { shopProfile, khoHang };
    } catch (err) {
        return { shopProfile: "Lỗi kết nối", khoHang: "Lỗi kết nối" };
    }
}

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const { shopProfile, khoHang } = await getAppData();

    // 1. Lưu câu chat của khách vào bộ nhớ
    chatHistory.push({ role: "user", content: userMessage });
    if (chatHistory.length > 12) chatHistory.shift(); // Giữ 12 câu gần nhất cho nhẹ

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý bán hàng shop "Hương Kid". 
                    NGUYÊN TẮC THÉP:
                    - CHỈ tư vấn sản phẩm có trong kho: ${khoHang}. KHÔNG tự bịa mẫu A, B, C.
                    - ĐÃ CÓ thông tin nào (Tên, SĐT, Địa chỉ, Cân nặng) trong lịch sử chat thì TUYỆT ĐỐI không hỏi lại.
                    - Nếu đủ 4 thông tin (Tên, SĐT, Sản phẩm kèm Size, Địa chỉ) thì chốt đơn ngay bằng cú pháp: [CHOT_DON: Tên | Sản phẩm (Size) | SĐT | Địa chỉ]`
                },
                ...chatHistory // 2. Gửi toàn bộ lịch sử lên AI để nó "nhớ"
            ]
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });

        let aiReply = response.data.choices[0].message.content;

        // 3. Lưu câu trả lời của AI vào bộ nhớ để lần sau nó biết nó đã nói gì
        chatHistory.push({ role: "assistant", content: aiReply });

        // Xử lý ghi đơn vào Excel
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
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Đã ghi nhận đơn thành công! Chị Hương sẽ gọi ngay ạ.");
                chatHistory = []; // Chốt đơn xong thì xóa lịch sử cho khách mới
            } catch (err) { console.error("Lỗi ghi đơn:", err); }
        }

        res.json({ reply: aiReply });
    } catch (error) {
        res.status(500).json({ reply: "Dạ hệ thống bận tí chị ơi!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại cổng ${PORT}`));
