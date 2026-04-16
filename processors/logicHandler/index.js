
const consultHandler = require('./consult');
const conversionHandler = require('./conversion');
const retainHandler = require('./retain'); 
const systemChecker = require('../../utils/systemChecker');

// --- CƠ CHẾ NẠP FILE AN TOÀN (SAFE REQUIRE) ---
// Giúp Server không bị sập nếu Đạt chưa kịp tạo file remedy.js
let remedyHandler;
try {
    remedyHandler = require('./remedy');
} catch (e) {
    console.warn("⚠️ Cảnh báo: Chưa tìm thấy file remedy.js. Hệ thống sẽ dùng luồng dự phòng.");
    remedyHandler = null; 
}

const logicHandler = {
    handleResponse: async (session, message, dimConfig) => {
        let response = "";
        let sourceFile = "";

        // 1. Lấy Winner từ Analyzer (Mặc định là RETAIN nếu trống)
        let currentWinner = session.winner || 'RETAIN';

        // 2. KIỂM SOÁT CỬA NGÕ (Closed-Loop logic)
        // Ngăn chặn việc Bot đòi chốt đơn khi giỏ hàng trống
        const isCartEmpty = !session.cart || session.cart.length === 0;
        const isPickingProduct = session.entities && session.entities.productCode;

        if (currentWinner === 'CONVERSION' && isCartEmpty && !isPickingProduct) {
            console.log("🔄 Ép luồng: Chốt đơn rỗng -> Chuyển về Tư vấn/Chào hỏi");
            currentWinner = 'RETAIN';
            session.winner = 'RETAIN'; 
        }

        // 3. ĐIỀU PHỐI LUỒNG CHUẨN
        switch (currentWinner) {
            case 'CONVERSION':
                response = await conversionHandler.handle(session, message);
                sourceFile = "conversion.js";
                // Nếu file conversion từ chối xử lý (trả về null), dùng retain làm dự phòng
                if (!response) {
                    response = await retainHandler.handle(session, message);
                    sourceFile = "retain.js";
                }
                break;

            case 'CONSULT':
                response = await consultHandler.handle(session, message);
                sourceFile = "consult.js";
                break;

            case 'REMEDY':
                // Nếu có file remedy thì dùng, không thì nhảy về Retain cho an toàn
                if (remedyHandler && typeof remedyHandler.handle === 'function') {
                    response = await remedyHandler.handle(session, message);
                    sourceFile = "remedy.js";
                } else {
                    response = await retainHandler.handle(session, message);
                    sourceFile = "retain.js";
                }
                break;

            case 'RETAIN':
            default:
                return await retainHandler.handle(session, message, dimConfig);
                sourceFile = "retain.js";
                break;
        }

        // 4. TRÍCH XUẤT TRACE (Bảng kiểm soát lộ trình cho Đạt)
        try {
            const trace = systemChecker.runDiagnostic(session, session.zones, currentWinner, sourceFile);
            return `${response}\n\n${trace}`;
        } catch (err) {
            console.error("Lỗi Diagnostic:", err);
            return response; // Trả về câu trả lời thôi nếu bảng trace bị lỗi
        }
    }
};

module.exports = logicHandler;
