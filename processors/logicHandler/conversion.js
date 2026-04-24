const googleSheets = require('../../services/googleSheets');
const helpers = require('../../utils/helpers');

const conversionHandler = {
    handle: async (session, message, dimConfig, retainConfig = [], globalInventory = null) => {
        try {
            if (!session.executionPath) session.executionPath = [];
            if (!session.executionPath.includes("logicHandler/conversion.js")) {
                session.executionPath.push("logicHandler/conversion.js");
            }

            const text = message.toLowerCase();
            const phone = session.entities?.phone || "";
            const address = session.entities?.address || "";
            const weight = session.entities?.weight || "";
            const product = session.entities?.productCode || "Sản phẩm";

            // Quy đổi size
            const sizeCode = weight ? helpers.mapWeightToSize(weight) : null;
            const sizeNote = sizeCode ? `Size ${sizeCode}` : `cho bé ${weight}kg`;
            const cartCodes = (session.cart && session.cart.length > 0)
                ? session.cart.map(i => i.code).join(", ")
                : product;

            // =========================================================
            // 🎯 ƯU TIÊN 1 (TUYỆT ĐỐI): GHI ĐƠN KHI BẤM NÚT XÁC NHẬN
            // Phải nằm TRÊN CÙNG để không bị từ khóa Excel chặn lại
            // =========================================================
            const isFinalConfirm = text.includes("xác nhận chốt đơn") || text.includes("xac nhan chot don");
            
            if (phone && address && weight && isFinalConfirm) {
                const rowData = [
                    new Date().toLocaleString("vi-VN", {timeZone: "Asia/Ho_Chi_Minh"}),
                    `DH${Date.now()}`, phone, address, `${cartCodes} (${sizeNote})`, "Đã chốt", weight
                ];

                const success = await googleSheets.appendRow('khachhang', rowData);
                if (success) {
                    session.cart = [];
                    session.winner = 'RETAIN'; // Reset về trạng thái bình thường sau khi chốt
                    return `🎉 **ĐẶT HÀNG THÀNH CÔNG!**\n\nDạ shop Hương Kid đã chốt đơn mẫu: **${cartCodes}**\n🚚 Giao đến: **${address}**\nCảm ơn Mẹ nhiều nhen! ❤️`;
                }
            }

            // --- XỬ LÝ LỆNH THOÁT ---
            if (text.includes("hủy") || text.includes("quay lại")) {
                session.cart = []; 
                session.winner = 'RETAIN'; 
                return "Dạ shop đã hủy yêu cầu này, Mẹ xem thêm mẫu khác nhen! ❤️";
            }

            // =========================================================
            // 🎯 ƯU TIÊN 2: KIỂM TRA TỪ KHÓA TƯ VẤN (EXCEL)
            // =========================================================
            const conversionRules = (dimConfig || []).filter(d => d.zone === 'CONVERSION' || d.zone === 'RETAIN');
            for (const rule of conversionRules) {
                const keywords = String(rule.keywords || "").split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
                if (keywords.length > 0 && keywords.some(k => text.includes(k))) {
                    return (rule.content || rule.template).replace(/{weight}/g, weight || "---");
                }
            }

            // =========================================================
            // 🎯 ƯU TIÊN 3: HIỆN BẢNG XÁC NHẬN (CHỈ KHI CÓ TÍN HIỆU)
            // =========================================================
            const confirmSignals = ['lấy đơn', 'lay don', 'ok', 'đúng rồi', 'dung roi', 'chốt nhé', 'gửi cho chị', 'chốt đơn'];
            const hasSignal = confirmSignals.some(sig => text.includes(sig));

            if (phone && address && weight) {
                if (hasSignal) {
                    return `✅ **XÁC NHẬN ĐƠN HÀNG**\n` +
                           `──────────────────\n` +
                           `👕 Mã: **${cartCodes}**\n` +
                           `⚖️ Nặng: **${weight}kg** (${sizeNote})\n` +
                           `📞 SĐT: **${phone}**\n` +
                           `🏠 ĐC: **${address}**\n` +
                           `──────────────────\n` +
                           `Thông tin đúng chưa Mẹ ơi? Nhấn **[XÁC NHẬN CHỐT ĐƠN]** nhen! 🚀`;
                }
            } else if (phone || address || weight) {
                let missing = `📝 **THÔNG TIN CÒN THIẾU:**\n`;
                missing += !weight ? `❌ Chưa có **Cân nặng**\n` : `✅ Cân nặng: **${weight}kg**\n`;
                missing += !phone ? `❌ Chưa có **SĐT**\n` : `✅ SĐT: **${phone}**\n`;
                missing += !address ? `❌ Chưa có **Địa chỉ**\n` : `✅ Địa chỉ: **${address}**\n`;
                
                return missing + `\n👉 Mẹ điền nhanh vào nút bên dưới để em lên đơn nhen! ❤️\n\n[[SHOW_ORDER_FORM]]`;
            }

            return "Dạ Mẹ nhắn SĐT và địa chỉ để shop Hương Kid lên đơn cho bé nhen! ❤️";

        } catch (err) {
            console.error("❌ Lỗi conversion.js:", err.message);
            throw err;
        }
    }
};

module.exports = conversionHandler;
