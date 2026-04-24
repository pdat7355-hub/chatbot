const consultHandler = require('./consult');
const retainHandler = require('./retain');
const conversionHandler = require('./conversion');
const remedyHandler = require('./remedy'); 
const helpers = require('../../utils/helpers'); 

const logicHandler = {
    handleResponse: async (session, text, dimConfig, globalInventory, analysis) => {
        // 1. Lấy kho hàng từ RAM
        const sessionManager = require('../../core/sessionManager');
        const finalInventory = globalInventory || sessionManager.getInventory();
        
        // 2. Chọn Handler (CONSULT, RETAIN, CONVERSION, REMEDY)
        const winner = session.winner || "CONSULT";
        let selectedHandler;

        switch (winner) {
            case 'CONVERSION': selectedHandler = conversionHandler; break;
            case 'RETAIN': selectedHandler = retainHandler; break;
            case 'REMEDY': selectedHandler = remedyHandler; break;
            case 'CONSULT': 
            default: selectedHandler = consultHandler; break;
        }

        try {
            // 3. GỌI HANDLER để lấy nội dung (Có thể là String hoặc Object hình ảnh)
            let response = await selectedHandler.handle(
                session, 
                text, 
                dimConfig, 
                analysis?.retainConfig || [], 
                finalInventory
            );

            // =========================================================
            // 🎯 4. BƯỚC SỬA LỖI: CHỈ CÁ NHÂN HÓA NẾU LÀ VĂN BẢN (STRING)
            // =========================================================
            if (typeof response === 'string') {
                // Chỉ chạy formatReply (vốn chứa lệnh .replace) khi response là chữ
                response = helpers.formatReply(response, session, finalInventory);
            } else {
                // Nếu là Object (Template Facebook), chúng ta giữ nguyên 
                // vì các biến {weight}, {size} đã được xử lý xong trong consult.js rồi.
                console.log(`[Hương Kid] Gửi Template hình ảnh cho khách: ${session.userName}`);
            }

            return response;

        } catch (err) {
            console.error(`❌ Lỗi thực thi tại ${winner}:`, err.message);
            // Log chi tiết để Đạt dễ debug
            console.error(err.stack);
            return "Dạ em đây Mẹ ơi, Mẹ nhắn lại giúp em để em kiểm tra kho cho nhen! ❤️";
        }
    }
};

module.exports = logicHandler;
