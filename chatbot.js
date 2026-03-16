require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static('public')); 

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
        
        // Đọc dữ liệu ảnh từ cột E (tên là "Ảnh" trong file của anh)
        const khoHang = prodRows.map(r => 
            `- SP: ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | Mô tả: ${r.get('Mô tả')} | MaAnh: ${r.get('Ảnh') || ''}`
        ).join('\n');

        return { shopProfile, khoHang };
    } catch (err) {
        return { shopProfile: "Lỗi", khoHang: "Lỗi" };
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
                    content: `Bạn là trợ lý ảo của shop "Hương Kid". 
                    KHO HÀNG CỦA BẠN:
                    ${khoHang}

                    NHIỆM VỤ QUAN TRỌNG:
                    1. Khi khách hỏi về sản phẩm hoặc xem mẫu, bạn PHẢI gửi ảnh theo đúng cú pháp này: ![img](Dán_Toàn_Bộ_Nội_Dung_MaAnh_Ở_Đây).
                    2. TUYỆT ĐỐI không được bỏ qua mã ảnh. Nếu cột MaAnh có dữ liệu, bạn phải lôi ra hết.
                    3. Chỉ tư vấn những gì có trong kho hàng bên trên.

                    QUY TRÌNH CHỐT ĐƠN:
                    - Đủ Tên, SĐT, Sản phẩm(Size), Địa chỉ -> Hiện bản tóm tắt xác nhận.
                    - Khách OK -> Ghi mã cuối câu: [CHOT_DON: Tên | Sản phẩm (Size) | SĐT | Địa chỉ]`
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
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Đã ghi đơn thành công cho chị ạ!");
                chatHistory = []; 
            } catch (err) { console.error(err); }
        }
        res.json({ reply: aiReply });
    } catch (error) { res.status(500).json({ reply: "Lỗi rồi anh Đạt ơi!" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy cổng ${PORT}`));
