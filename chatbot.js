require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

// --- 1. GIAO DIỆN CHAT CHUYÊN NGHIỆP (Thay cho app.use static) ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Hương Kid Support</title>
            <style>
                body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                #chat-container { width: 100%; max-width: 450px; height: 90vh; background: white; box-shadow: 0 8px 24px rgba(0,0,0,0.1); border-radius: 15px; display: flex; flex-direction: column; overflow: hidden; }
                #header { background: #0084ff; color: white; padding: 15px; text-align: center; font-weight: bold; font-size: 1.1em; }
                #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: #ffffff; }
                .msg { max-width: 85%; padding: 10px 15px; border-radius: 18px; font-size: 14.5px; line-height: 1.5; word-wrap: break-word; }
                .user { align-self: flex-end; background: #0084ff; color: white; border-bottom-right-radius: 4px; }
                .bot { align-self: flex-start; background: #e4e6eb; color: #050505; border-bottom-left-radius: 4px; white-space: pre-wrap; }
                #input-area { padding: 15px; border-top: 1px solid #eee; display: flex; background: white; }
                input { flex: 1; border: 1px solid #ddd; padding: 12px 18px; border-radius: 25px; outline: none; transition: border 0.3s; }
                input:focus { border-color: #0084ff; }
                button { background: #0084ff; color: white; border: none; width: 42px; height: 42px; border-radius: 50%; margin-left: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
                button:hover { transform: scale(1.05); }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="header">Hương Kid - Thời trang bé trai</div>
                <div id="messages"></div>
                <div id="input-area">
                    <input type="text" id="userInput" placeholder="Nhắn tin cho shop..." onkeypress="if(event.key==='Enter') sendMessage()">
                    <button onclick="sendMessage()">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    </button>
                </div>
            </div>
            <script>
                const messageContainer = document.getElementById('messages');
                
                // Tin nhắn chào mừng mặc định
                window.onload = () => {
                    addMessage("Dạ shop Hương Kid chào chị ạ! Em có thể giúp gì cho bé nhà mình không chị?", 'bot');
                };

                function addMessage(text, sender) {
                    const div = document.createElement('div');
                    div.className = 'msg ' + sender;
                    div.innerHTML = text;
                    messageContainer.appendChild(div);
                    messageContainer.scrollTop = messageContainer.scrollHeight;
                }

                async function sendMessage() {
                    const input = document.getElementById('userInput');
                    const text = input.value.trim();
                    if (!text) return;

                    addMessage(text, 'user');
                    input.value = '';

                    try {
                        const res = await fetch('/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: text })
                        });
                        const data = await res.json();
                        // Chuyển đổi xuống dòng để hiển thị đẹp
                        const formattedResponse = data.reply.replace(/\\n/g, '<br>');
                        addMessage(formattedResponse, 'bot');
                    } catch (e) {
                        addMessage("Dạ, hệ thống đang bận chút, chị nhắn lại sau nha!", 'bot');
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// --- 2. CẤU HÌNH XÁC THỰC VÀ CÁC PHẦN TIẾP THEO (Giữ nguyên phần dưới của anh) ---

// --- PHẦN 1: CẤU HÌNH XÁC THỰC GOOGLE SHEETS ---
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// --- PHẦN 2: HÀM ĐỌC DỮ LIỆU TỪ 3 FILE EXCEL ---
async function getAppData() {
    try {
        // Đọc File Thông Tin Shop (Địa chỉ, chính sách...)
        const docInfo = new GoogleSpreadsheet(process.env.ID_FILE_INFO, auth);
        await docInfo.loadInfo();
        const infoRows = await docInfo.sheetsByIndex[0].getRows();
        const shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        // Đọc File Danh Sách Sản Phẩm (Tên, Giá, Size, Mô tả)
        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const prodRows = await docProd.sheetsByIndex[0].getRows();
        const khoHang = prodRows.map(r => `- ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | Lưu ý: ${r.get('Mô tả')}`).join('\n');

        return { shopProfile, khoHang };
    } catch (err) {
        console.error("Lỗi đọc Sheets:", err);
        return { shopProfile: "Lỗi kết nối", khoHang: "Lỗi kết nối" };
    }
}

// --- PHẦN 3: XỬ LÝ CHAT VỚI AI (OPENROUTER) ---
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const { shopProfile, khoHang } = await getAppData();

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto", // AI sẽ tự chọn model thông minh nhất
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý bán hàng chuyên nghiệp của shop "Hương Kid - Thời trang bé trai". 
                    
                    DỮ LIỆU CỬA HÀNG:
                    - Thông tin shop & Chính sách: ${shopProfile}
                    - Danh sách sản phẩm: ${khoHang}

                    QUY TRÌNH TƯ VẤN (BÁM SÁT):
                    1. Niềm nở, gọi khách là "chị/mẹ" và xưng "em/shop".
                    2. Khi khách hỏi đồ, phải hỏi "Bé nặng bao nhiêu kg" để tư vấn size chuẩn nhất.
                    3. Chỉ chốt đơn khi có đủ 4 thông tin: Tên khách, SĐT, Sản phẩm (kèm size), và ĐỊA CHỈ GIAO HÀNG.
                    4. Nếu thiếu địa chỉ, hãy nhắc khách khéo léo.
                    
                    CÚ PHÁP GHI ĐƠN (QUAN TRỌNG):
                    Khi đủ 4 thông tin, hãy tóm tắt đơn và viết dòng này ở cuối:
                    [CHOT_DON: Tên khách | Sản phẩm (Size) | SĐT | Địa chỉ]`
                },
                { role: "user", content: userMessage }
            ]
        }, { 
            headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } 
        });

        let aiReply = response.data.choices[0].message.content;

        // --- PHẦN 4: TỰ ĐỘNG GHI ĐƠN VÀO EXCEL KHI CÓ CÚ PHÁP [CHOT_DON:] ---
        if (aiReply.includes("[CHOT_DON:")) {
            try {
                const docOrder = new GoogleSpreadsheet(process.env.ID_FILE_ORDER, auth);
                await docOrder.loadInfo();
                const orderSheet = docOrder.sheetsByIndex[0];

                // Tách dữ liệu từ câu trả lời của AI
                const orderRaw = aiReply.split("[CHOT_DON:")[1].split("]")[0];
                const parts = orderRaw.split("|").map(p => p.trim());

                await orderSheet.addRow({
                    'Thời gian': new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                    'Tên khách': parts[0],
                    'Sản phẩm': parts[1],
                    'Số điện thoại': parts[2],
                    'Địa chỉ': parts[3]
                });

                // Thay thế mã code bằng lời chào thân thiện khi gửi cho khách
                aiReply = aiReply.replace(/\[CHOT_DON:.*?\]/g, "✅ Đã ghi nhận đơn hàng thành công! Chị Hương sẽ gọi xác nhận sớm ạ.");
            } catch (err) {
                console.error("Lỗi ghi đơn vào Sheets:", err);
            }
        }

        res.json({ reply: aiReply });

    } catch (error) {
        res.status(500).json({ reply: "Dạ hệ thống đang bận chút, chị nhắn lại sau ít phút nhé!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Chatbot shop chị Hương đang chạy tại cổng ${PORT}`));
