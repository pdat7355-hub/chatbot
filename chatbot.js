require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static('public')); 

// --- BỘ NHỚ TẠM (LƯU LỊCH SỬ CHAT) ---
let chatHistory = [];

// --- CẤU HÌNH XÁC THỰC GOOGLE SHEETS ---
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// --- HÀM ĐỌC DỮ LIỆU TỪ 3 FILE EXCEL ---
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

// --- XỬ LÝ CHAT VÀ GHI ĐƠN ---
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
                    
                    DỮ LIỆU CỬA HÀNG:
                    - Profile: ${shopProfile}
                    - Kho hàng: ${khoHang}

                    QUY TRÌNH CHỐT ĐƠN 2 BƯỚC (BẮT BUỘC):
                    Bước 1: Khi khách cung cấp đủ Tên, SĐT, Sản phẩm (Size), Địa chỉ -> Bạn hãy hiện "BẢN TÓM TẮT ĐƠN HÀNG" rõ ràng và hỏi: "Anh/Chị xác nhận thông tin đúng chưa để em cho đi đơn luôn ạ?". (TUYỆT ĐỐI chưa ghi mã CHOT_DON ở đây).
                    Bước 2: Khi khách trả lời "Đúng rồi", "Ok", "Xác nhận", "Ship đi"... -> Lúc này mới ghi dòng mã sau ở cuối câu trả lời: [CHOT_DON: Tên | Sản phẩm (Size) | SĐT | Địa chỉ]

                    LƯU Ý: 
                    - Tuyệt đối KHÔNG tự bịa mẫu mã ngoài danh sách kho hàng.
                    - Tuyệt đối KHÔNG hỏi lại những thông tin khách đã cung cấp trong lịch sử chat.`
                },
                ...chatHistory
            ]
        }, { 
            headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } 
        });

        let aiReply = response.data.choices[0].message.content;
        chatHistory.push({ role: "assistant", content: aiReply });

        // XỬ LÝ GHI VÀO EXCEL KHI CÓ MÃ CHỐT ĐƠN
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
                    'Ghi chú (nếu có)': parts[3] // Ghi địa chỉ vào cột này để khớp với file của anh Đạt
                });

                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ ĐƠN HÀNG ĐÃ ĐƯỢC CHUYỂN QUA KHO. CẢM ƠN ANH/CHỊ!");
                chatHistory = []; // Reset lịch sử cho đơn mới
            } catch (err) {
                console.error("Lỗi ghi đơn Excel:", err);
            }
        }

        res.json({ reply: aiReply });

    } catch (error) {
        console.error("Lỗi AI:", error);
        res.status(500).json({ reply: "Dạ hệ thống bận, chị nhắn lại sau ít phút nhé!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chatbot Hương Kid đang chạy trên cổng ${PORT}`));
