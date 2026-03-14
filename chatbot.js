const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const axios = require('axios');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Cấu hình xác thực từ biến môi trường Render
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const S_ID = process.env.GOOGLE_SHEET_ID;
const AI_KEY = process.env.OPENROUTER_API_KEY;

app.get('/', (req, res) => { res.send('<h1>Hệ thống AI Master v3 - Đạt Phan Đang Chạy...</h1>'); });

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const doc = new GoogleSpreadsheet(S_ID, auth);
        await doc.loadInfo();

        // 1. ĐỌC THÔNG TIN SHOP
        const infoSheet = doc.sheetsByTitle['Thong_Tin_Shop'];
        const infoRows = await infoSheet.getRows();
        let shopProfile = infoRows.map(r => `${r.get('Hạng mục')}: ${r.get('Nội dung')}`).join('\n');

        // 2. ĐỌC DANH SÁCH SẢN PHẨM
        const productSheet = doc.sheetsByTitle['Danh_Sach_SP'];
        const prodRows = await productSheet.getRows();
        let khoHang = prodRows.map(r => `- ${r.get('Tên')}: ${r.get('Giá')} (Mã: ${r.get('Mã_SP') || 'N/A'})`).join('\n');

        // 3. GỌI AI TƯ VẤN (Sử dụng Model Auto của OpenRouter)
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openrouter/auto",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý bán hàng chuyên nghiệp của anh Đạt Phan. 
                    THÔNG TIN SHOP: \n${shopProfile}
                    KHO HÀNG: \n${khoHang}
                    
                    NHIỆM VỤ:
                    - Trả lời khách dựa trên thông tin shop và kho.
                    - Nếu khách muốn mua, hãy xin Tên và Số điện thoại.
                    - Nếu khách đã cung cấp Tên + SĐT + Sản phẩm, hãy kết thúc câu trả lời bằng dòng chữ: [LỆNH_CHỐT_ĐƠN: Tên khách | Sản phẩm | SĐT]`
                },
                { role: "user", content: userMessage }
            ],
            temperature: 0.3
        }, { headers: { "Authorization": `Bearer ${AI_KEY}` } });

        const aiReply = response.data.choices[0].message.content;

        // 4. TỰ ĐỘNG GHI CHỐT ĐƠN (Phân luồng dữ liệu ra Sheet Chot_Don)
        if (aiReply.includes("[LỆNH_CHỐT_ĐƠN:")) {
            try {
                const orderData = aiReply.split("[LỆNH_CHỐT_ĐƠN:")[1].split("]")[0].split("|");
                const orderSheet = doc.sheetsByTitle['Chot_Don'];
                await orderSheet.addRow({
                    'Thời gian': new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                    'Tên khách': orderData[0].trim(),
                    'Sản phẩm': orderData[1].trim(),
                    'Số điện thoại': orderData[2].trim()
                });
            } catch (e) { console.log("Lỗi ghi đơn hàng:", e.message); }
        }

        res.json({ reply: aiReply.replace(/\[LỆNH_CHỐT_ĐƠN:.*?\]/g, "✅ Đã ghi nhận đơn hàng của anh/chị!") });

    } catch (error) {
        console.error(error);
        res.json({ reply: "Dạ, em đang bận cập nhật dữ liệu kho, anh Đạt chờ em xíu nhé!" });
    }
});

app.listen(PORT, () => console.log(`Hệ thống AI Master v3 Live tại cổng ${PORT}`));
