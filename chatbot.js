const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const axios = require('axios'); // Thư viện để gọi API OpenRouter

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 1. Cấu hình Google Sheet
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1-2CB8yW-xgVeY7VMKvinfH1CwMKGiWZJkNC2ENqnl0g';
// 2. Giao diện Chat (Giữ nguyên giao diện xanh đẹp mắt)
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>AI Sales Master - Đạt Phan</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; background: #f0f2f5; margin: 0; }
                #chat-container { width: 100%; max-width: 500px; height: 100vh; background: white; display: flex; flex-direction: column; }
                #header { padding: 15px; background: #1a73e8; color: white; text-align: center; font-weight: bold; font-size: 1.2em; }
                #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
                .msg { margin-bottom: 15px; padding: 12px; border-radius: 15px; max-width: 85%; line-height: 1.5; }
                .user { align-self: flex-end; background: #1a73e8; color: white; }
                .bot { align-self: flex-start; background: #e8eaed; color: #202124; }
                #input-area { display: flex; padding: 15px; border-top: 1px solid #ddd; background: white; }
                input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 25px; outline: none; }
                button { margin-left: 10px; padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="header">AI SALES MASTER v7.0 (ONLINE)</div>
                <div id="messages"></div>
                <div id="input-area">
                    <input type="text" id="userInput" placeholder="Hỏi về sản phẩm hoặc tư vấn...">
                    <button onclick="sendMessage()">GỬI</button>
                </div>
            </div>
            <script>
                async function sendMessage() {
                    const input = document.getElementById('userInput');
                    const msgDiv = document.getElementById('messages');
                    if(!input.value) return;

                    const userText = input.value;
                    msgDiv.innerHTML += '<div class="msg user">' + userText + '</div>';
                    input.value = '';
                    msgDiv.scrollTop = msgDiv.scrollHeight;

                    try {
                        const res = await fetch('/chat', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ message: userText })
                        });
                        const data = await res.json();
                        msgDiv.innerHTML += '<div class="msg bot">' + data.reply.replace(/\\n/g, '<br>') + '</div>';
                    } catch (e) {
                        msgDiv.innerHTML += '<div class="msg bot">⚠️ Lỗi kết nối AI...</div>';
                    }
                    msgDiv.scrollTop = msgDiv.scrollHeight;
                }
            </script>
        </body>
        </html>
    `);
});

// 3. Logic xử lý Chat với OpenRouter AI
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        // A. Đọc dữ liệu từ Google Sheet để làm kiến thức cho AI
        const doc = new GoogleSpreadsheet(SHEET_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // Chuyển dữ liệu Sheet thành văn bản để gửi cho AI
        let khoHang = rows.map(r => `Sản phẩm: \${r.get('Tên')}, Giá: \${r.get('Giá')}`).join('\\n');

        // B. Gọi OpenRouter API (Giống hệt bản Python của Đạt)
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý bán hàng của anh Đạt Phan. Đây là dữ liệu kho hàng hiện tại: \\n\${khoHang}. \\nHãy tư vấn khách hàng nhiệt tình, vui vẻ và chốt đơn.`
                },
                { role: "user", content: userMessage }
            ],
            temperature: 0.3
        }, {
            headers: { "Authorization": `Bearer \${process.env.OPENROUTER_API_KEY}` }
        });

        const aiReply = response.data.choices[0].message.content;
        res.json({ reply: aiReply });

    } catch (error) {
        console.error(error);
        res.json({ reply: "Dạ em đang bận cập nhật kho, anh đợi em xíu nhé!" });
    }
});

app.listen(PORT, () => console.log(`Hệ thống AI Master chạy tại cổng \${PORT}`));
