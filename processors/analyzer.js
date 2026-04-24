const helpers = require('../utils/helpers');

const analyzer = {
    // THAY ĐỔI: Nhận thêm tham số thứ 4 là globalInventory từ server.js truyền sang
    extract: (text, session, dimConfig = [], globalInventory = null) => {
        const raw = text.toLowerCase();
        const clean = helpers.removeAccents(raw);

        // --- 1. LẤY DANH SÁCH NHÓM HÀNG (SỬA LỖI INVENTORY RỖNG) ---
        // Ưu tiên lấy từ globalInventory (Tham số mới), nếu không có mới tìm trong session (cũ)
        const inventoryObj = globalInventory?.inventory || globalInventory || session?.inventoryData || {};

        // Quét lấy danh sách Group duy nhất từ kho thực tế
        const dynamicGroups = (Object.keys(inventoryObj).length > 0)
            ? [...new Set(Object.values(inventoryObj).map(item => item.group).filter(Boolean))]
            : [];

        // Debug nhanh trên Terminal - Đã sửa logic kiểm tra
        if (dynamicGroups.length === 0) {
            console.log("⚠️ [Analyzer] Cảnh báo: Không tìm thấy nhóm hàng để đối soát.");
        } else {
            console.log(`🚀 [Analyzer] Đã nạp ${dynamicGroups.length} nhóm: ${dynamicGroups.join(', ')}`);
        }

        // --- 2. NHẬN DIỆN THỰC THỂ (ENTITIES) ---
        const isSystemCommand = text.includes("chonsize") || text.includes("chốtsize") || text.startsWith("chọn ");
        const productMatch = isSystemCommand ? null : text.match(/([a-zA-Z]+\d+)/i);
        const phoneMatch = text.match(/(0|84)\d{8,10}/);
        const addressMatch = text.match(/(?:địa chỉ|đc|ở|tại)[:\s]+(.+)/i);
        const weightMatch = text.match(/(\d+)\s*(kg|kí|ký|cân|nặng)/i) || text.match(/(nặng|bé)\s*(\d+)/i);

        // Tối ưu tìm nhóm hàng: Đối soát tin nhắn khách với danh sách nhóm trong kho
        const foundGroup = dynamicGroups.find(g => {
            const gClean = helpers.removeAccents(g.toLowerCase()).trim();
            const textClean = helpers.removeAccents(text.toLowerCase()).trim();
            return textClean.includes(gClean) || gClean.includes(textClean);
        });

        const entities = {
            productCode: productMatch ? productMatch[1].toUpperCase() : (session?.entities?.productCode || null),
            phone: phoneMatch ? phoneMatch[0] : (session?.entities?.phone || null),
            address: addressMatch ? addressMatch[1].trim() : (session?.entities?.address || null),
            weight: weightMatch ? (weightMatch[1].match(/\d+/) ? weightMatch[1] : weightMatch[2]) : (session?.entities?.weight || null),
            group: foundGroup ? foundGroup : (session?.entities?.group || null) // Giữ group cũ nếu không tìm thấy cái mới
        };

        if (foundGroup) console.log(`🎯 [Analyzer] Đã xác định được Group: ${foundGroup}`);

        // --- 3. TÍNH ĐIỂM CÁC VÙNG (ZONES) ---
        let zoneScores = { CONSULT: 0, CONVERSION: 0, RETAIN: 0, REMEDY: 0 };
        let detectedFlags = {};

        if (dimConfig && dimConfig.length > 0) {
            dimConfig.forEach(dim => {
                let score = 0;
                // Regex match
                if (dim.regex && new RegExp(dim.regex, 'i').test(text)) score += 20;
                
                // Keywords match
                if (dim.keywords) {
                    const isKeywordMatch = dim.keywords.some(k => {
                        const kw = k.toLowerCase().trim();
                        return raw.includes(kw) || clean.includes(helpers.removeAccents(kw));
                    });

                    if (isKeywordMatch) {
                        score += (Number(dim.weight) || 20);
                    }
                }
                
                const isMatched = score >= 5;
                detectedFlags[dim.name] = isMatched;
                if (isMatched) {
                    const zone = (dim.zone || 'REMEDY').toUpperCase();
                    zoneScores[zone] = (zoneScores[zone] || 0) + (Number(dim.weight) || 10);
                }
            });
        }

        // --- 4. CHIẾN THUẬT ĐẨY ĐIỂM (BOOSTING) ---
        // Nếu nhắc tới tên nhóm hàng (ví dụ: "Đồ bộ"), ép CONSULT thắng để hiện mẫu
        if (foundGroup) { zoneScores.CONSULT += 150; }

        const intentPurchase = ["chốt", "lấy", "mua", "ok", "đặt", "chọn", "gửi cho"];
        if (intentPurchase.some(word => raw.includes(word))) zoneScores.CONVERSION += 100;
        
        // Thưởng điểm nhẹ cho các thông tin cá nhân
        if (entities.phone) zoneScores.CONVERSION += 5;
        if (entities.address) zoneScores.CONVERSION += 5;
        if (entities.weight) zoneScores.CONVERSION += 5;
        if (productMatch) zoneScores.CONSULT += 50; // Thấy mã hàng là phải tư vấn ngay

        // Ép CONSULT khi dùng lệnh hệ thống
        if (raw.includes("#") || raw.includes("xoa:") || raw.includes("xóa:")) {
            zoneScores.CONSULT = 500;
            zoneScores.CONVERSION = 0;
            console.log("⚡ [Analyzer] Lệnh hệ thống: Ưu tiên CONSULT");
        }

        // --- 5. QUYẾT ĐỊNH WINNER ---
        let winner = 'RETAIN';
        let maxScore = -1;

        Object.keys(zoneScores).forEach(z => {
            const currentScore = Number(zoneScores[z] || 0);
            if (currentScore > maxScore) {
                maxScore = currentScore;
                winner = z;
            } else if (currentScore === maxScore && maxScore > 0) {
                const priority = { 'CONVERSION': 3, 'REMEDY': 2, 'CONSULT': 1, 'RETAIN': 0 };
                if (priority[z] > priority[winner]) winner = z;
            }
        });

        if (maxScore <= 0) winner = 'RETAIN';

        return { entities, flags: detectedFlags, winner, zones: zoneScores };
    }
};

module.exports = analyzer;
