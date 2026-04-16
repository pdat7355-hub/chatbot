
const googleSheets = require('../../services/googleSheets');
const helpers = require('../../utils/helpers');

const conversionHandler = {
    handle: async (session, message) => {
        if (!session.executionPath) session.executionPath = [];
        session.executionPath.push("logicHandler/conversion.js");

        const phone = session.entities?.phone || "";
        const address = session.entities?.address || "";
        const weight = session.entities?.weight || "";
        const product = session.entities?.productCode || "Sản phẩm";
        const text = message.toLowerCase();

        // --- BƯỚC 0: XỬ LÝ LỆNH THOÁT (HỦY ĐƠN) ---
        if (text.includes("hủy") || text.includes("quay lại") || text.includes("xem thêm")) {
            session.cart = []; 
            session.entities = {};
            session.winner = 'RETAIN'; 
            if (session.flags) session.flags = {};
            return "Dạ vâng ạ! Em đã xóa giỏ hàng cũ. Mẹ xem thêm mẫu khác nhen, cần gì cứ nhắn em ạ! ✨";
        }

        // --- BƯỚC 1: QUY ĐỔI SIZE ---
        let sizeNote = "";
        if (weight) {
            const sizeCode = helpers.mapWeightToSize(weight);
            sizeNote = sizeCode ? `Size ${sizeCode}` : `chuẩn cho bé ${weight}kg`;
        }

        const cartItems = (session.cart && session.cart.length > 0)
            ? session.cart.map(i => `+ ${i.name} (${i.code})`).join("\n")
            : `+ ${product}`;

        const cartCodes = (session.cart && session.cart.length > 0)
            ? session.cart.map(i => i.code).join(", ")
            : product;

        // --- BƯỚC 2: XỬ LÝ KHI ĐỦ THÔNG TIN ---
        if (phone && address && weight) {
            if (text.includes("chốt đơn")) {
                try {
                    const rowData = [
                        new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"}),
                        `DH${Date.now()}`, phone, address,
                        `${cartCodes} (${sizeNote} - ${weight}kg)`,
                        "Đã chốt", weight
                    ];
                    const success = await googleSheets.appendRow('khachhang', rowData);
                    if (success) {
                        session.cart = []; session.entities = {}; session.winner = null;
                        return `🎉 **ĐẶT HÀNG THÀNH CÔNG!**\n\n` +
                               `Dạ Hương Kid đã chốt đơn mẫu: **${cartCodes}**\n` +
                               `🚚 Giao đến: **${address}**\n\n` +
                               `Cảm ơn Mẹ đã ủng hộ shop nhen! ❤️`;
                    }
                } catch (err) { return `Dạ đơn hàng đã được ghi nhận, shop sẽ gọi Mẹ sớm nhen!`; }
            }
            return `✅ **XÁC NHẬN ĐƠN HÀNG**\n` +
                   `──────────────────\n` +
                   `👕 Mã: **${cartCodes}**\n` +
                   `⚖️ Nặng: **${weight}kg** (${sizeNote})\n` +
                   `📞 SĐT: **${phone}**\n` +
                   `🏠 ĐC: **${address}**\n` +
                   `──────────────────\n` +
                   `Thông tin đúng chưa Mẹ ơi? Nhấn "Chốt đơn" hoặc "Hủy" nhen! 🚀\n\n[[CANCEL_ORDER]]`;
        }

        // --- BƯỚC 3: NẾU THIẾU THÔNG TIN ---
        let missingNote = `📝 **TRẠNG THÁI ĐƠN HÀNG**\n` +
                          `──────────────────\n` +
                          `🛒 **Sản phẩm đã chọn:**\n${cartItems}\n\n` +
                          `⚠️ **CÁC THÔNG TIN CÒN THIẾU:**\n`;

        missingNote += !weight ? `❌ Chưa có **Cân nặng**\n` : `✅ Cân nặng: **${weight}kg**\n`;
        missingNote += !phone ? `❌ Chưa có **Số điện thoại**\n` : `✅ SĐT: **${phone}**\n`;
        missingNote += !address ? `❌ Chưa có **Địa chỉ giao hàng**\n` : `✅ Địa chỉ: **${address}**\n`;
        
        missingNote += `──────────────────\n` +
                       `👉 Mẹ điền nhanh vào Form bên dưới nhen! ❤️\n\n` +
                       `[[SHOW_ORDER_FORM]]\n\n` +
                       `ACTION_HUY_DON`;

        return missingNote;
    }
};

module.exports = conversionHandler;
