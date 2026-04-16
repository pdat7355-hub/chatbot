const systemChecker = {
    runDiagnostic: (session, zones, winner, finalSourceFile) => {
        // Chúng ta vẫn có thể giữ lại log ở Console (chỉ chủ shop mới thấy trong bảng điều khiển Render)
        // để Đạt vẫn theo dõi được bot đang chạy file nào mà khách không hề hay biết.
        console.log(`[Hương Kid Log] Winner: ${winner} | File: ${finalSourceFile}`);

        // Trả về chuỗi rỗng để không chèn bảng vào tin nhắn của khách
        return ""; 
    }
};

module.exports = systemChecker;
