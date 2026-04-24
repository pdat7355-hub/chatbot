const helpers = require('../../utils/helpers');

const consultHandler = {
    // THAY ĐỔI: Nhận globalInventory từ logicHandler/index.js truyền sang
    handle: async (session, message, dimConfig, retainConfig = [], globalInventory = null) => {
        // --- 1. GHI NHẬN LỘ TRÌNH ---
        if (session.executionPath && !session.executionPath.includes("logicHandler/consult.js")) {
            session.executionPath.push("logicHandler/consult.js");
        }

        // --- 2. KHAI BÁO BIẾN & DỮ LIỆU CƠ BẢN ---
        const text = message.toLowerCase();
        const cleanText = helpers.removeAccents(text).trim();

        // ƯU TIÊN: Lấy dữ liệu từ kho tổng globalInventory
        const inventoryData = globalInventory || {};
        const inventory = inventoryData.inventory || inventoryData; 
        
        const pCode = session.entities?.productCode;
        const selectedGroup = session.entities?.group;
        const userWeight = session.entities?.weight;
        const recommendedSize = userWeight && helpers.mapWeightToSize ? helpers.mapWeightToSize(userWeight) : null;

        // Quét lấy danh sách nhóm hàng từ kho tổng
        const dynamicGroups = (typeof inventory === 'object') 
            ? [...new Set(Object.values(inventory).map(item => item.group).filter(Boolean))]
            : [];
        const groupNamesClean = dynamicGroups.map(g => helpers.removeAccents(g.toLowerCase()).trim());

        // --- 3. BƯỚC QUÉT EXCEL TƯ VẤN (DIMENSIONS) ---
        let bestMatch = { weight: 0, template: "" };

        if (retainConfig && retainConfig.length > 0) {
            // Nếu khách nhắn đúng tên nhóm (như "bé trai") thì bỏ qua bước quét Excel để hiện mẫu ngay
            const isAskingGroup = groupNamesClean.includes(cleanText);

            if (!isAskingGroup) {
                retainConfig.forEach(row => {
                    const rawKeywords = String(row.keywords || ""); 
                    if (!rawKeywords.trim()) return;

                    const keywords = rawKeywords.split(',').map(k => k.trim().toLowerCase());
                    const isMatch = keywords.some(k => {
                        const kw = k.trim();
                        return text.includes(kw) || cleanText.includes(helpers.removeAccents(kw));
                    });

                    if (isMatch && (Number(row.weight) || 0) > bestMatch.weight) {
                        bestMatch.weight = Number(row.weight);
                        bestMatch.template = row.template;
                    }
                });
            }
        }

        // Nếu tìm thấy mẫu câu tư vấn trong Excel, xử lý biến rồi trả về
        if (bestMatch.template) {
            let finalReply = bestMatch.template;
            if (userWeight) finalReply = finalReply.replace(/{weight}/g, userWeight);
            if (recommendedSize) {
                finalReply = finalReply.replace(/{size}/g, recommendedSize);
                // Nếu template chưa nhắc tới size, tự động bổ sung câu nhắc size
                if (!bestMatch.template.includes("{size}")) {
                    finalReply += `\n(Bé mặc **Size ${recommendedSize}** là vừa in luôn Mẹ nhen! ❤️)`;
                }
            }
            if (pCode && inventory[pCode]) {
                finalReply = finalReply
                    .replace(/{productCode}/g, pCode)
                    .replace(/{product_price}/g, inventory[pCode].price || "giá cực tốt");
            }
            return finalReply;
        }

        // --- 4. CÁC TRƯỜNG HỢP TƯ VẤN MẪU/NHÓM THEO KHO HÀNG ---
        const getDirectImgLink = (url) => {
            if (!url) return "";
            if (url.includes('drive.google.com')) {
                const match = url.match(/\/d\/(.+?)\/(?:view|edit)?/);
                if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
            }
            return url;
        };

        // A. Trường hợp hỏi mã cụ thể (Ví dụ: "Mẫu AK123 giá sao em")
        if (pCode && inventory[pCode]) {
            const product = inventory[pCode];
            let reply = `Dạ mẫu **${pCode} - ${product.name}** cực xinh đây ạ!\n\n`;
            if (product.image) reply += `<img src="${getDirectImgLink(product.image)}" style="width:100%; max-width:250px; border-radius:10px; margin-bottom:10px;"><br>\n`;
            reply += `💰 **Giá:** ${product.price}\n`;
            // Chú ý: Cột size trong Excel của Đạt có tên là 'category'
            if (product.category) reply += `📏 **Size:** ${product.category}\n`;
            reply += `\n------------------\n👉 [CHỌN ${pCode}]`;
            return reply;
        }

        // B. Trường hợp chọn nhóm hàng (Ví dụ: "Cho chị xem đồ bộ bé trai")
        if (selectedGroup) {
            const filteredCodes = Object.keys(inventory).filter(code => {
                const item = inventory[code];
                if (!item.group) return false;
                const isGroupMatch = helpers.removeAccents(item.group.toLowerCase()).trim() === helpers.removeAccents(selectedGroup.toLowerCase()).trim();
                
                // Lọc thông minh: Chỉ hiện mẫu còn đúng size của bé
                if (isGroupMatch && recommendedSize) {
                    return String(item.category || "").includes(String(recommendedSize));
                }
                return isGroupMatch;
            });

            if (filteredCodes.length > 0) {
                let listReply = `🌟 **CÁC MẪU ${selectedGroup.toUpperCase()} ${recommendedSize ? `(SIZE ${recommendedSize})` : ""} ĐANG CÓ** 🌟\n\n`;
                // Chỉ hiện tối đa 6 mẫu để tránh quá dài
                filteredCodes.slice(0, 6).forEach(code => {
                    const item = inventory[code];
                    if (item.image) listReply += `<img src="${getDirectImgLink(item.image)}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; float:left; margin-right:12px; margin-bottom:15px;">`;
                    listReply += `🔹 **Mã: ${code}**\n👕 ${item.name}\n💰 Giá: **${item.price}**\n👉 [CHỌN ${code}]\n`;
                    listReply += `<div style="clear:both; margin-bottom:10px; border-bottom:1px dashed #eee;"></div>`;
                });
                listReply += `\n🛒 Mẹ ưng mẫu nào bấm nút **CHỌN** ở trên nhen!\nHoặc bấm xem 🛒 [GIỎ HÀNG] để em lên đơn ạ.`;
                return listReply;
            } else if (recommendedSize) {
                return `Dạ hiện tại nhóm **${selectedGroup}** em đang tạm hết size ${recommendedSize} cho bé ${userWeight}kg rồi ạ. Mẹ xem thử nhóm khác nhen! ✨`;
            }
        }

        // C. Mặc định hiện Menu Nhóm hàng (Khi không biết khách muốn gì)
        if (dynamicGroups.length > 0) {
            let menuReply = (userWeight && recommendedSize) 
                ? `Dạ bé **${userWeight}kg** mặc **Size ${recommendedSize}** là vừa in luôn nhen Mẹ! ❤️\n\nGiờ Mẹ muốn xem mẫu nào để em lọc size ${recommendedSize} ạ:\n\n`
                : `Dạ shop Hương Kid chào Mẹ! Hiện em đang có sẵn các nhóm hàng này, Mẹ xem nhóm nào thì bấm nút nhen:\n\n`;
            
            menuReply += dynamicGroups.map(g => `[${g.toUpperCase()}]`).join("  ");
            menuReply += `\n\n*(Mẹ cứ chọn nhóm, em sẽ hiện mẫu đúng size của bé ạ!)*`;
            return menuReply;
        }

        return `Dạ shop Hương Kid chào Mẹ! Mẹ nhắn "Bé trai" hoặc "Bé gái" để em gửi mẫu mới nhen!`;
    }
};

module.exports = consultHandler;
