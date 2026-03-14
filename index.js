const axios = require('axios');
const cheerio = require('cheerio');

async function updateGasPrices() {
    console.log("--- Bắt đầu quy trình cập nhật giá xăng dầu ---");
    
    try {
        // 1. Thu thập (Observe): Lấy dữ liệu từ nguồn tin tức
        const response = await axios.get('https://giaxangdau.net/');
        const $ = cheerio.load(response.data);

        // 2. Phân tích (Analyze): Trích xuất giá xăng từ bảng dữ liệu của trang web
        // Lưu ý: Selector này có thể thay đổi tùy theo cấu trúc trang web nguồn
        const fuelData = [];
        $('table tr').each((index, element) => {
            const name = $(element).find('td').eq(0).text().trim();
            const price = $(element).find('td').eq(1).text().trim();
            
            if (name.includes("RON 95") || name.includes("E5 RON 92")) {
                fuelData.push({ Loai: name, Gia: price });
            }
        });

        // 3. Thực thi (Execute/Output): In kết quả hoặc chuẩn bị gửi cho Blender/Excel
        if (fuelData.length > 0) {
            console.log("Cập nhật thành công lúc:", new Date().toLocaleString());
            console.table(fuelData);
            
            // Ở đây bạn có thể thêm code để gửi JSON này qua Socket cho Blender
            // hoặc ghi vào file Excel như mô hình "Closed-Loop" của bạn.
        } else {
            console.log("Không tìm thấy dữ liệu giá xăng. Vui lòng kiểm tra lại nguồn.");
        }

    } catch (error) {
        console.error("Lỗi khi cập nhật giá xăng:", error.message);
    }
}

// Chạy ngay khi khởi động
updateGasPrices();

// Tự động cập nhật mỗi 1 tiếng (3600000ms) để giữ server Render không ngủ
setInterval(updateGasPrices, 3600000);

// Tạo một HTTP server đơn giản để Render không báo lỗi "Port timeout"
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Gas Price Bot is running...\n');
});
server.listen(process.env.PORT || 3000);
