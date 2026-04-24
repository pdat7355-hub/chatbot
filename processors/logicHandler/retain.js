// processors/logicHandler/retain.js

const retainHandler = {
    handle: async (session, message, dimConfig, retainConfig = [], globalInventory = null) => {
        const text = message.toLowerCase();

        // 1. ƯU TIÊN: Tìm câu trả lời khớp với từ khóa (Keywords)
        let bestMatch = null;
        
        // Lọc lấy tất cả các dòng RETAIN trong Excel
        const retainRules = (dimConfig || []).filter(d => d.zone === 'RETAIN');

        for (const rule of retainRules) {
            // Chuyển chuỗi keywords từ Excel (ví dụ: "đẹp, xinh, yêu") thành mảng
            const keywords = String(rule.keywords || "").split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
            
            // Nếu khách nhắn có chứa một trong các từ khóa này
            if (keywords.some(k => text.includes(k))) {
                bestMatch = rule.content || rule.template;
                break; // Tìm thấy câu khớp từ khóa thì lấy luôn
            }
        }

        // 2. NẾU KHÔNG KHỚP TỪ KHÓA: Tìm dòng "Chào hỏi" mặc định
        // (Dòng RETAIN nào mà cột keywords để trống trong Excel)
        if (!bestMatch) {
            const defaultRule = retainRules.find(d => !d.keywords || d.keywords.trim() === "");
            bestMatch = defaultRule?.content || defaultRule?.template;
        }

        // 3. TRẢ VỀ KẾT QUẢ
        if (bestMatch) {
            // Thay thế các biến nếu có
            return bestMatch.replace(/{weight}/g, session.entities?.weight || "---");
        }

        // 4. PHÒNG HỜ (Nếu Excel trống rỗng)
        return "Dạ Hương Kid chào Mẹ nhen! ❤️ Bé nhà mình hôm nay bao nhiêu kg rồi Mẹ nhỉ?";
    }
};

module.exports = retainHandler;
