require('dotenv').config();
const express = require('express');
const path = require('path');
const sessionManager = require('./core/sessionManager');
const analyzer = require('./processors/analyzer');
const googleSheets = require('./services/googleSheets');
const { mapWeightToSize } = require('./utils/helpers');
const logicHandler = require('./processors/logicHandler/index'); 

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Khởi tạo nạp kho hàng từ Excel
async function initializeBot() {
    try {
        const inventoryData = await googleSheets.getInventoryData(); 
        if (inventoryData) {
            sessionManager.setInventory(inventoryData);
            console.log("🚀 Hương Kid Bot đã sẵn sàng!");
        }
    } catch (err) { console.error("❌ Lỗi nạp kho hàng:", err.message); }
}
initializeBot();

// Hàm hiển thị giỏ hàng dùng chung (Gọn đẹp, có phí ship)
function buildCartReply(session, header) {
    const { subTotal, shipFee, finalTotal, isFreeShip } = session.totals;
    let summary = `${header}\n\n🛒 **GIỎ HÀNG CỦA MẸ:**\n\n`;
    
    // Biến để kiểm tra xem có món nào bị thiếu size không
    let hasMissingSize = false;

    session.cart.forEach((item, index) => {
        // Kiểm tra xem món hàng có size chưa
        const sizeInfo = item.size ? `✨ Size: ${item.size}` : "⚠️ **(Đợi chốt size)**";
        
        // Nếu có ít nhất 1 món chưa có size, đánh dấu lại
        if (!item.size) hasMissingSize = true;

        // Thêm thông tin vào bảng
        summary += `${index + 1}. ${item.name} - ${sizeInfo}\n`;
        summary += `   Mã: ${item.code} - Giá: ${item.price.toLocaleString('vi-VN')}đ ID_REMOVE_${item.code}\n\n`;
    });

    summary += `────────────────`;
    summary += `\n💰 Tạm tính: ${subTotal.toLocaleString('vi-VN')}đ`;
    summary += `\n🚚 Phí ship: ${isFreeShip ? "Miễn phí 🎁" : shipFee.toLocaleString('vi-VN') + "đ"}`;
    summary += `\n👉 **TỔNG CỘNG: ${finalTotal.toLocaleString('vi-VN')}đ**`;

    // 🌟 LOGIC THÔNG MINH: Chỉ hiện cảnh báo khi thực sự thiếu size
    if (hasMissingSize) {
        summary += `\n\n⚠️ *Mẹ nhớ bổ sung cân nặng để shop lấy đúng size nhen!*`;
    } else {
        summary += `\n\n✅ **Đơn hàng đã đủ thông tin size.**\n🚀 Mẹ bấm nút [CHỐT ĐƠN] để em giao hàng ngay nhen! ❤️`;
    }

    return summary;
}
app.post('/chat', async (req, res) => {
    try {
        const { userId } = req.body;
        const text = (req.body.message || "").toLowerCase().trim();
        const dimConfig = await googleSheets.getDimensions();
        
        // 1. Lấy/Nạp kho hàng
        let inventoryData = sessionManager.getInventory();
        if (!inventoryData || (inventoryData.inventory && Object.keys(inventoryData.inventory).length === 0)) {
            inventoryData = await googleSheets.getInventoryData();
            sessionManager.setInventory(inventoryData);
        }
        const db = inventoryData?.inventory || inventoryData;
        let session = sessionManager.get(userId) || { cart: [], entities: {}, flags: {} };

        // 🔥 2. BẪY XÓA MÃ
        if (text.startsWith("xóa mã ")) {
            const code = text.replace("xóa mã ", "").toUpperCase().trim();
            session.cart = session.cart.filter(item => item.code !== code);
            const updated = sessionManager.update(userId, { cart: session.cart });
            if (updated.cart.length === 0) return res.json({ reply: "Dạ giỏ hàng trống rồi nhen Mẹ! ❤️" });
            return res.json({ reply: buildCartReply(updated, `Dạ shop đã bỏ mã ${code} rồi ạ!`) });
        }

        // 🔥 3. BẪY HỦY ĐƠN / QUAY LẠI
        else if (text === "hủy đơn" || text === "quay lại") {
            session.winner = "CONSULT";
            const list = await logicHandler.handleResponse(session, "mẫu mới", dimConfig);
            return res.json({ reply: `Dạ vâng ạ! Mẹ xem thêm mẫu khác nhen. ❤️\n\n` + list });
        }

        // 🔥 4.1. BẪY CHỐT SIZE (CHỐT ĐƠN)
        else if (text.toUpperCase().includes("CHONSIZE") || text.toUpperCase().includes("CHỐTSIZE")) {
            let cleanText = text.replace(/[^\x00-\x7F]/g, "").trim(); 
            let rawCmd = cleanText.includes(":") ? cleanText.split(":").pop().trim() : cleanText;
            let parts = rawCmd.toUpperCase().split(/\s+/).filter(p => p.trim()); 

            const mau = parts[1];  
            const size = parts[2]; 

            if (mau && size && db[mau]) {
                // 🛑 KIỂM TRA TRÙNG (Mẫu + Size)
                const isExisted = session.cart.find(item => item.code === mau && String(item.size) === String(size));
                if (isExisted) {
                    return res.json({ reply: `⚠️ Mẹ ơi: Mã **${mau} (Size ${size})** đã có trong giỏ hàng rồi ạ! ❤️` });
                }

                const productInfo = Array.isArray(db[mau]) ? db[mau][0] : db[mau];
                session.cart.push({
                    code: mau,
                    name: productInfo.name || mau,
                    price: productInfo.price || 0,
                    size: size
                });

                const updated = sessionManager.update(userId, { cart: session.cart });
                return res.json({ 
                    reply: `✅ Đã thêm mã **${mau} (Size ${size})** vào giỏ hàng!\n\nMẹ nhắn [GIỎ HÀNG] để em lên đơn nhen. ❤️` 
                });
            }
        }

        // 🔥 4. BẪY CHỌN MẪU (HIỆN NÚT SIZE)
        else if (text.startsWith("chọn ")) {
            const code = text.replace("chọn ", "").toUpperCase().trim();
            if (db[code]) {
                const items = Array.isArray(db[code]) ? db[code] : [db[code]];
                let sizes = [];
                items.forEach(p => {
                    const s = String(p.category || "").split(/[,| ]+/).filter(x => x.trim());
                    sizes.push(...s);
                });
                sizes = [...new Set(sizes)].sort((a, b) => a - b);

                if (sizes.length > 0) {
                    let buttons = sizes.map(s => `[Size ${s}: CHONSIZE ${code} ${s}]`).join("\n");
                    return res.json({ reply: `🌸 **Mẹ chọn Size cho mã ${code} nhen:**\n\n${buttons}\n\n*(Bấm vào size muốn lấy ạ)*` });
                }
            }
            return res.json({ reply: `Dạ mã **${code}** này hiện em đang hết hàng ạ!` });
        }


        // 🔥 5. BẪY GIỎ HÀNG
        if (text === "giỏ hàng") {
            const updated = sessionManager.update(userId, { cart: session.cart });
            if (updated.cart.length === 0) return res.json({ reply: "Dạ giỏ hàng trống nhen Mẹ! 🛒" });
            return res.json({ reply: buildCartReply(updated, "🌸 Giỏ hàng của Mẹ nè:") });
        }

        // 🤖 6. XỬ LÝ AI & LOGIC PHẢN HỒI
        const analysis = analyzer.extract(text, session, dimConfig);
        session.entities = { ...session.entities, ...(analysis.entities || {}) };
        
        let updatedSession = sessionManager.update(userId, {
            winner: analysis.winner || "CONSULT",
            zones: analysis.zones || [],
            flags: analysis.flags || {},
            entities: session.entities,
            inventoryData: inventoryData
        }, mapWeightToSize);

        let finalResponse = await logicHandler.handleResponse(updatedSession, text, dimConfig);

// 🔥 7. LUỒNG SIÊU TỐC (Chỉ chạy khi khách nhắn tin thường, không phải nút bấm)
        if (updatedSession.entities?.weight && updatedSession.pendingCode && !text.startsWith("chọn")) {
            try {
                const pCode = updatedSession.pendingCode;
                const userWeight = updatedSession.entities.weight;
                const currentSize = mapWeightToSize(userWeight);
                const dataInStock = inventoryData?.inventory || inventoryData;

                if (dataInStock && dataInStock[pCode]) {
                    const productEntry = dataInStock[pCode];
                    const productsWithSameCode = Array.isArray(productEntry) ? productEntry : [productEntry];
                    const productMatchedSize = productsWithSameCode.find(p => {
                        const stockSize = String(p.category || "").toLowerCase().trim();
                        const targetSize = String(currentSize).toLowerCase().trim();
                        return stockSize === targetSize || stockSize.includes(targetSize);
                    });

                    if (productMatchedSize) {
                        const isExisted = updatedSession.cart.find(item => item.code === pCode && String(item.size) === String(currentSize));
                        if (!isExisted) {
                            updatedSession.cart.push({ code: pCode, name: productMatchedSize.name, price: productMatchedSize.price, size: currentSize });
                            sessionManager.update(userId, { cart: updatedSession.cart, pendingCode: null });
                            finalResponse += `\n\n✅ **Tin vui:** Em đã tự động thêm mã **${pCode}** (Size ${currentSize}) vào giỏ cho Mẹ rồi nhé!`;
                        }
                    }
                }
            } catch (autoErr) { console.error("❌ Lỗi luồng siêu tốc:", autoErr); }
        }

        return res.json({ reply: finalResponse });

    } catch (error) {
        console.error("❌ LỖI:", error);
        res.status(500).json({ reply: "Hệ thống bận xíu nhen Đạt! Thử lại giúp mình." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Hương Kid Bot đang chạy tại cổng: ${PORT}`);
});
