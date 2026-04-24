const helpers = require('../../utils/helpers');

const consultHandler = {
    handle: async (session, message, dimConfig, retainConfig = [], globalInventory = null) => {
        // --- 1. GHI NHẬN LỘ TRÌNH ---
        if (session.executionPath && !session.executionPath.includes("logicHandler/consult.js")) {
            session.executionPath.push("logicHandler/consult.js");
        }

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

        // --- HÀM XỬ LÝ LINK ẢNH GOOGLE DRIVE ---
        const getDirectImgLink = (url) => {
            if (!url) return "https://via.placeholder.com/600x400?text=Huong+Kid+Shop"; // Ảnh mặc định nếu thiếu link
            if (url.includes('drive.google.com')) {
                const match = url.match(/\/d\/(.+?)\/(?:view|edit)?/);
                if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
            }
            return url;
        };

        // --- 2. XỬ LÝ TƯ VẤN TỪ EXCEL (TEXT ONLY) ---
        let bestMatch = { weight: 0, template: "" };
        if (retainConfig && retainConfig.length > 0) {
            const isAskingGroup = groupNamesClean.includes(cleanText);
            if (!isAskingGroup) {
                retainConfig.forEach(row => {
                    const rawKeywords = String(row.keywords || ""); 
                    if (!rawKeywords.trim()) return;
                    const keywords = rawKeywords.split(',').map(k => k.trim().toLowerCase());
                    const isMatch = keywords.some(k => text.includes(k.trim()) || cleanText.includes(helpers.removeAccents(k.trim())));
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
                    finalReply += `\n(Bé mặc Size ${recommendedSize} là vừa in luôn Mẹ nhen! ❤️)`;
                }
            }
            return finalReply; // Trả về text đơn giản
        }

        // --- 3. HIỂN THỊ MẪU HÀNG (Dạng Thẻ Hình Ảnh Facebook) ---

        // A. Trường hợp hỏi mã cụ thể
        if (pCode && inventory[pCode]) {
            const product = inventory[pCode];
            return {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: `Mẫu ${pCode} - ${product.name}`,
                        image_url: getDirectImgLink(product.image),
                        subtitle: `💰 Giá: ${product.price} - 📏 Size: ${product.category || 'Liên hệ'}`,
                        buttons: [{
                            type: "postback",
                            title: `🛒 CHỌN MUA ${pCode}`,
                            payload: `ORDER_${pCode}`
                        }]
                    }]
                }
            };
        }

        // B. Trường hợp chọn nhóm hàng (Hiện tối đa 10 thẻ lướt ngang)
        if (selectedGroup) {
            const filteredCodes = Object.keys(inventory).filter(code => {
                const item = inventory[code];
                const isGroupMatch = item.group && helpers.removeAccents(item.group.toLowerCase()).trim() === helpers.removeAccents(selectedGroup.toLowerCase()).trim();
                if (isGroupMatch && recommendedSize) {
                    return String(item.category || "").includes(String(recommendedSize));
                }
                return isGroupMatch;
            });

            if (filteredCodes.length > 0) {
                const elements = filteredCodes.slice(0, 10).map(code => {
                    const item = inventory[code];
                    return {
                        title: `Mã: ${code} - ${item.name}`,
                        image_url: getDirectImgLink(item.image),
                        subtitle: `💰 Giá: ${item.price} ${recommendedSize ? `(Có Size ${recommendedSize})` : ""}`,
                        buttons: [{
                            type: "postback",
                            title: `🛒 CHỌN ${code}`,
                            payload: `ORDER_${code}`
                        }]
                    };
                });
                return { type: "template", payload: { template_type: "generic", elements: elements } };
            }
        }

        // C. Mặc định hiện Nút bấm chọn nhóm hàng (Quick Replies)
        if (dynamicGroups.length > 0) {
            const quickReplies = dynamicGroups.slice(0, 10).map(g => ({
                content_type: "text",
                title: g.toUpperCase(),
                payload: `GROUP_${g.toUpperCase()}`
            }));

            return {
                text: (userWeight && recommendedSize) 
                    ? `Dạ bé ${userWeight}kg mặc Size ${recommendedSize} ạ. Mẹ muốn xem nhóm nào để em lọc mẫu nhen?`
                    : `Dạ shop Hương Kid chào Mẹ! Mẹ chọn nhóm hàng bên dưới để xem mẫu nhen:`,
                quick_replies: quickReplies
            };
        }

        return `Dạ shop Hương Kid chào Mẹ! Mẹ nhắn "Bé trai" hoặc "Bé gái" để em gửi mẫu mới nhen!`;
    }
};

module.exports = consultHandler;
