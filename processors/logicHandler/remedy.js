// processors/logicHandler/remedy.js

const remedyHandler = {
    // Sử dụng đúng bộ tham số giống hệt file retain.js của Đạt
    handle: async (session, message, dimConfig, retainConfig = [], globalInventory = null) => {
        try {
            const text = message.toLowerCase();

            // 1. Lọc tất cả quy tắc vùng REMEDY
            const rules = (dimConfig || []).filter(d => d.zone === 'REMEDY');

            let bestMatch = null;

            // 2. Tìm câu trả lời khớp Keywords
            for (const rule of rules) {
                const keywords = String(rule.keywords || "").split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
                if (keywords.some(k => text.includes(k))) {
                    bestMatch = rule.content || rule.template;
                    break;
                }
            }

            // 3. Nếu không khớp, lấy câu mặc định (keywords rỗng)
            if (!bestMatch) {
                const defaultRule = rules.find(d => !d.keywords || d.keywords.trim() === "");
                bestMatch = defaultRule?.content || defaultRule?.template;
            }

            // 4. Trả về kết quả (Thay thế biến weight)
            if (bestMatch) {
                return bestMatch.replace(/{weight}/g, session.entities?.weight || "---");
            }

            // 5. Dự phòng cuối cùng
            return `Dạ shop Hương Kid nghe đây ạ! Bé mình ${session.entities?.weight || '--'}kg mặc size đại là vừa in nhen Mẹ! ❤️`;

        } catch (err) {
            console.error("❌ Lỗi trong remedy.js:", err.message);
            return "Dạ shop nghe đây Mẹ ơi, Mẹ nhắn lại giúp em nhen!";
        }
    }
};

module.exports = remedyHandler;
