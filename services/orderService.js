const { google } = require('googleapis');

async function saveOrderToSheet(orderData) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json', // File key của Google Cloud
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const values = [[
        new Date().toLocaleString(),
        `DH${Date.now()}`,
        orderData.phone,
        orderData.address,
        orderData.items.join(", "),
        orderData.totalPrice,
        orderData.weight
    ]];

    await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'khachhang!A:G',
        valueInputOption: 'USER_ENTERED',
        resource: { values },
    });
}
