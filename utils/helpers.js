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
        if (isNaN(w) || w < 5) return null;
        if (w >= 5 && w <= 10) return "1";
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

    // 3. ĐỊNH DẠNG TỔNG LỰC (Cá nhân hóa theo dữ liệu khách hàng)
    formatReply: (reply, session, globalInventory = null) => {
        if (!reply) return "";
        let finalReply = reply;
        
        const entities = session.entities || {};
        const { productCode, weight, phone, address } = entities;
        
        // Lấy kho hàng
        const inventory = (globalInventory && globalInventory.inventory) 
                          ? globalInventory.inventory 
                          : (globalInventory || {});

        // --- A. Xử lý Địa chỉ & SĐT (Cá nhân hóa khách quen) ---
        // Thay {{dia_chi}} hoặc {address} trong Excel
        const displayAddress = address ? address : "địa chỉ cũ của Mẹ";
        finalReply = finalReply.replace(/{{dia_chi}}|{address}/g, displayAddress);
        
        const displayPhone = phone ? phone : "số điện thoại nhen";
        finalReply = finalReply.replace(/{{sdt}}|{phone}/g, displayPhone);

        // --- B. Xử lý Mã hàng ---
        if (productCode) {
            const code = String(productCode).toUpperCase();
            finalReply = finalReply.replace(/\(Mẫu {productCode}\)/g, `(Mẫu ${code})`);
            finalReply = finalReply.replace(/{productCode}|{{ma_hang}}/g, code);
        } else {
            finalReply = finalReply.replace(/\(Mẫu {productCode}\)/g, "");
            finalReply = finalReply.replace(/{productCode}|{{ma_hang}}/g, "mẫu này");
        }

        // --- C. Xử lý Size & Cân nặng ---
        const size = weight ? helpers.mapWeightToSize(weight) : null;
        const sizeNote = size ? `Size ${size}` : "size chuẩn";
        
        finalReply = finalReply.replace(/{size}|{{size}}/g, sizeNote);
        finalReply = finalReply.replace(/{weight}|{{can_nang}}/g, weight || "---");

        // --- D. Xử lý Link ảnh ---
        if (finalReply.includes("{image_link}")) {
            const pCode = productCode ? String(productCode).toUpperCase() : null;
            if (pCode && inventory[pCode]) {
                const img = inventory[pCode].image;
                finalReply = finalReply.replace(/{image_link}/g, img ? `📸 Ảnh đây Mẹ nhen: ${img}` : "tại kho nhen!");
            } else {
                const samples = Object.values(inventory).slice(0, 2);
                const links = samples.length > 0 
                    ? samples.map(p => `\n📸 ${p.name}: ${p.image}`).join("") 
                    : "tại kho nhen Mẹ!";
                finalReply = finalReply.replace(/{image_link}/g, links);
            }
        }

        // Dọn dẹp khoảng trắng thừa
        return finalReply.replace(/\s\s+/g, ' ').trim();
    }
};

module.exports = helpers;
