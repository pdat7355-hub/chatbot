const helpers = require('../../utils/helpers');

const consultHandler = {
    handle: async (session, message, dimConfig, retainConfig = [], globalInventory = null) => {
        const text = message.toLowerCase();
        const cleanText = helpers.removeAccents(text).trim();
        const inventoryData = globalInventory || {};
        const inventory = inventoryData.inventory || inventoryData; 
        
        const pCode = session.entities?.productCode;
        const selectedGroup = session.entities?.group;
        const userWeight = session.entities?.weight;
        const recommendedSize = userWeight && helpers.mapWeightToSize ? helpers.mapWeightToSize(userWeight) : null;

        const dynamicGroups = (typeof inventory === 'object') 
            ? [...new Set(Object.values(inventory).map(item => item.group).filter(Boolean))]
            : [];
        const groupNamesClean = dynamicGroups.map(g => helpers.removeAccents(g.toLowerCase()).trim());

        // Hàm biến đổi link Google Drive thành ảnh thật
        const getDirectImgLink = (url) => {
            if (!url) return "https://via.placeholder.com/600x400?text=Huong+Kid+Shop";
            if (url.includes('drive.google.com')) {
                const match = url.match(/\/d\/(.+?)\/(?:view|edit)?/);
                if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
            }
            return url;
        };

        // --- BƯỚC QUÉT MẪU TƯ VẤN (TEXT) ---
        let bestMatch = { weight: 0, template: "" };
        if (retainConfig && retainConfig.length > 0) {
            const isAskingGroup = groupNamesClean.includes(cleanText);
            if (!isAskingGroup) {
                retainConfig.forEach(row => {
                    const keywords = String(row.keywords || "").split(',').map(k => k.trim().toLowerCase());
                    const isMatch = keywords.some(k => text.includes(k) || cleanText.includes(helpers.removeAccents(k)));
                    if (isMatch && (Number(row.weight) || 0) > bestMatch.weight) {
                        bestMatch.weight = Number(row.weight);
                        bestMatch.template = row.template;
                    }
                });
            }
        }

        if (bestMatch.template) {
            let finalReply = bestMatch.template;
            if (userWeight) finalReply = finalReply.replace(/{weight}/g, userWeight);
            if (recommendedSize) {
                finalReply = finalReply.replace(/{size}/g, recommendedSize);
                if (!bestMatch.template.includes("{size}")) {
                    finalReply += `\n(Bé mặc Size ${recommendedSize} là vừa nhen Mẹ! ❤️)`;
                }
            }
            return finalReply; // Trả về String
        }

        // --- BƯỚC HIỂN THỊ THẺ ẢNH (OBJECT) ---

        // A. Hỏi mã cụ thể
        if (pCode && inventory[pCode]) {
            const product = inventory[pCode];
            return {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: `Mẫu ${pCode} - ${product.name}`,
                        image_url: getDirectImgLink(product.image),
                        subtitle: `💰 Giá: ${product.price} | Size: ${product.category || 'Liên hệ'}`,
                        buttons: [{ type: "postback", title: `🛒 CHỌN ${pCode}`, payload: `ORDER_${pCode}` }]
                    }]
                }
            };
        }

        // B. Chọn nhóm hàng (Hiện tối đa 10 mẫu lướt ngang)
        if (selectedGroup) {
            const filteredCodes = Object.keys(inventory).filter(code => {
                const item = inventory[code];
                const isGroupMatch = item.group && helpers.removeAccents(item.group.toLowerCase()).trim() === helpers.removeAccents(selectedGroup.toLowerCase()).trim();
                return isGroupMatch && (recommendedSize ? String(item.category || "").includes(String(recommendedSize)) : true);
            });

            if (filteredCodes.length > 0) {
                const elements = filteredCodes.slice(0, 10).map(code => {
                    const item = inventory[code];
                    return {
                        title: `Mã: ${code} - ${item.name}`,
                        image_url: getDirectImgLink(item.image),
                        subtitle: `💰 Giá: ${item.price} ${recommendedSize ? `(Có Size ${recommendedSize})` : ""}`,
                        buttons: [{ type: "postback", title: `🛒 CHỌN ${code}`, payload: `ORDER_${code}` }]
                    };
                });
                return { type: "template", payload: { template_type: "generic", elements } };
            }
        }

        // C. Hiện Menu chọn nhanh (Quick Replies)
        if (dynamicGroups.length > 0) {
            return {
                text: (userWeight && recommendedSize) 
                    ? `Bé ${userWeight}kg mặc Size ${recommendedSize} nhen Mẹ! Mẹ xem nhóm nào ạ?`
                    : `Dạ Hương Kid chào Mẹ! Mẹ chọn nhóm hàng để xem mẫu nhen:`,
                quick_replies: dynamicGroups.slice(0, 10).map(g => ({
                    content_type: "text", title: g.toUpperCase(), payload: `GROUP_${g}`
                }))
            };
        }

        return "Dạ Mẹ nhắn 'Bé trai' hoặc 'Bé gái' để em gửi mẫu mới nhất nhen!";
    }
};

module.exports = consultHandler;
