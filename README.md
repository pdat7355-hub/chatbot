# chatbot
HUONG_KID_BOT_V2/
├── .env                  # Lưu ID Excel, Private Key
├── server.js             # File chạy chính (Web Server)
├── core/
│   └── sessionManager.js # Quản lý trí nhớ khách hàng
├── processors/
│   ├── analyzer.js       # Bóc tách Mã SP, SĐT, Cân nặng
│   └── logicHandler   # Bộ não tư vấn & chốt đơn
│          └── index.js # File điều phối (Entry Point)
│          └── consult.js # Chuyên xử lý Tư vấn (Mã hàng, Kho, Size)
│          └── conversion.js # Chuyên xử lý Chốt đơn (SĐT, Địa chỉ, Đơn hàng)
│          └── fallback.js # Chuyên xử lý Giao tiếp ngoài lề (Sheet Giao Tiep)
│          └── retain.js # Chuyên xử lý Giao tiếp chào hỏi
│          └── remedy
│          └── cart
├── services/
│   └── assetMapper.js   # 
│   └── googleSheets.js   # Kết nối Excel (Đọc/Ghi)
│   └── orderServices.js   # 
├── utils/
│   └── helpers.js        # Hàm phụ trợ (Map size, khử dấu)
│   └──systemChecker.js        # Hàm kiểm tra chatbot hoạt động như thế nào
└── public/
    └── index.html        # Giao diện Mobile
    └── css
           └── style.css
    └── js
           └── chat.js # Giao diện tin nhắn


📂 CHI TIẾT CẤU TRÚC HỆ THỐNG HUONG_KID_BOT_V2
1. Tầng Khởi tạo & Cấu hình (Root)
.env: Nơi lưu giữ các "bí mật" của hệ thống (API Key, Spreadsheet ID). Tuyệt đối không chia sẻ file này để bảo vệ dữ liệu shop.
server.js: Trạm điều phối trung tâm. Sử dụng Express.js để hứng tin nhắn từ giao diện web và chuyển cho các bộ phận xử lý. Đây là nơi bắt đầu của mọi yêu cầu.
2. Tầng Quản lý Trạng thái (core/)
sessionManager.js: Đóng vai trò "Thư ký riêng" cho từng khách hàng. Nó lưu lại khách đang ở bước nào (vừa hỏi giá hay đang nhập địa chỉ) để Bot không bị "ngáo" khi khách chat nhiều câu liên tiếp.
3. Tầng Xử lý Logic (Bộ não - processors/)
Đây là nơi thay đổi lớn nhất, chia thành các chuyên khoa riêng biệt:
analyzer.js: "Thám tử" đọc hiểu tin nhắn. Nhiệm vụ duy nhất là dùng Regex để bóc ra: Mã hàng (AT01), SĐT (090...), Cân nặng (15kg).
logicHandler/: Bộ não điều phối chính.
index.js: Cổng vào của logic. Nó sẽ xem kết quả từ analyzer rồi quyết định gửi dữ liệu sang file nào (Tư vấn hay Chốt đơn).
consult.js: Chuyên gia sản phẩm. Chạy vào Sheet8 kiểm tra hàng còn hay hết, giá bao nhiêu, tư vấn size dựa trên cân nặng.
conversion.js: Sát thủ chốt đơn. Khi khách có ý định mua, file này sẽ lo thu thập SĐT, địa chỉ và gửi lệnh ghi đơn vào Sheet_Don_Hang.
fallback.js: Nhân viên tiếp tân. Xử lý các câu hỏi ngoài lề dựa trên file "Giao tiếp" trong Excel (ví dụ: "Shop ở đâu?", "Ship bao nhiêu?").
retain.js: Chào hỏi & Giữ chân. Lo các câu xã giao đầu buổi hoặc cuối buổi để tăng thiện cảm.
remedy/: Xử lý các tình huống lỗi hoặc khi khách muốn sửa đổi thông tin đã nhập.
cart/: Quản lý giỏ hàng tạm thời cho khách trước khi chốt đơn chính thức.
4. Tầng Dịch vụ & Công cụ (services/ & utils/)
googleSheets.js: "Nhân viên kho bãi" mẫn cán. Chỉ làm nhiệm vụ kỹ thuật: Kết nối, Đọc dòng, Ghi dòng lên Google Sheets.
helpers.js: Bộ dụng cụ vạn năng. Chứa các hàm như: khu_dau_tieng_viet(), mapping_can_nang_sang_size(), dinh_dang_tien_vnd().
5. Tầng Giao diện (public/)
Đã được tách bạch rõ ràng để dễ nâng cấp UI:
index.html: Cấu trúc khung của ứng dụng (Mobile First).
css/style.css: Nơi làm cho bong bóng chat và giao diện shop trở nên lung linh, dễ nhìn trên điện thoại.
js/chat.js: Xử lý hiệu ứng hiển thị tin nhắn, âm thanh thông báo và gửi dữ liệu sang server.js.
