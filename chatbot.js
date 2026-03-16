require('dotenv').config();
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const axios = require('axios');

const app = express();
app.use(express.json());

// Cấu hình xác thực chung cho Google
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// --- GIAO DIỆN HỘP THOẠI CHAT ---
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>AI Master v3 - Đạt Phan</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; display: flex; justify-content: center; }
                #chat-container { width: 100%; max-width: 500px; height: 100vh; background: white; display: flex; flex-direction: column; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                #header { padding: 15px; background: #1a73e8; color: white; text-align: center; font-weight: bold; font-size: 18px; }
                #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
                .msg { margin-bottom: 15px; padding: 12px 16px; border-radius: 18px; max-width: 80%; line-height: 1.5; }
                .user { align-self: flex-end; background: #1a73e8; color: white; border-bottom-right-radius: 4px; }
                .bot { align-self: flex-start; background: #e8eaed; color: #202124; border-bottom-left-radius: 4px; }
                #input-area { display: flex; padding: 15px; border-top: 1px solid #eee; }
                input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 25px; outline: none; }
                button { margin-left: 10px; padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="header">AI MASTER V3 - ĐẠT PHAN</div>
                <div id="messages"></div>
                <div id="input-area">
                    <input type="text" id="userInput" placeholder="Hỏi giá hoặc chốt đơn..." onkeypress="if(event.key==='Enter') sendMessage()">
                    <button onclick="sendMessage()">GỬI</button>
                </div>
            </div>
            <script>
                const msgDiv = document.getElementById('messages');
                async function sendMessage() {
                    const input = document.getElementById('userInput');
                    const text = input.value.trim();
                    if(!text) return;
                    msgDiv.innerHTML += '<div class="msg user">' + text + '</div>';
                    input.value = '';
                    msgDiv.scrollTop = msgDiv.scrollHeight;
                    try {
                        const res = await fetch('/chat', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ message: text })
                        });
                        const data = await res.json();
                        msgDiv.innerHTML += '<div class="msg bot">' + data.reply.replace(/\\n/g, '<br>') + '</div>';
                    } catch (e) {
                        msgDiv.innerHTML += '<div class="msg bot">⚠️ Lỗi kết nối server.</div>';
                    }
                    msgDiv.scrollTop = msgDiv.scrollHeight;
                }
            </script>
        </body>
        </html>
    `);
});

// --- LOGIC XỬ LÝ CHAT VỚI 3 FILE RIÊNG BIỆT ---
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    try {
        // 1. Đọc dữ liệu từ File Thông Tin Shop
        const docInfo = new GoogleSpreadsheet(process.env.ID_FILE_INFO, auth);
        await docInfo.loadInfo();
        const infoSheet = docInfo.sheetsByIndex[0]; // Lấy sheet đầu tiên
        const infoRows = await infoSheet.getRows();
        const shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        // 2. Đọc dữ liệu từ File Sản Phẩm
        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const productSheet = docProd.sheetsByIndex[0]; // Lấy sheet đầu tiên
        const prodRows = await productSheet.getRows();
        const khoHang = prodRows.map(r => `- ${r.get('Tên')}: ${r.get('Giá')}`).join('\n');

        // 3. Gửi dữ liệu cho AI (OpenRouter)
        const aiResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý ảo hỗ trợ khách hàng.
                    Thông tin về shop:\n${shopProfile}
                    Danh sách sản phẩm:\n${khoHang}
                    Nhiệm vụ: Tư vấn nhiệt tình. Nếu khách cung cấp đủ Tên, SĐT và Sản phẩm để mua, hãy xác nhận và trả về chính xác cú pháp này ở cuối: [CHOT_DON: Tên | Sản phẩm | SĐT]`
                },
                { role: "user", content: userMessage }
            ]
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });

        let aiReply = aiResponse.data.choices[0].message.content;

        // 4. Nếu AI xác nhận chốt đơn, ghi vào File Chốt Đơn
        if (aiReply.includes("[CHOT_DON:")) {
            try {
                const docOrder = new GoogleSpreadsheet(process.env.ID_FILE_ORDER, auth);
                await docOrder.loadInfo();
                const orderSheet = docOrder.sheetsByIndex[0];

                const orderData = aiReply.split("[CHOT_DON:")[1].split("]")[0].split("|");
                await orderSheet.addRow({
                    'Thời gian': new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                    'Tên khách': orderData[0].trim(),
                    'Sản phẩm': orderData[1].trim(),
                    'Số điện thoại': orderData[2].trim()
                });
                // Thay thế cú pháp kỹ thuật bằng lời nhắn thân thiện cho khách
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Hệ thống đã ghi nhận đơn hàng thành công!");
            } catch (err) {
                console.error("Lỗi khi ghi vào file Chốt đơn:", err.message);
            }
        }

        res.json({ reply: aiReply });

    } catch (error) {
        console.error("LỖI HỆ THỐNG:", error);
        res.json({ reply: "Xin lỗi, em gặp chút vấn đề khi kết nối dữ liệu. Anh Đạt kiểm tra lại ID các file và quyền Share nhé!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server chạy tại cổng ${PORT}`);
    console.log(`File Info: ${process.env.ID_FILE_INFO}`);
    console.log(`File Product: ${process.env.ID_FILE_PRODUCT}`);
    console.log(`File Order: ${process.env.ID_FILE_ORDER}`);
});
