const googleSheets = require('../../services/googleSheets');

const fallbackHandler = {
    process: async (message) => {
        try {
            // Tìm câu trả lời tương ứng trong Excel Giao Tiếp
            const extraReply = await googleSheets.getChatResponse(message);
            
            // Nếu tìm thấy thì trả về, không thì dùng câu chào mặc định
            return extraReply || "Dạ shop Hương Kid nghe đây ạ! Mẹ cần em tư vấn mẫu chi cho bé rứa Mẹ ơi?";
        } catch (e) {
            return "Dạ Mẹ nhắn chi em chưa rõ lắm, Mẹ nói rõ hơn để em hỗ trợ mình nhen!";
        }
    }
};

module.exports = fallbackHandler;
