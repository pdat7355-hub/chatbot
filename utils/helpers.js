const helpers = {
    // 1. Khử dấu tiếng Việt
    removeAccents: (str) => {
        if (!str) return "";
        return str.normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/đ/g, 'd').replace(/Đ/g, 'D');
    },

    // 2. Quy đổi Cân nặng -> Size
    mapWeightToSize: (weightStr) => {
        const w = parseInt(weightStr);
        if (isNaN(w) || w < 8) return null;
        if (w >= 8 && w <= 10) return "1";
        if (w > 10 && w <= 12) return "2";
        if (w > 12 && w <= 14) return "3";
        if (w > 14 && w <= 16) return "4";
        if (w > 16 && w <= 18) return "5";
        if (w > 18 && w <= 20) return "6";
        if (w > 20 && w <= 22) return "7";
        if (w > 22 && w <= 25) return "8";
        if (w > 25 && w <= 30) return "10";
        if (w > 30 && w <= 35) return "12";
        if (w > 35 && w <= 40) return "14";
        if (w > 40 && w <= 48) return "S";
        if (w > 48 && w <= 55) return "M";
        if (w > 55 && w <= 62) return "L";
        if (w > 62 && w <= 70) return "XL";
        return "2XL";
    },

    // 3. Định dạng câu trả lời (Thay thế biến và link ảnh)
    formatReply: (reply, session) => {
        if (!reply) return "";
        let finalReply = reply;
        const { productCode, weight } = session.entities;
        const inventory = session.inventoryData || {};

        // Xử lý Mã hàng (xóa cụm ngoặc trước)
        if (productCode) {
            const code = productCode.toUpperCase();
            finalReply = finalReply.replace(/\(Mẫu {productCode}\)/g, `(Mẫu ${code})`);
            finalReply = finalReply.replace(/{productCode}/g, code);
        } else {
            finalReply = finalReply.replace(/\(Mẫu {productCode}\)/g, "");
            finalReply = finalReply.replace(/{productCode}/g, "");
        }

        // Xử lý Link ảnh
        if (finalReply.includes("{image_link}")) {
            const pCode = productCode ? productCode.toUpperCase() : null;
            if (pCode && inventory[pCode]) {
                finalReply = finalReply.replace(/{image_link}/g, inventory[pCode].image || "tại kho nhen!");
            } else {
                const samples = Object.values(inventory).slice(0, 3);
                const links = samples.length > 0 
                    ? samples.map(p => `\n📸 ${p.name}: ${p.image}`).join("") 
                    : "tại kho nhen Mẹ!";
                finalReply = finalReply.replace(/{image_link}/g, links);
            }
        }

        // Xử lý Size
        if (weight) {
            const size = helpers.mapWeightToSize(weight);
            finalReply = finalReply.replace(/{size}/g, size || "chuẩn");
        } else {
            finalReply = finalReply.replace(/{size}/g, "chuẩn");
        }

        return finalReply.replace(/\s+/g, ' ').trim();
    }
};

module.exports = helpers;
