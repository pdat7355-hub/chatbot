
const helpers = require('../../utils/helpers');

const consultHandler = {
    handle: async (session, message) => {
        if (!session.executionPath) session.executionPath = [];
        session.executionPath.push("logicHandler/consult.js");

        // --- 1. LẤY DỮ LIỆU KHO HÀNG ---
        const rawData = session.inventoryData || {};
        const inventory = rawData.inventory || rawData; 
        
        const pCode = session.entities?.productCode;
        const selectedGroup = session.entities?.group;

        // Hàm xử lý link ảnh Google Drive sang link thumbnail
        const getDirectImgLink = (url) => {
            if (!url) return "";
            if (url.includes('drive.google.com')) {
                const match = url.match(/\/d\/(.+?)\/(?:view|edit)?/);
                if (match && match[1]) {
                    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
                }
            }
            return url;
        };

        // --- TRƯỜNG HỢP 1: KHÁCH HỎI MỘT MÃ CỤ THỂ ---
        if (pCode && inventory[pCode]) {
            const product = inventory[pCode];
            let reply = `Dạ mẫu **${pCode} - ${product.name}** cực xinh đây ạ!\n\n`;
            if (product.image) {
                reply += `<img src="${getDirectImgLink(product.image)}" style="width:100%; max-width:250px; border-radius:10px; margin-bottom:10px;"><br>\n`;
            }
            reply += `💰 **Giá:** ${product.price}\n`;
            if (product.category) reply += `📏 **Size:** ${product.category}\n`;
            reply += `\n------------------\n👉 [CHỌN ${pCode}]`;
            return reply;
        }

        // --- TRƯỜNG HỢP 2: LỌC THEO NHÓM HÀNG ---
        if (selectedGroup) {
            const filteredCodes = Object.keys(inventory).filter(code => {
                const item = inventory[code];
                if (!item.group) return false;
                const itemG = helpers.removeAccents(item.group.toLowerCase()).trim();
                const selectG = helpers.removeAccents(selectedGroup.toLowerCase()).trim();
                return itemG === selectG;
            });

            if (filteredCodes.length > 0) {
                let listReply = `🌟 **CÁC MẪU ${selectedGroup.toUpperCase()} ĐANG CÓ** 🌟\n\n`;
                filteredCodes.slice(0, 6).forEach(code => {
                    const item = inventory[code];
                    if (item.image) {
                        listReply += `<img src="${getDirectImgLink(item.image)}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; float:left; margin-right:12px; margin-bottom:15px;">`;
                    }
                    listReply += `🔹 **Mã: ${code}**\n👕 ${item.name}\n💰 Giá: **${item.price}**\n👉 [CHỌN ${code}]\n`;
                    listReply += `<div style="clear:both; margin-bottom:10px; border-bottom:1px dashed #eee;"></div>`;
                });
                listReply += `\n🛒 Mẹ ưng mẫu nào bấm nút **CHỌN** ở trên nhen!`;
                listReply += `\nHoặc bấm vào đây để xem lại [GIỎ HÀNG] của mình ạ.`; // Thêm chữ [GIỎ HÀNG] vào đây
                return listReply;
            }
        }

// --- TRƯỜNG HỢP 3: HIỆN MENU NHÓM (BIẾN THÀNH NÚT NHẤN) ---
        const dynamicGroups = [...new Set(Object.values(inventory).map(item => item.group).filter(Boolean))];
        
        if (dynamicGroups.length > 0) {
            let menuReply = `Dạ shop Hương Kid chào Mẹ! Hiện em đang có sẵn các mẫu này, mẹ muốn xem nhóm nào bấm nút dưới đây nhen:\n\n`;
            
            dynamicGroups.forEach(g => { 
                // Biến mỗi nhóm thành một nút nhấn dạng [Tên Nhóm]
                menuReply += `👉 **[${g.toUpperCase()}]**\n`; 
            });
            
            menuReply += `\n*(Hoặc Mẹ nhắn cân nặng để em tư vấn size cho bé nhen!)*`;
            return menuReply;
        }

        return `Dạ shop Hương Kid chào Mẹ! Mẹ nhắn "Bé trai" hoặc "Bé gái" để em gửi mẫu mới nhen!`;
    }
};

module.exports = consultHandler;
