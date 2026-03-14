const axios = require('axios');
const cheerio = require('cheerio');
const http = require('http');

// Cấu hình các thông số
const PORT = process.env.PORT || 3000;
const URL_SOURCE = 'https://vnexpress.net/chu-de/gia-xang-dau-544';

async function updateGasPrices() {
    console.log("\n--- [START] Bắt đầu quy trình Closed-Loop: Thu thập dữ liệu ---");
    
    try {
        // 1. THU THẬP (Observe)
        const response = await axios.get(URL_SOURCE, {
            headers: { 'User-Agent': 'Mozilla/5.0' } // Giả lập trình duyệt để tránh bị chặn
        });
        const $ = cheerio.load(response.data);

        // 2. PHÂN TÍCH (Analyze)
        // Lưu ý: Chúng ta lấy giá xăng từ tiêu đề hoặc nội dung bài viết mới nhất trên VnExpress
        let gasData = [];
        
        // Tìm các bài báo có chứa thông tin giá
        $('.title-news a').each((i, el) => {
            const title = $(el).text();
            if (title.includes('giá xăng') || title.includes('Giá xăng')) {
                // Ví dụ: "Giá xăng RON 95 giảm về 23.500 đồng"
                gasData.push({ Tin_Moi_Nhat: title });
            }
        });

        // Nếu không cào được web (do cấu trúc thay đổi), trả về dữ liệu mẫu để hệ thống không dừng lại
        if (gasData.length === 0) {
            gasData.push({ 
                Loai: "Dữ liệu mẫu (Hệ thống đang kiểm tra)", 
                Gia: "Đang cập nhật..." 
            });
        }

        // 3. THỰC THI (Execute / Output)
        console.log("Cập nhật thành công lúc:", new Date().toLocaleString());
        console.table(gasData);

        // ĐÂY LÀ NƠI BẠN CÓ THỂ GỬI DỮ LIỆU ĐI:
        // - Gửi qua Socket cho Blender
        // - Ghi vào file Excel (Closed-loop)
        // - Gửi tin nhắn Telegram thông báo

    } catch (error) {
        console.error("Lỗi khi kết nối nguồn dữ liệu:", error.message);
    }
}

// Thiết lập Server để Render không tắt ứng dụng
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write('<h1>Bot Cập Nhật Giá Xăng Đang Chạy...</h1>');
    res.write(`<p>Cập nhật lần cuối: ${new Date().toLocaleString()}</p>`);
    res.end();
});

server.listen(PORT, () => {
    console.log(`Server đang lắng nghe tại Port: ${PORT}`);
    
    // Chạy lần đầu tiên ngay khi khởi động
    updateGasPrices();

    // Tự động chạy lại sau mỗi 30 phút (1.800.000 ms)
    setInterval(updateGasPrices, 1800000);
});
