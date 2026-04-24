const consultHandler = require('./consult');
const retainHandler = require('./retain');
const conversionHandler = require('./conversion');
const remedyHandler = require('./remedy'); 
const helpers = require('../../utils/helpers'); // 🔥 Thêm dòng này để gọi bộ xử lý biến

const logicHandler = {
    handleResponse: async (session, text, dimConfig, globalInventory, analysis) => {
        // 1. Lấy kho hàng từ RAM
        const sessionManager = require('../../core/sessionManager');
        const finalInventory = globalInventory || sessionManager.getInventory();
        
        // 2. Chọn Handler
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
            // 3. GỌI HANDLER để lấy nội dung thô từ file Excel
            let response = await selectedHandler.handle(
                session, 
                text, 
                dimConfig, 
                analysis?.retainConfig || [], 
                finalInventory
            );

            // =========================================================
            // 🎯 4. BƯỚC QUAN TRỌNG NHẤT: CÁ NHÂN HÓA NỘI DUNG (FILL VARIABLES)
            // Lồng dữ liệu thật vào các {{dia_chi}}, {{can_nang}}...
            // =========================================================
            response = helpers.formatReply(response, session, finalInventory);

            return response;

        } catch (err) {
            console.error(`❌ Lỗi thực thi tại ${winner}:`, err.message);
            return "Dạ em đây Mẹ ơi, Mẹ nhắn lại giúp em để em kiểm tra kho cho nhen! ❤️";
        }
    }
};

module.exports = logicHandler;
