const cartHandler = {
    handle: (session) => {
        // 1. Kiểm tra giỏ hàng
        if (!session.cart || session.cart.length === 0) {
            return "Dạ giỏ hàng của Mẹ đang trống trơn à. Mẹ xem mẫu nào ưng thì nhấn **[CHỌN]** để em bỏ vào giỏ cho nhen! 🛒";
        }

        let total = 0;
        let summary = "🛒 **GIỎ HÀNG CỦA MẸ:**\n";
        summary += "──────────────────\n";
        
        session.cart.forEach((item, index) => {
            // Xử lý giá: Nếu item.price là số thì dùng luôn, nếu là chuỗi (150k, 150.000đ) thì mới lọc số
            const priceString = String(item.price || "0");
            const priceValue = parseInt(priceString.replace(/\D/g, '')) || 0;
            
            summary += `${index + 1}. **${item.code}** - ${item.name}\n   💰 Giá: ${item.price}\n`;
            total += priceValue;
        });

        // 2. Định dạng hiển thị tổng tiền
        const formattedTotal = total > 0 ? `${total.toLocaleString('vi-VN')}đ` : "Liên hệ shop";

        summary += `──────────────────\n`;
        summary += `💰 **TỔNG CỘNG: ${formattedTotal}**\n\n`;
        summary += `👉 Mẹ nhắn **"Chốt đơn"** để em lên đơn giao ngay nhen!\n`;
        summary += `*(Hoặc nhắn "Xóa" nếu Mẹ muốn chọn lại từ đầu ạ)*`;
        
        return summary;
    }
};

module.exports = cartHandler;
