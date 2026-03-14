const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json()); // Để đọc dữ liệu từ ô chat
const PORT = process.env.PORT || 3000;

// Cấu hình Google Sheet
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEET_ID = '1-2CB8yW-xgVeY7VMKvinfH1CwMKGiWZJkNC2ENqnl0g';

// --- GIAO DIỆN CỬA SỔ CHAT ---
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Bot Bán Hàng Đạt Phan</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; background: #f0f2f5; }
                #chat-container { width: 100%; max-width: 400px; height: 80vh; background: white; margin-top: 20px; display: flex; flex-direction: column; border-radius: 10px; shadow: 0 4px 6px rgba(0,0,0,0.1); }
                #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
                .msg { margin-bottom: 10px; padding: 10px; border-radius: 10px; max-width: 80%; }
                .user { align-self: flex-end; background: #0084ff; color: white; }
                .bot { align-self: flex-start; background: #e4e6eb; color: black; }
                #input-area { display: flex; padding: 10px; border-top: 1px solid #ddd; }
                input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px; outline: none; }
                button { margin-left: 10px; padding: 10px 20px; background: #0084ff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div style="padding: 15px; background: #0084ff; color: white; border-radius: 10px 10px 0 0; text-align: center; font-weight: bold;">
                    TRỢ LÝ BÁN HÀNG ĐẠT PHAN
                </div>
                <div id="messages"></div>
                <div id="input-area">
                    <input type="text" id="userInput" placeholder="Hỏi giá hoặc tư vấn...">
                    <button onclick="sendMessage()">Gửi</button>
                </div>
            </div>

            <script>
                async function sendMessage() {
                    const input = document.getElementById('userInput');
                    const msgDiv = document.getElementById('messages');
                    if(!input.value) return;

                    // Hiện tin nhắn người dùng
                    msgDiv.innerHTML += '<div class="msg user">' + input.value + '</div>';
                    const userMsg = input.value;
                    input.value = '';

                    // Gọi API xử lý
                    const res = await fetch('/chat', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ message: userMsg })
                    });
                    const data = await res.json();

                    // Hiện tin nhắn Bot
                    msgDiv.innerHTML += '<div class="msg bot">' + data.reply + '</div>';
                    msgDiv.scrollTop = msgDiv.scrollHeight;
                }
            </script>
        </body>
        </html>
    `);
});

// --- LOGIC XỬ LÝ CHAT ---
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    
    try {
        // 1. Đọc giá từ Sheet
        const doc = new GoogleSpreadsheet(SHEET_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // Tìm sản phẩm (ví dụ khách hỏi có chữ "bánh xe")
        const sp = rows.find(r => userMessage.toLowerCase().includes(r.get('Tên').toLowerCase()));
        
        let gia = sp ? sp.get('Giá') : "Liên hệ";
        let tenSP = sp ? sp.get('Tên') : "sản phẩm";

        // 2. Chỗ này Đạt sẽ dán API AI vào để trả lời mượt hơn
        // Hiện tại mình làm mẫu trả lời tự động:
        let phanHoi = `Chào anh Đạt! Dòng sản phẩm \${tenSP} hiện có giá là \${gia}. Anh có muốn chốt đơn luôn không ạ?`;

        res.json({ reply: phanHoi });
    } catch (e) {
        res.json({ reply: "Dạ, em đang bận chút, anh đợi em xíu nhé!" });
    }
});

app.listen(PORT, () => console.log(`Server live at \${PORT}`));
