require('dotenv').config();
const express = require('express');
const axios = require('axios'); // 🔥 Đạt nhớ chạy lệnh: npm install axios
const sessionManager = require('./core/sessionManager');
const analyzer = require('./processors/analyzer');
const googleSheets = require('./services/googleSheets');
const logicHandler = require('./processors/logicHandler/index'); 
const { identify } = require('./processors/recognizer');
const { handleTraps } = require('./processors/commandTraps');
const systemChecker = require('./utils/systemChecker');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- BIẾN CẤU HÌNH FACEBOOK (Lấy từ Render Environment) ---
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "huong_kid_secure_2026"; 

// --- KHỞI TẠO BOT ---
async function initializeBot() {
    try {
        const inventoryData = await googleSheets.getInventoryData(); 
        const dimensions = await googleSheets.getDimensions(); 
        
        if (inventoryData) {
            sessionManager.setInventory(inventoryData);
            sessionManager.setDimensions(dimensions);
            console.log(`🚀 Hương Kid Bot sẵn sàng!`);
            console.log(`📊 Kho hàng: ${Object.keys(inventoryData.inventory || inventoryData).length} mã.`);
        }
    } catch (err) { 
        console.error("❌ Lỗi nạp dữ liệu khởi tạo:", err.message); 
    }
}
initializeBot();

// =========================================================
// 1. XỬ LÝ XÁC THỰC WEBHOOK (Dành cho Facebook)
// =========================================================
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED: Đã kết nối với Facebook thành công!');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);      
        }
    }
});

// =========================================================
// 2. NHẬN TIN NHẮN TỪ FACEBOOK MESSENGER (POST)
// =========================================================
app.post('/webhook', async (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(async function(entry) {
            // Facebook có thể gửi nhiều tin nhắn cùng lúc nên dùng vòng lặp
            if (entry.messaging) {
                let webhook_event = entry.messaging[0];
                let sender_psid = webhook_event.sender.id; // ID người nhắn trên FB

                if (webhook_event.message && webhook_event.message.text) {
                    const incomingText = webhook_event.message.text;
                    
                    // Gọi hàm xử lý logic chung
                    const reply = await processChatLogic(sender_psid, incomingText);
                    
                    // Gửi tin nhắn phản hồi lại Messenger
                    await callSendAPI(sender_psid, reply);
                }
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// =========================================================
// 3. HÀM XỬ LÝ LOGIC CHUNG (Dùng cho cả Web và Facebook)
// =========================================================
async function processChatLogic(userId, message) {
    try {
        const text = (message || "").toLowerCase().trim();

        // 1. LẤY DỮ LIỆU TỪ RAM
        const globalInventory = sessionManager.getInventory();
        const inventory = globalInventory?.inventory || globalInventory || {};
        const dimConfig = sessionManager.getDimensions() || [];
        const groups = globalInventory?.groups || ['áo ấm', 'bé trai', 'bé gái', 'Quảng Châu'];

        // 2. SESSION & IDENTIFY
        let session = sessionManager.get(userId) || { cart: [], entities: {}, flags: {} };
        session = await identify(userId, session);

        // 3. BẪY LỆNH (Traps)
        const trapResult = await handleTraps(text, userId, session, inventory, groups, sessionManager);
        if (trapResult) return trapResult.reply;

        // 4. PHÂN TÍCH & LOGIC
        const analysis = analyzer.extract(text, session, dimConfig, globalInventory);
        const updatedSession = sessionManager.update(userId, {
            winner: analysis.winner || "CONSULT",
            entities: { ...session.entities, ...(analysis.entities || {}) }
        });

        let finalResponse = await logicHandler.handleResponse(updatedSession, text, dimConfig, globalInventory, analysis);

        // 5. DIAGNOSTIC TRACE (Chỉ hiện ở Console server để Đạt theo dõi, không gửi cho khách FB)
        const diagnosticTrace = systemChecker.runDiagnostic(
            updatedSession, 
            analysis.zones, 
            updatedSession.winner, 
            "logicHandler.js"
        );
        console.log(`🤖 [FB-${userId}] -> Winner: ${updatedSession.winner}`);

        return finalResponse; // Trả về nội dung chat thuần cho Messenger

    } catch (error) {
        console.error("❌ LỖI XỬ LÝ LOGIC:", error);
        return "Dạ em hơi bận xíu, Mẹ nhắn lại giúp em nhen! ❤️";
    }
}

// =========================================================
// 4. HÀM GỬI TIN NHẮN QUA API FACEBOOK
// =========================================================
async function callSendAPI(sender_psid, responseText) {
    const request_body = {
        "recipient": { "id": sender_psid },
        "message": { "text": responseText }
    };
    try {
        await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body);
    } catch (err) {
        console.error("❌ Lỗi gửi tin nhắn FB:", err.response?.data || err.message);
    }
}

// --- GIỮ NGUYÊN ENDPOINT CHO WEB HIỆN TẠI ---
app.post('/chat', async (req, res) => {
    try {
        const { userId, message } = req.body;
        // Với Web, mình có thể gửi kèm cả DiagnosticTrace để Đạt kiểm tra
        const text = (message || "").toLowerCase().trim();
        const globalInventory = sessionManager.getInventory();
        const dimConfig = sessionManager.getDimensions() || [];
        
        let session = sessionManager.get(userId) || { cart: [], entities: {}, flags: {} };
        session = await identify(userId, session);
        
        // Tái sử dụng hàm logic chung nhưng thêm phần Trace cho Web
        const analysis = analyzer.extract(text, session, dimConfig, globalInventory);
        const updatedSession = sessionManager.update(userId, {
            winner: analysis.winner || "CONSULT",
            entities: { ...session.entities, ...(analysis.entities || {}) }
        });

        let finalResponse = await logicHandler.handleResponse(updatedSession, text, dimConfig, globalInventory, analysis);
        const diagnosticTrace = systemChecker.runDiagnostic(updatedSession, analysis.zones, updatedSession.winner, "logicHandler.js");

        return res.json({ reply: `${finalResponse}\n\n${diagnosticTrace}` });
    } catch (error) {
        res.status(500).json({ reply: "Lỗi server web" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server Hương Kid chạy tại http://localhost:${PORT}`));
