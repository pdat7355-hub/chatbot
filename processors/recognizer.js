// processors/recognizer.js
const googleSheets = require('../services/googleSheets');

/**
 * Hàm nhận diện khách hàng từ Excel
 * Trả về session đã được nạp dữ liệu cũ (nếu có)
 */
async function identify(userId, session) {
    // 1. Nếu đã nhận diện trong phiên này rồi thì thôi, 
    // hoặc nếu session rỗng (trường hợp hiếm) thì thoát sớm.
    if (!session || session.isRecognized) return session;

    try {
        // Tìm thông tin khách trong Sheet bằng userId (ID Facebook/Zalo/Webhook)
        const customerData = await googleSheets.findCustomerById(userId);

        if (customerData) {
            // Đảm bảo entities luôn là một object
            if (!session.entities) session.entities = {};

            // 2. CƠ CHẾ "BƠM" DỮ LIỆU THÔNG MINH
            // Chúng ta lấy dữ liệu từ Excel làm "nền", 
            // sau đó lấy những gì khách vừa nhắn trong phiên này "đè" lên.
            
            const excelData = {
                name: customerData.Ho_Ten || "",
                phone: String(customerData.SDT || ""), // Ép kiểu chuỗi để tránh lỗi định dạng số trong Excel
                address: customerData.Dia_Chi || "",
                weight: customerData.Can_Nang_1 || customerData.Can_Nang || "", // Linh hoạt tên cột
            };

            // Lọc ra các thực thể thực sự có giá trị trong session hiện tại
            const currentSessionEntities = Object.fromEntries(
                Object.entries(session.entities).filter(([_, v]) => v != null && v !== "")
            );

            // Gộp lại: Dữ liệu Excel làm gốc, Session hiện tại ghi đè lên
            session.entities = {
                ...excelData,
                ...currentSessionEntities
            };
            
            // 3. Đánh dấu đã nhận diện thành công
            session.isRecognized = true;
            
            // Log xanh để Đạt dễ theo dõi trên Terminal
            console.log(`\x1b[32m🔍 [Recognizer] Khách quen quay lại: ${excelData.name || userId} (${excelData.weight}kg)\x1b[0m`);
        } else {
            // Đánh dấu luôn là true để không quét lại Excel vô ích trong cùng 1 phiên chat
            session.isRecognized = true; 
            console.log(`🔍 [Recognizer] Khách mới hoàn toàn: ${userId}`);
        }
    } catch (err) {
        console.error("❌ [Recognizer Error]:", err.message);
        // Không chặn luồng chính, nếu lỗi vẫn trả về session để Bot chạy tiếp
    }

    return session;
}

module.exports = { identify };
