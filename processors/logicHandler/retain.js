
const retainHandler = {
    handle: async (session, message, dimConfig) => {
        const text = message.toLowerCase();

        if (text.includes("hủy") || text.includes("quay lại")) {
            session.cart = [];
            session.entities = { productCode: null, weight: null, address: null, phone: null };
            session.flags = {};
            
            let categoryButtons = "";
            
            // 🛠 CƠ CHẾ DÒ TÌM NHÓM HÀNG TỪ EXCEL
            // Đạt lưu ý: dimConfig thường là một Mảng các Object dòng hàng
            if (Array.isArray(dimConfig) && dimConfig.length > 0) {
                const groupSet = new Set();

                dimConfig.forEach(row => {
                    // Dò tìm giá trị trong các cột phổ biến mà Đạt hay đặt
                    // Mình quét cả 'nhóm', 'group', 'category' hoặc cột đầu tiên nếu không thấy
                    const groupValue = row.nhóm || row.group || row.category || row.type || Object.values(row)[0];
                    
                    if (groupValue && isNaN(groupValue)) {
                        groupSet.add(groupValue.toString().trim());
                    }
                });

                // Chuyển Set thành danh sách nút bấm
                [...groupSet].forEach(name => {
                    categoryButtons += `👉 [✨ ${name.toUpperCase()}]\n`;
                });
            }

            // ⚠️ CỨU CÁNH: Nếu vẫn trống (do dimConfig không truyền tới được)
            if (!categoryButtons) {
                // Đạt kiểm tra lại file index.js xem đã truyền dimConfig vào handle() chưa nhen
                categoryButtons = "👉 [✨ BÉ TRAI]\n👉 [✨ BÉ GÁI]\n👉 [✨ QUẢN CHÂU]\n";
            }

            return `Dạ vâng ạ! Hương Kid đã hủy đơn này nhen. ❤️\n\n` +
                   `Mẹ muốn xem lại mẫu nào thì chọn ở dưới nhen:\n` +
                   categoryButtons + 
                   `\nHương Kid luôn sẵn sàng phục vụ Mẹ nhen! 🌸`;
        }

        return "Dạ Hương Kid chào Mẹ nhen!";
    }
};

module.exports = retainHandler;
