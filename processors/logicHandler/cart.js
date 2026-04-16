const cartHandler = {
    handle: (session) => {
        if (!session.cart || session.cart.length === 0) {
            return "Giỏ hàng của Mẹ đang trống trơn à. Mẹ chọn mẫu xong rồi nhấn chọn nhen! 🛒";
        }

        let total = 0;
        let summary = "🛒 **GIỎ HÀNG CỦA MẸ:**\n\n";
        
        session.cart.forEach((item, index) => {
            summary += `${index + 1}. ${item.name} (${item.code}) - ${item.price}\n`;
            // Chuyển giá từ "150k" hoặc "150.000" thành số để cộng
            total += parseInt(item.price.replace(/\D/g, ''));
        });

        summary += `\n────────────────\n💰 **Tổng cộng: ${total.toLocaleString()}đ**`;
        summary += `\n\nMẹ nhắn **"Chốt đơn"** để em xin địa chỉ giao hàng nhen! 🚀`;
        
        return summary;
    }
};
