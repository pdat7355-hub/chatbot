const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const axios = require('axios');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Cấu hình xác thực
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const S_ID = process.env.GOOGLE_SHEET_ID;
const AI_KEY = process.env.OPENROUTER_API_KEY;

// 1. GIAO DIỆN HỘP THOẠI CHAT (HTML & CSS)
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

// 2. LOGIC XỬ LÝ 3 SHEET & AI
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    try {
        const doc = new GoogleSpreadsheet(S_ID, auth);
        await doc.loadInfo();

        // Đọc Sheet 1: Thông tin Shop
        const infoSheet = doc.sheetsByTitle['Thong_Tin_Shop'];
        const infoRows = await infoSheet.getRows();
        let shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        // Đọc Sheet 2: Danh sách Sản phẩm
        const productSheet = doc.sheetsByTitle['Danh_Sach_SP'];
        const prodRows = await productSheet.getRows();
        let khoHang = prodRows.map(r => `- ${r.get('Tên')}: ${r.get('Giá')}`).join('\n');

        // Gọi AI
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý anh Đạt Phan. 
                    Thông tin shop: ${shopProfile}
                    Kho hàng: ${khoHang}
                    Nếu khách chốt đơn (có Tên + SĐT + SP), hãy trả lời và kèm dòng này cuối cùng: [CHOT_DON: Tên | SP | SĐT]`
                },
                { role: "user", content: userMessage }
            ]
        }, { headers: { "Authorization": `Bearer ${AI_KEY}` } });

        let aiReply = response.data.choices[0].message.content;

        // Xử lý ghi vào Sheet 3: Chốt đơn
        if (aiReply.includes("[CHOT_DON:")) {
            try {
                const data = aiReply.split("[CHOT_DON:")[1].split("]")[0].split("|");
                const orderSheet = doc.sheetsByTitle['Chot_Don'];
                await orderSheet.addRow({
                    'Thời gian': new Date().toLocaleString('vi-VN'),
                    'Tên khách': data[0].trim(),
                    'Sản phẩm': data[1].trim(),
                    'Số điện thoại': data[2].trim()
                });
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Hệ thống đã ghi nhận đơn hàng!");
            } catch (err) { console.log("Lỗi ghi đơn"); }
        }

        res.json({ reply: aiReply });

    } catch (error) {
        res.json({ reply: "Dạ em đang bận xíu, anh Đạt kiểm tra tên 3 Sheet nhé!" });
    }
});

app.listen(PORT, () => console.log(`Hệ thống v3 chạy tại cổng ${PORT}`));
