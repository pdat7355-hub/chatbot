require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());
app.use(express.static('public')); 

let chatHistory = [];

const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getAppData() {
    try {
        const docProd = new GoogleSpreadsheet(process.env.ID_FILE_PRODUCT, auth);
        await docProd.loadInfo();
        const prodRows = await docProd.sheetsByIndex[0].getRows();
        const khoHang = prodRows.map(r => 
            `- SP: ${r.get('Tên')} | Giá: ${r.get('Giá')} | Size: ${r.get('Size')} | LinkAnh: ${r.get('Ảnh') || ''}`
        ).join('\n');
        return { khoHang };
    } catch (err) { return { khoHang: "" }; }
}

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    const { khoHang } = await getAppData();
    chatHistory.push({ role: "user", content: message });
    if (chatHistory.length > 10) chatHistory.shift();

    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "google/gemini-2.0-flash-001", 
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý shop Hương Kid. Kho: ${khoHang}. 
                    BẮT BUỘC: Khi nhắc tên SP, phải kèm mã ảnh: [IMG]Link_Ảnh[/IMG].
                    Ví dụ: "Dạ đây là Áo Dinosaur [IMG]https://i.ibb.co/abc.jpg[/IMG] ạ."`
                },
                ...chatHistory
            ]
        }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` } });

        let aiReply = response.data.choices[0].message.content;
        chatHistory.push({ role: "assistant", content: aiReply });
        res.json({ reply: aiReply });
    } catch (error) { res.status(500).json({ reply: "Lỗi rồi anh Đạt ơi!" }); }
});

app.listen(process.env.PORT || 3000);
