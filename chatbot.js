require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

// Biến môi trường cho Facebook (Cần thêm trên Render)
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

let allUsersHistory = {}; 

const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Hàm lấy dữ liệu từ Google Sheets (Giữ nguyên của bạn)
async function getAppData() {
    try {
        const docInfo = new GoogleSpreadsheet(process.env.ID_FILE_INFO, auth);
        await docInfo.loadInfo();
        const infoRows = await docInfo.sheetsByIndex[0].getRows();
        const shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const prodRows = await docProd.sheetsByIndex[0].getRows();
        const khoHang = prodRows.map(r => 
            `- SP: ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | LinkAnh: ${r.get('Ảnh') || ''}`
        ).join('\n');

        return { shopProfile, khoHang };
    } catch (err) { return { shopProfile: "", khoHang: "" }; }
}

// 1. Webhook GET: Để Facebook xác thực server của bạn
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 2. Webhook POST: Nơi Facebook gửi tin nhắn của khách đến
app.post('/webhook', async (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(async (entry) => {
            let webhook_event = entry.messaging[0];
            let sender_psid = webhook_event.sender.id; // ID của khách hàng

            if (webhook_event.message && webhook_event.message.text) {
                await handleChatLogic(sender_psid, webhook_event.message.text);
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// 3. Hàm xử lý logic AI và Ghi đơn (Tách ra từ route cũ của bạn)
async function handleChatLogic(userId, message) {
    const { shopProfile, khoHang } = await getAppData();

    if (!allUsersHistory[userId]) allUsersHistory[userId] = [];
    let userHistory = allUsersHistory[userId];

    userHistory.push({ role: "user", content: message });
    if (userHistory.length > 20) userHistory.shift(); 

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "google/gemini-2.0-flash-001", 
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý ảo shop Hương Kid. THÔNG TIN SHOP: ${shopProfile}\nKHO: ${khoHang}\nQUY TẮC: ... (giữ nguyên quy tắc của bạn)`
                },
                ...userHistory
            ]
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });

        let aiReply = response.data.choices[0].message.content;

        // Xử lý chốt đơn
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
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Shop đã chốt đơn thành công cho chị rồi ạ!");
            } catch (err) { console.error("Lỗi ghi đơn:", err); }
        }

        // Gửi trả lời về Messenger
        await sendToFacebook(userId, aiReply);
        userHistory.push({ role: "assistant", content: aiReply });

    } catch (error) {
        console.error("Lỗi xử lý AI:", error);
        await sendToFacebook(userId, "Dạ hệ thống bận tí ạ!");
    }
}

// 4. Hàm gọi API của Facebook để gửi tin nhắn
async function sendToFacebook(psid, text) {
    try {
        await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`, {
            recipient: { id: psid },
            message: { text: text }
        });
    } catch (err) {
        console.error("Lỗi Send API:", err.response.data);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Facebook Bot đang chạy tại cổng ${PORT}`));
