const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const axios = require('axios');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 1. Cấu hình xác thực từ biến môi trường Render
const S_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const S_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;
const S_ID = process.env.GOOGLE_SHEET_ID;
const AI_KEY = process.env.OPENROUTER_API_KEY;

const auth = new JWT({
    email: S_EMAIL,
    key: S_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 2. Giao diện Cửa sổ Chat chuyên nghiệp
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>AI Sales Master - Đạt Phan</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; margin: 0; display: flex; justify-content: center; }
                #chat-container { width: 100%; max-width: 500px; height: 100vh; background: white; display: flex; flex-direction: column; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                #header { padding: 15px; background: #1a73e8; color: white; text-align: center; font-weight: bold; font-size: 18px; }
                #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
                .msg { margin-bottom: 15px; padding: 12px 16px; border-radius: 18px; max-width: 80%; line-height: 1.5; font-size: 15px; }
                .user { align-self: flex-end; background: #1a73e8; color: white; border-bottom-right-radius: 4px; }
                .bot { align-self: flex-start; background: #e8eaed; color: #202124; border-bottom-left-radius: 4px; }
                #input-area { display: flex; padding: 15px; border-top: 1px solid #eee; background: white; }
                input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 25px; outline: none; font-size: 15px; }
                button { margin-left: 10px; padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; }
                .loading { font-style: italic; color: #888; font-size: 12px; }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="header">TRỢ LÝ BÁN HÀNG ĐẠT PHAN</div>
                <div id="messages"></div>
                <div id="input-area">
                    <input type="text" id="userInput" placeholder="Hỏi giá sản phẩm..." onkeypress="if(event.key==='Enter') sendMessage()">
                    <button onclick="sendMessage()">GỬI</button>
                </div>
            </div>
            <script>
                const msgDiv = document.getElementById('messages');
                async function sendMessage() {
                    const input = document.getElementById('userInput');
                    if(!input.value.trim()) return;

                    const userText = input.value;
                    msgDiv.innerHTML += '<div class="msg user">' + userText + '</div>';
                    input.value = '';
                    msgDiv.scrollTop = msgDiv.scrollHeight;

                    // Hiệu ứng đang trả lời
                    const loadingId = 'load-' + Date.now();
                    msgDiv.innerHTML += '<div class="msg bot loading" id="' + loadingId + '">Đang kiểm tra kho hàng...</div>';

                    try {
                        const res = await fetch('/chat', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ message: userText })
                        });
                        const data = await res.json();
                        document.getElementById(loadingId).remove();
                        msgDiv.innerHTML += '<div class="msg bot">' + data.reply.replace(/\\n/g, '<br>') + '</div>';
                    } catch (e) {
                        document.getElementById(loadingId).innerText = '⚠️ Lỗi kết nối hệ thống.';
                    }
                    msgDiv.scrollTop = msgDiv.scrollHeight;
                }
            </script>
        </body>
        </html>
    `);
});

// 3. Logic xử lý: Đọc Sheet -> Gửi AI -> Trả lời
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        // A. Kết nối Google Sheet
        const doc = new GoogleSpreadsheet(S_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // B. Chuyển dữ liệu Sheet thành văn bản (Xử lý linh hoạt tiêu đề cột)
        let khoHang = rows.map(r => {
            const ten = r.get('Tên') || r.get('Ten') || r.get('Sản phẩm') || r._rawData[0] || "Không tên";
            const gia = r.get('Giá') || r.get('Gia') || r._rawData[1] || "Liên hệ";
            return `Sản phẩm: ${ten} - Giá: ${gia}`;
        }).join('\n');

        // C. Gọi OpenRouter AI
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý bán hàng chuyên nghiệp của anh Đạt Phan. 
                    Dưới đây là danh sách hàng hóa trong kho:
                    ${khoHang}
                    Nhiệm vụ: Chào hỏi lễ phép, báo giá chính xác dựa trên kho, tư vấn nhiệt tình để chốt đơn.`
                },
                { role: "user", content: userMessage }
            ],
            temperature: 0.5
        }, {
            headers: { "Authorization": `Bearer ${AI_KEY}` },
            timeout: 20000
        });

        res.json({ reply: response.data.choices[0].message.content });

    } catch (error) {
        console.error("Lỗi hệ thống:", error.message);
        res.json({ reply: "Dạ em đang bận kiểm tra lại sổ sách một chút, anh hỏi lại em sau vài giây nhé!" });
    }
});

app.listen(PORT, () => console.log(`Hệ thống Live trên cổng ${PORT}`));
