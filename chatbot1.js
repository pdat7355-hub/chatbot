const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const axios = require('axios');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Lấy thông tin từ Render Environment Variables
const S_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const S_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;
const S_ID = process.env.GOOGLE_SHEET_ID;
const AI_KEY = process.env.OPENROUTER_API_KEY;

const auth = new JWT({
    email: S_EMAIL,
    key: S_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Debug Bot - Đạt Phan</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:sans-serif; padding:20px; background:#f4f4f4;">
            <div id="chat-container" style="max-width:500px; margin:auto; background:white; padding:20px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                <h3>Hệ Thống Trợ Lý AI</h3>
                <div id="log" style="height:300px; overflow-y:auto; border:1px solid #ddd; padding:10px; margin-bottom:10px; background:#fafafa; font-size:13px;"></div>
                <input type="text" id="inp" style="width:75%; padding:10px;" placeholder="Hỏi gì đó...">
                <button onclick="send()" style="width:20%; padding:10px; background:#007bff; color:white; border:none;">Gửi</button>
            </div>
            <script>
                async function send() {
                    const log = document.getElementById('log');
                    const txt = document.getElementById('inp').value;
                    log.innerHTML += '<b>Bạn:</b> ' + txt + '<br>';
                    const res = await fetch('/chat', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ message: txt })
                    });
                    const data = await res.json();
                    log.innerHTML += '<b>Bot:</b> ' + data.reply + '<br><hr>';
                    log.scrollTop = log.scrollHeight;
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/chat', async (req, res) => {
    const msg = req.body.message;
    let step = "Bắt đầu";
    try {
        // Kiểm tra biến môi trường
        if (!S_EMAIL || !S_KEY || !S_ID) {
            return res.json({ reply: "LỖI: Thiếu biến môi trường GOOGLE (Email, Key hoặc ID) trên Render." });
        }
        if (!AI_KEY) {
            return res.json({ reply: "LỖI: Thiếu OPENROUTER_API_KEY trên Render." });
        }

        step = "Đang kết nối Google Sheet";
        const doc = new GoogleSpreadsheet(S_ID, auth);
        await doc.loadInfo();
        
        step = "Đang đọc dữ liệu hàng hóa";
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // Chuyển dữ liệu thành văn bản (Xử lý cả trường hợp cột không có dấu)
        let dataHàng = rows.map(r => {
            const ten = r.get('Tên') || r.get('Ten') || "Không tên";
            const gia = r.get('Giá') || r.get('Gia') || "Liên hệ";
            return `SP: ${ten} - Giá: ${gia}`;
        }).join('\n');

        step = "Đang gọi AI OpenRouter";
        const aiRes = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                { role: "system", content: `Bạn là trợ lý anh Đạt Phan. Dữ liệu kho: ${dataHàng}` },
                { role: "user", content: msg }
            ]
        }, { headers: { "Authorization": `Bearer ${AI_KEY}` }, timeout: 15000 });

        res.json({ reply: aiRes.data.choices[0].message.content });

    } catch (err) {
        console.error(err);
        res.json({ reply: `LỖI tại bước [${step}]: ${err.message}` });
    }
});

app.listen(PORT, () => console.log("Bot Live!"));
