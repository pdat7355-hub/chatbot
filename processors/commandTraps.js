const { buildCartReply } = require('./cartFormatter');

async function handleTraps(text, userId, session, db, groups, sessionManager) {
    // 1. BẪY CHỌN MẪU
    if (text.startsWith("chọn ")) {
        const code = text.replace("chọn ", "").toUpperCase().trim();
        if (db[code]) {
            const product = db[code];
            const availableSizes = String(product.category || "").split(',').map(s => s.trim());
            const finalSize = session.entities?.size || availableSizes[0] || "10";

            const isExisted = session.cart.find(i => i.code === code && String(i.size) === String(finalSize));
            if (!isExisted) {
                session.cart.push({ code, name: product.name, price: product.price, size: finalSize });
                sessionManager.update(userId, { cart: session.cart });
            }
            return { reply: buildCartReply(session, `✅ Đã thêm mã **${code}** vào giỏ!`, db) };
        }
    }

    // 2. BẪY ĐỔI SIZE NHANH (Bấm vào nút [ #12 ])
    if (text.includes("#")) {
        const match = text.match(/#(\w+)/);
        if (match && session.cart?.length > 0) {
            const newSize = match[1].toUpperCase();
            session.cart[session.cart.length - 1].size = newSize;
            sessionManager.update(userId, { cart: session.cart });
            return { reply: buildCartReply(session, `✅ Đã đổi sang **Size ${newSize}**!`, db) };
        }
    }

    // 3. BẪY XÓA MÓN
    if (text.includes("xoa:") || text.includes("xóa:")) {
        const pCode = text.split(":")[1]?.trim().toUpperCase().replace(/[\[\]]/g, "");
        if (pCode) {
            session.cart = session.cart.filter(item => item.code.toUpperCase() !== pCode);
            sessionManager.update(userId, { cart: session.cart });
            return { reply: buildCartReply(session, `🗑️ Đã xóa mã **${pCode}** khỏi giỏ!`, db) };
        }
    }

    // 4. BẪY GIỎ HÀNG & DANH MỤC
    if (text === "giỏ hàng") return { reply: buildCartReply(session, "🌸 Giỏ hàng của Mẹ nè:", db) };
    if (text === "danh mục" || text === "menu") {
        return { reply: `Mẹ xem mẫu theo nhóm nhen:\n\n` + groups.map(g => `[${g.toUpperCase()}]`).join(" ") };
    }

    return null;
}

module.exports = { handleTraps }; // QUAN TRỌNG: Phải có dòng này
