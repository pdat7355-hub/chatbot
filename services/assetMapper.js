// services/assetMapper.js
const googleSheets = require('./googleSheets');

const assetMapper = {
    // Từ mã SP, đi tìm mọi thông tin liên quan để gửi cho khách
    mapProductToAssets: async (productCode) => {
        const product = await googleSheets.getProductInfo(productCode);
        
        if (product) {
            return {
                price: product.price,
                // Chuyển ID Drive thành link có thể xem trực tiếp
                imageUrl: `https://lh3.googleusercontent.com/d/${product.driveId}`,
                available: product.stock > 0
            };
        }
        return null;
    }
};

module.exports = assetMapper;
