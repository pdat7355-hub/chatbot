const systemChecker = {
    runDiagnostic: (session, zones, winner, finalSourceFile) => {
        const activeFlags = Object.keys(session.flags || {}).filter(key => session.flags[key] === true);
        const actualScores = zones || session.zones || {};
        
        const scoreBoard = Object.entries(actualScores).map(([z, s]) => {
            // Chỉ đánh dấu Winner nếu nó thực sự khớp với biến winner truyền vào
            return `  + [${z}]: ${s}đ ${z === winner ? '👈 WINNER' : ''}`;
        }).join("\n");

        const tracePath = (session.executionPath || []).join(" ➔ ");

        return `
╔══════════════════════════════════════════════════╗
📊 HỆ THỐNG KIỂM SOÁT LỘ TRÌNH (HƯƠNG KID)
╚══════════════════════════════════════════════════╝

👣 **LỘ TRÌNH THỰC TẾ (TRACE):**
${tracePath}

🎯 **XUẤT PHÁT TỪ FILE:** 👉 [ ${finalSourceFile} ]

🧩 **DỮ LIỆU ĐẦU VÀO:**
- Flags: ${activeFlags.join(", ") || "Trống"}
- Winner: ${winner}

⚖️ **CHI TIẾT ĐIỂM SỐ (SCORING):**
${scoreBoard}

📦 **THỰC THỂ (ENTITIES):**
- Mã: ${session.entities?.productCode || "Trống"} | SĐT: ${session.entities?.phone || "Trống"}
- Nhóm: ${session.entities?.group || "Trống"}
- Cân nặng: ${session.entities?.weight || "Trống"} kg
────────────────────────────────────────────────────`.trim();

    }
};

module.exports = systemChecker;
