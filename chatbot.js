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

app.get('/', (req, res) => { res.send('<h1>Hệ thống AI Master v3 - Đạt Phan</h1>'); });

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    try {
        const doc = new GoogleSpreadsheet(S_ID, auth);
        await doc.loadInfo();

        // 1. LẤY THÔNG TIN SHOP (Tab: Thong_Tin_Shop)
        const infoSheet = doc.sheetsByTitle['Thong_Tin_Shop'];
        const infoRows = await infoSheet.getRows();
        let infoShop = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        // 2. LẤY DANH SÁCH SẢN PHẨM (Tab: Danh_Sach_SP)
        const productSheet = doc.sheetsByTitle['Danh_Sach_SP'];
        const prodRows = await productSheet.getRows();
        let khoHang = prodRows.map(r => `- ${r.get('Tên')}: ${r.get('Giá')}`).join('\n');

        // 3. GỌI AI ĐỂ XỬ LÝ TƯ VẤN
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý bán hàng của anh Đạt Phan.
                    Đây là THÔNG TIN SHOP:
                    ${infoShop}
                    
                    Đây là DANH SÁCH SẢN PHẨM TRONG KHO:
                    ${khoHang}
                    
                    Nhiệm vụ: Dựa vào thông tin shop và kho để tư vấn. Nếu khách chốt đơn, hãy yêu cầu khách để lại: Tên, Sản phẩm muốn mua và Số điện thoại.`
                },
                { role: "user", content: userMessage }
            ],
            temperature: 0.3
        }, { headers: { "Authorization": `Bearer ${AI_KEY}` } });

        const aiReply = response.data.choices[0].message.content;

        // 4. TỰ ĐỘNG GHI CHỐT ĐƠN (Nếu AI phát hiện khách để lại thông tin đơn hàng)
        // (Logic đơn giản: Nếu tin nhắn có số điện thoại và tên sản phẩm, chúng ta sẽ lưu vào Tab Chot_Don)
        if (userMessage.includes("0") && userMessage.length > 20) {
            const orderSheet = doc.sheetsByTitle['Chot_Don'];
            await orderSheet.addRow({
                'Thời gian': new Date().toLocaleString('vi-VN'),
                'Tên khách': 'Khách hàng mới', 
                'Sản phẩm': 'Đang kiểm tra...',
                'Số điện thoại': userMessage.match(/\d+/g)?.[0] || 'N/A'
            });
        }

        res.json({ reply: aiReply });

    } catch (error) {
        console.error(error);
        res.json({ reply: "Hệ thống đang bận, Đạt kiểm tra lại tên các Sheet nhé!" });
    }
});

app.listen(PORT, () => console.log(`Hệ thống chạy chuẩn 3 Sheet tại cổng ${PORT}`));
