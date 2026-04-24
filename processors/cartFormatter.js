/**
 * Xây dựng nội dung giỏ hàng cho shop Hương Kid
 */
function buildCartReply(session, header, db) {
    const { subTotal = 0, shipFee = 30000, finalTotal = 0 } = session.totals || {};
    const inventory = db || {};

    let summary = `${header}\n\n🛒 **GIỎ HÀNG CỦA MẸ:**\n\n`;
    
    if (!session.cart || session.cart.length === 0) {
        return summary + "Dạ hiện tại giỏ hàng đang trống nhen Mẹ! 🛒";
    }

    session.cart.forEach((item, index) => {
        const cleanCode = item.code.trim().toUpperCase();
        const productInStock = inventory[cleanCode]; 
        
        const sizeInfo = item.size ? `**${item.size}**` : "⚠️ **(Đợi chốt size)**";
        summary += `${index + 1}. ${item.name} - ✨ Size: ${sizeInfo}\n`;
        summary += `   Mã: ${item.code} - Giá: ${item.price.toLocaleString('vi-VN')}đ\n`;

        // Tra cứu size thực tế từ kho (cột category)
        if (productInStock && productInStock.category) {
            const availableSizes = String(productInStock.category).split(',').map(s => s.trim()).filter(Boolean);
            const otherSizes = availableSizes.filter(s => s !== String(item.size));

            if (otherSizes.length > 0) {
                summary += `   🛠️ Đổi size: ` + otherSizes.map(s => `[ #${s} ]`).join("  ") + `\n`;
            }
        }
        summary += `   🗑️ [XÓA: ${item.code}]\n`;
        summary += `────────────────\n`;
    });

    summary += `💰 Tạm tính: ${subTotal.toLocaleString('vi-VN')}đ\n`;
    summary += `🚚 Phí ship: ${shipFee.toLocaleString('vi-VN')}đ\n`;
    summary += `👉 **TỔNG CỘNG: ${finalTotal.toLocaleString('vi-VN')}đ**\n\n`;
    summary += `🚀 Bấm **[XÁC NHẬN CHỐT ĐƠN]** để em gửi ngay ạ! ❤️\n\n`;
    summary += `✅ **Mẹ bấm [DANH SÁCH] để xem mẫu tiếp nhé!**`;
    
    return summary;
}

module.exports = { buildCartReply };
