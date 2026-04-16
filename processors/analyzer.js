
const helpers = require('../utils/helpers');

const analyzer = {
    extract: (text, session, dimConfig = []) => {
        const raw = text.toLowerCase();
        const clean = helpers.removeAccents(raw);

        // --- 1. LẤY DANH SÁCH NHÓM HÀNG (DỌN DẸP BIẾN TRÙNG) ---
        const inventoryData = session?.inventoryData || {};
        const inventoryObj = inventoryData.inventory || inventoryData; 

        // Quét lấy danh sách Group duy nhất từ Excel
        const dynamicGroups = [...new Set(Object.values(inventoryObj).map(item => item.group).filter(Boolean))];

        // Debug nhanh trên Terminal
        if (dynamicGroups.length === 0) {
            console.log("⚠️ CẢNH BÁO: Inventory rỗng!");
        } else {
            console.log(`🚀 [Analyzer] Đã nạp ${dynamicGroups.length} nhóm: ${dynamicGroups.join(', ')}`);
        }

        // --- 2. NHẬN DIỆN THỰC THỂ (ENTITIES) ---
        const isSystemCommand = text.includes("chonsize") || text.includes("chốtsize") || text.startsWith("chọn ");
        const productMatch = isSystemCommand ? null : text.match(/([a-zA-Z]+\d+)/i);
     // const productMatch = text.match(/([a-zA-Z]+\d+)/i);
        const phoneMatch = text.match(/(0|84)\d{8,10}/);
        const addressMatch = text.match(/(?:địa chỉ|đc|ở|tại)[:\s]+(.+)/i);
        const weightMatch = text.match(/(\d+)\s*(kg|kí|ký|cân|nặng)/i) || text.match(/(nặng|bé)\s*(\d+)/i);

        // Tối ưu tìm nhóm hàng
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
            
            // ƯU TIÊN: Nếu tìm thấy group mới thì lấy luôn, không thì giữ group cũ trong session
            group: foundGroup ? foundGroup : (session?.entities?.group || null) 
        };

        if (foundGroup) console.log(`🎯 Đã xác định được Group: ${foundGroup}`);

        // --- 3. TÍNH ĐIỂM CÁC VÙNG (ZONES) ---
        let zoneScores = { CONSULT: 0, CONVERSION: 0, RETAIN: 0, REMEDY: 0 };
        let detectedFlags = {};

        if (dimConfig && dimConfig.length > 0) {
            dimConfig.forEach(dim => {
                let score = 0;
                if (dim.regex && new RegExp(dim.regex, 'i').test(text)) score += 20;
                if (dim.keywords) {
                    dim.keywords.forEach(k => {
                        const kw = k.toLowerCase().trim();
                        if (raw.includes(kw) || clean.includes(helpers.removeAccents(kw))) score += 10;
                    });
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
        if (foundGroup) {
            zoneScores.CONSULT += 300; 
        }

        const intentPurchase = ["chốt", "lấy", "mua", "ok", "đặt", "chọn"];
        if (intentPurchase.some(word => raw.includes(word))) zoneScores.CONVERSION += 150;
        if (entities.phone) zoneScores.CONVERSION += 200;
        if (entities.address) zoneScores.CONVERSION += 150;
        if (entities.weight) zoneScores.CONVERSION += 100;
        if (productMatch) zoneScores.CONSULT += 50;

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
