
const sessions = new Map();

// Cấu hình phí ship (Đạt có thể điều chỉnh số ở đây)
const SHIPPING_CONFIG = {
    FEE: 30000,           // Phí ship mặc định 30k
    FREESHIP_LIMIT: 500000 // Đơn từ 500k được freeship
};

const sessionManager = {
    get: (id) => sessions.get(id),

    update: (id, data) => {
        let session = sessions.get(id) || { cart: [], entities: {}, flags: {} };
        
        // Cập nhật các thông tin mới vào session
        Object.assign(session, data);

        // --- TỰ ĐỘNG TÍNH TOÁN PHÍ SHIP VÀ TỔNG TIỀN ---
        if (session.cart) {
            // 1. Tính tiền hàng (Tạm tính)
            const subTotal = session.cart.reduce((sum, item) => {
                const price = parseInt(item.price?.toString().replace(/\D/g, '')) || 0;
                return sum + price;
            }, 0);

            // 2. Xác định phí ship
            const shipFee = (subTotal >= SHIPPING_CONFIG.FREESHIP_LIMIT || subTotal === 0) 
                            ? 0 
                            : SHIPPING_CONFIG.FEE;

            // 3. Lưu vào session để các file khác (server.js, conversion.js) chỉ việc lấy ra dùng
            session.totals = {
                subTotal: subTotal,
                shipFee: shipFee,
                finalTotal: subTotal + shipFee,
                isFreeShip: subTotal >= SHIPPING_CONFIG.FREESHIP_LIMIT,
                needMoreForFreeShip: Math.max(0, SHIPPING_CONFIG.FREESHIP_LIMIT - subTotal)
            };
        }

        sessions.set(id, session);
        return session;
    },

    // Các hàm khác của Đạt (setInventory, getInventory...) giữ nguyên nhé
    setInventory: (data) => { /* ... code cũ của Đạt ... */ },
    getInventory: () => { /* ... code cũ của Đạt ... */ }
};

module.exports = sessionManager;
