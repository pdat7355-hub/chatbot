
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

        if (typingId) {
            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
        }

        if (isSilent && (data.reply || "").includes("[[SILENT_UPDATE]]")) {
            return;
        }
        let reply = data.reply || "";

        // 1. Xử lý FORM (Viết trên 1 dòng để né lỗi <br>)
        if (reply.includes("[[SHOW_ORDER_FORM]]")) {
            const formHtml = '<div class="msg-form" style="background:#fff;border:2px solid #ff4757;padding:15px;border-radius:15px;margin:10px 0;clear:both;"><p style="margin:0 0 10px 0;font-weight:bold;color:#ff4757;text-align:center;">📋 THÔNG TIN GIAO HÀNG</p><input type="number" id="f-weight" placeholder="Cân nặng bé (kg)..." style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;"><input type="tel" id="f-phone" placeholder="Số điện thoại..." style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;"><input type="text" id="f-address" placeholder="Địa chỉ giao hàng..." style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;"><button type="button" onclick="submitOrderForm()" style="width:100%;padding:12px;background:#ff4757;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🚀 GỬI THÔNG TIN</button></div>';
            reply = reply.split("[[SHOW_ORDER_FORM]]").join(formHtml);
        }

        // 2. Xử lý NÚT HỦY (Viết TRÊN 1 DÒNG DUY NHẤT)
        // Lưu ý: Server trả về từ khóa ACTION_HUY_DON (không ngoặc)
        if (reply.includes("ACTION_HUY_DON")) {
            const cancelBtnHtml = '<div style="margin:10px 0;clear:both;text-align:center;"><button type="button" onclick="window.autoPick(\'Hủy đơn\')" style="background:#f1f2f6;color:#57606f;border:1px solid #ced4da;width:100%;padding:12px;border-radius:12px;cursor:pointer;font-weight:bold;display:block;">❌ Hủy đơn & Quay lại xem mẫu</button></div>';
            reply = reply.split("ACTION_HUY_DON").join(cancelBtnHtml);
        }
// 1.3 Xử lý nút XÓA (Né hoàn toàn dấu ngoặc vuông để không bị Regex số 5 cướp)
if (reply.includes("ID_REMOVE_")) {
    reply = reply.replace(/ID_REMOVE_([A-Z0-9]+)/gi, (match, code) => {
        return `<button type="button" onclick="window.removeItem('${code}')" style="background:#ff4757; color:white; border:none; padding:3px 10px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:10px; font-weight:bold; display:inline-block;">❌ Xóa</button>`;
    });
}
        // --- BƯỚC 2: XỬ LÝ CÁC NÚT BẤM DẠNG NGOẶC VUÔNG (REGEX) ---

        // Nút Xác nhận chốt đơn
        reply = reply.replace(/\[CHỐT ĐƠN\]|(?:"Chốt đơn")|🚀 XÁC NHẬN CHỐT ĐƠN/gi, () => {
            return `<button class="btn-select btn-red" style="background:#eb4d4b; display:block; width:100%; margin:10px 0; padding:12px;" onclick="window.autoPick('Chốt đơn')">🚀 XÁC NHẬN CHỐT ĐƠN</button>`;
        });

        // Nút Giỏ hàng
        const cartBtnHtml = `<button class="btn-select btn-green" style="margin:10px 0; width:100%; display:block;" onclick="window.autoPick('Giỏ hàng')">🛒 XEM GIỎ HÀNG (${window.cartCount})</button>`;
        reply = reply.replace(/\[GIỎ HÀNG\]|(?:"Giỏ hàng")/gi, cartBtnHtml);

        // Nút Chọn mẫu
        reply = reply.replace(/\[CHỌN\s([A-Z0-9]+)\]/gi, (match, code) => {
            return `<button class="btn-select btn-red" style="margin:5px 0;" onclick="window.autoPick('${code}')">🛍️ CHỌN MẪU ${code}</button>`;
        });

        // Nút Danh mục (Loại trừ các từ khóa hệ thống)
        reply = reply.replace(/\[(?!CHỌN|CONSULT|RETAIN|REMEDY|CONVERSION|GIỎ HÀNG|SHOW_ORDER_FORM|CHỐT ĐƠN)([^\]]+)\]/gi, (match, groupName) => {
            const name = groupName.trim();
            const systemKeywords = ["TRACE", "ENTITIES", "SCORING", "XUẤT PHÁT TỪ FILE", "DỮ LIỆU ĐẦU VÀO", "CHI TIẾT ĐIỂM SỐ", "THỰC THỂ"];
            if (systemKeywords.some(kw => name.includes(kw))) return match;
            return `<button class="btn-category" onclick="window.autoPick('${name}')">✨ ${name}</button>`;
        });

        // --- BƯỚC 3: HIỂN THỊ ---
        let formattedReply = reply.replace(/\n/g, '<br>');
        box.innerHTML += `<div class="msg bot">${formattedReply}</div>`;
        
        setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);

    } catch (e) {
        console.error("Lỗi kết nối:", e);
        if (typingId) document.getElementById(typingId)?.remove();
    }
};

window.autoPick = function(val) {
    const input = document.getElementById('user-input');
    if (val === 'Giỏ hàng' || val === 'Chốt đơn' || val === 'Hủy đơn' || !/\d/.test(val)) {
        input.value = val;
        window.sendMsg(false);
    } else { 
        window.cartCount++; 
        document.querySelectorAll('.btn-green').forEach(btn => {
            btn.innerHTML = `🛒 XEM GIỎ HÀNG (${window.cartCount})`;
        });
        showMiniToast(`Đã thêm mẫu ${val}`);
        input.value = `Chọn ${val}`; 
        window.sendMsg(true); 
    }
};

window.submitOrderForm = function() {
    const btn = event.target;
    const parentForm = btn.closest('.msg-form');
    const w = parentForm.querySelector('#f-weight').value;
    const p = parentForm.querySelector('#f-phone').value;
    const a = parentForm.querySelector('#f-address').value;

    if(!w || !p || !a) {
        alert("Mẹ điền đủ thông tin nhen! ❤️");
        return;
    }

    const msg = `Bé ${w}kg, SĐT ${p}, địa chỉ tại ${a}`;
    const input = document.getElementById('user-input');
    input.value = msg;
    window.sendMsg(false);
};

function showMiniToast(msg) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.className = "mini-toast";
    toast.style = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(255, 71, 87, 0.9); color:white; padding:12px 24px; border-radius:30px; z-index:9999; font-size:14px; font-weight:bold; pointer-events:none; box-shadow: 0 4px 15px rgba(0,0,0,0.2);";
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = "all 0.5s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translate(-50%, -100%)";
        setTimeout(() => toast.remove(), 500);
    }, 800);
}

window.handleKey = (e) => { if (e.key === 'Enter') window.sendMsg(false); };
// PHẢI NẰM NGOÀI CÙNG FILE CHAT.JS
window.removeItem = function(code) {
    console.log("Đang xóa mã:", code); // Để Đạt kiểm tra trong F12
    const input = document.getElementById('user-input');
    if (!input) return;
    
    input.value = `xóa mã ${code}`;
    window.sendMsg(false); // Gọi hàm gửi tin nhắn
};
