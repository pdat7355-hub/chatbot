console.log("🚀 Hệ thống Chat Hương Kid đã kích hoạt!");

const userId = "Khach_" + Math.floor(Math.random() * 100000);
window.cartCount = 0;

window.sendMsg = async function(isSilent = false) {
    const box = document.getElementById('chat-box');
    const input = document.getElementById('user-input');
    const text = input.value.trim();

    if (!text) return;

    if (!isSilent) {
        box.innerHTML += `<div class="msg user">${text}</div>`;
        box.scrollTop = box.scrollHeight;
    }
    input.value = '';

    let typingId = null;
    if (!isSilent) {
        typingId = "typing-" + Date.now();
        box.innerHTML += `<div class="msg bot typing" id="${typingId}">Hương Kid đang kiểm tra...</div>`;
        box.scrollTop = box.scrollHeight;
    }

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message: text })
        });
        const data = await response.json();

        if (typingId) document.getElementById(typingId)?.remove();

        if (isSilent && (data.reply || "").includes("[[SILENT_UPDATE]]")) return;
        
        let reply = data.reply || "";

        // 1. Xử lý FORM THÔNG TIN
        if (reply.includes("[[SHOW_ORDER_FORM]]")) {
            const formHtml = `
                <div class="msg-form">
                    <p style="margin:0 0 10px 0; font-weight:bold; color:#ff4757; text-align:center;">📋 THÔNG TIN GIAO HÀNG</p>
                    <input type="number" id="f-weight" placeholder="Cân nặng bé (kg)..." style="width:100%; padding:10px;">
                    <input type="tel" id="f-phone" placeholder="Số điện thoại..." style="width:100%; padding:10px;">
                    <input type="text" id="f-address" placeholder="Địa chỉ giao hàng..." style="width:100%; padding:10px;">
                    <button type="button" onclick="submitOrderForm()" style="width:100%; padding:12px; background:#ff4757; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">🚀 GỬI THÔNG TIN</button>
                </div>`;
            reply = reply.split("[[SHOW_ORDER_FORM]]").join(formHtml);
        }

        // 2. Xử lý NÚT HỦY ĐƠN
        if (reply.includes("ACTION_HUY_DON")) {
            const cancelBtn = `<button type="button" class="btn-select" style="background:#f1f2f6; color:#57606f; width:100%;" onclick="window.autoPick('Hủy đơn')">❌ Hủy đơn & Quay lại</button>`;
            reply = reply.split("ACTION_HUY_DON").join(cancelBtn);
        }

        // 3. Xử lý NÚT XÓA MÃ
        if (reply.includes("ID_REMOVE_")) {
            reply = reply.replace(/ID_REMOVE_([A-Z0-9]+)/gi, (match, code) => {
                return `<button type="button" onclick="window.removeItem('${code}')" style="background:#ff4757; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:8px; font-weight:bold;">Xóa</button>`;
            });
        }

        // 4. XỬ LÝ REGEX CÁC NÚT BẤM (Xác nhận, Giỏ hàng, Chọn mẫu)
        reply = reply.replace(/\[CHỐT ĐƠN\]|(?:"Chốt đơn")|🚀 XÁC NHẬN CHỐT ĐƠN/gi, 
            `<button class="btn-select btn-red" style="display:block; width:100%;" onclick="window.autoPick('Chốt đơn')">🚀 XÁC NHẬN CHỐT ĐƠN</button>`);

        reply = reply.replace(/\[GIỎ HÀNG\]|(?:"Giỏ hàng")/gi, 
            `<button class="btn-select btn-green" style="width:100%;" onclick="window.autoPick('Giỏ hàng')">🛒 GIỎ HÀNG (${window.cartCount})</button>`);

        reply = reply.replace(/\[CHỌN\s([A-Z0-9]+)\]/gi, (m, code) => 
            `<button class="btn-select btn-red" onclick="window.autoPick('${code}')">🛍️ CHỌN ${code}</button>`);

        reply = reply.replace(/\[(?!CHỌN|CONSULT|RETAIN|REMEDY|CONVERSION|GIỎ HÀNG|SHOW_ORDER_FORM|CHỐT ĐƠN)([^\]]+)\]/gi, (m, name) => {
            if (["TRACE", "ENTITIES", "SCORING"].some(kw => name.includes(kw))) return m;
            return `<button class="btn-category" onclick="window.autoPick('${name.trim()}')">✨ ${name.trim()}</button>`;
        });

        // HIỂN THỊ
        let formattedReply = reply.replace(/\n/g, '<br>');
        box.innerHTML += `<div class="msg bot">${formattedReply}</div>`;
        
        // SỬA LỖI CUỘN: Gọi hàm cuộn thông minh
        scrollToBottom(box);

    } catch (e) {
        console.error("Lỗi kết nối:", e);
        if (typingId) document.getElementById(typingId)?.remove();
    }
};
// --- HÀM CUỘN THÔNG MINH (Bắt được cả khi có ảnh) ---
function scrollToBottom(box) {
    if (!box) box = document.getElementById('chat-box');
    
    // Cuộn lần 1: Cho phần văn bản
    box.scrollTop = box.scrollHeight;

    // Cuộn lần 2: Đợi ảnh load xong (nếu có) rồi cuộn lại cho chắc
    const images = box.querySelectorAll('img');
    images.forEach(img => {
        if (!img.complete) {
            img.onload = () => { box.scrollTop = box.scrollHeight; };
        }
    });
}


// --- SỬA LỖI ENTER (Gắn trực tiếp vào ô input) ---
// Đợi trang load xong rồi gán sự kiện
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input');
    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Chặn xuống dòng
                window.sendMsg(false);
            }
        });
    }
});



window.autoPick = function(val) {
    const input = document.getElementById('user-input');
    // Nếu là lệnh đặc biệt hoặc không chứa số (không phải mã sản phẩm)
    if (['Giỏ hàng', 'Chốt đơn', 'Hủy đơn'].includes(val) || !/\d/.test(val)) {
        input.value = val;
        window.sendMsg(false);
    } else { 
        window.cartCount++; 
        document.querySelectorAll('.btn-green').forEach(btn => btn.innerText = `🛒 GIỎ HÀNG (${window.cartCount})`);
        showMiniToast(`Đã thêm mẫu ${val}`);
        input.value = `Chọn ${val}`; 
        window.sendMsg(true); 
    }
};

window.removeItem = function(code) {
    const input = document.getElementById('user-input');
    input.value = `xóa mã ${code}`;
    window.sendMsg(false);
};

window.submitOrderForm = function() {
    const parent = event.target.closest('.msg-form');
    const w = parent.querySelector('#f-weight').value;
    const p = parent.querySelector('#f-phone').value;
    const a = parent.querySelector('#f-address').value;

    if(!w || !p || !a) {
        alert("Mẹ điền đủ thông tin để Hương Kid ship hàng nhen! ❤️");
        return;
    }
    document.getElementById('user-input').value = `Bé ${w}kg, SĐT ${p}, địa chỉ tại ${a}`;
    window.sendMsg(false);
};

function showMiniToast(msg) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style = "position:fixed; top:20%; left:50%; transform:translateX(-50%); background:rgba(46, 204, 113, 0.9); color:white; padding:10px 20px; border-radius:20px; z-index:9999; font-weight:bold; transition: 0.5s;";
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 500); }, 1500);
}

window.handleKey = (e) => { if (e.key === 'Enter') window.sendMsg(false); };
