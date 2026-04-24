const sessions = new Map();

// Cấu hình phí ship của Hương Kid
const SHIPPING_CONFIG = {
    FEE: 30000,           // Phí ship mặc định 30k
    FREESHIP_LIMIT: 500000 // Đơn từ 500k được freeship
};

const sessionManager = {
    // --- 1. QUẢN LÝ PHIÊN CHAT (SESSION) ---
    
    // Lấy session hiện tại
    get: (id) => sessions.get(id),

    /**
     * Cập nhật session theo kiểu "Bổ sung" (Patch)
     * Đảm bảo không làm mất dữ liệu cũ (SĐT, Địa chỉ, Cân nặng) của khách
     */
    update: (id, newData) => {
        let session = sessions.get(id) || { 
            cart: [], 
            entities: {}, 
            flags: {}, 
            totals: {}, 
            isRecognized: false,
            executionPath: [] 
        };
        
        // A. XỬ LÝ RIÊNG CHO ENTITIES (Thông tin cá nhân khách hàng)
        if (newData.entities) {
            if (!session.entities) session.entities = {};
            
            for (let key in newData.entities) {
                let newVal = newData.entities[key];
                
                // CHỈ cập nhật nếu dữ liệu mới thực sự có giá trị
                // Giúp giữ lại SĐT/Địa chỉ cũ nếu tin nhắn mới khách không nhắc lại
                if (newVal !== undefined && newVal !== null && newVal !== "") {
                    session.entities[key] = newVal;
                }
            }
            delete newData.entities; // Tránh Object.assign ghi đè toàn bộ object
        }

        // B. XỬ LÝ CHO GIỎ HÀNG
        if (newData.cart) {
            session.cart = newData.cart;
            delete newData.cart;
        }

        // C. CẬP NHẬT CÁC THÀNH PHẦN KHÁC (winner, flags, zones...)
        Object.assign(session, newData);

        // D. TỰ ĐỘNG TÍNH TOÁN TÀI CHÍNH (Totals)
        if (session.cart) {
            const subTotal = session.cart.reduce((sum, item) => {
                const price = parseInt(item.price?.toString().replace(/\D/g, '')) || 0;
                return sum + price;
            }, 0);

            const isEligibleForFreeShip = subTotal >= SHIPPING_CONFIG.FREESHIP_LIMIT;
            const shipFee = (isEligibleForFreeShip || subTotal === 0) ? 0 : SHIPPING_CONFIG.FEE;

            session.totals = {
                subTotal: subTotal,
                shipFee: shipFee,
                finalTotal: subTotal + shipFee,
                isFreeShip: isEligibleForFreeShip,
                needMoreForFreeShip: isEligibleForFreeShip ? 0 : (SHIPPING_CONFIG.FREESHIP_LIMIT - subTotal)
            };
        }

        // E. GIỚI HẠN LỊCH SỬ (Tránh tràn RAM)
        if (session.executionPath && session.executionPath.length > 10) {
            session.executionPath = session.executionPath.slice(-10);
        }

        sessions.set(id, session);
        return session;
    },

    // Xóa session khi khách chốt đơn thành công
    clear: (id) => {
        sessions.delete(id);
        console.log(`[Session] 🗑️ Đã xóa bộ nhớ phiên của khách: ${id}`);
    },

    // --- 2. QUẢN LÝ DỮ LIỆU TỔNG (GLOBAL DATA - RAM) ---

    // KHO HÀNG (Inventory)
    setInventory: (data) => {
        sessions.set('global_inventory', data);
        console.log(`[Inventory] 📦 Đã nạp kho hàng vào RAM hệ thống.`);
    },

    getInventory: () => {
        return sessions.get('global_inventory') || { inventory: {}, groups: [] };
    },

    // QUY TẮC / KÍCH THƯỚC (Dimensions) - Sửa lỗi "is not a function"
    setDimensions: (data) => {
        sessions.set('global_dimensions', data);
        console.log(`[Dimensions] 📏 Đã nạp ${data.length || 0} quy tắc vào RAM.`);
    },

    getDimensions: () => {
        return sessions.get('global_dimensions') || [];
    }
};

module.exports = sessionManager;
