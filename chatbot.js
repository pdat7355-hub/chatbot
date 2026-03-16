require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static('public')); 

// Bộ nhớ lịch sử chat riêng biệt cho từng khách hàng
let allUsersHistory = {}; 

const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getAppData() {
    try {
        // Lấy thông tin shop (Địa chỉ, chính sách...)
        const docInfo = new GoogleSpreadsheet(process.env.ID_FILE_INFO, auth);
        await docInfo.loadInfo();
        const infoRows = await docInfo.sheetsByIndex[0].getRows();
        const shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        // Lấy kho hàng (Tên, Giá, Ảnh)
        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const prodRows = await docProd.sheetsByIndex[0].getRows();
        const khoHang = prodRows.map(r => 
            `- SP: ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | LinkAnh: ${r.get('Ảnh') || ''}`
        ).join('\n');

        return { shopProfile, khoHang };
    } catch (err) {
        console.error("Lỗi đọc Excel:", err);
        return { shopProfile: "", khoHang: "" };
    }
}

app.post('/chat', async (req, res) => {
    const { message, userId } = req.body; 
    const { shopProfile, khoHang } = await getAppData();

    // Khởi tạo lịch sử chat cho khách mới nếu chưa có
    if (!allUsersHistory[userId]) {
        allUsersHistory[userId] = [];
    }
    let userHistory = allUsersHistory[userId];

    userHistory.push({ role: "user", content: message });
    if (userHistory.length > 20) userHistory.shift(); 

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "google/gemini-2.0-flash-001", 
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý ảo shop Hương Kid. 
                    THÔNG TIN SHOP: ${shopProfile}
                    KHO: ${khoHang}
                    
                    QUY TẮC BÁN HÀNG:
                    1. Luôn kèm ảnh sản phẩm: [IMG]link[/IMG].
                    2. Nếu trong lịch sử chat ĐÃ CÓ Tên, SĐT, Địa chỉ của khách, hãy DÙNG LUÔN để chốt đơn tiếp theo, KHÔNG ĐƯỢC HỎI LẠI khách.
                    3. Mã chốt đơn bắt buộc: [CHOT_DON: Tên | Sản phẩm | SĐT | Địa chỉ]`
                },
                ...userHistory
            ]
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });

        let aiReply = response.data.choices[0].message.content;

        // Xử lý khi AI ra lệnh chốt đơn
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

                const cleanReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Shop đã ghi nhận thêm đơn này vào đơn của chị rồi nhé!");
                userHistory.push({ role: "assistant", content: cleanReply });
                return res.json({ reply: cleanReply });
            } catch (err) { console.error("Lỗi ghi đơn:", err); }
        }

        userHistory.push({ role: "assistant", content: aiReply });
        res.json({ reply: aiReply });

    } catch (error) {
        res.status(500).json({ reply: "Dạ hệ thống bận tí, chị nhắn lại sau nha!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
