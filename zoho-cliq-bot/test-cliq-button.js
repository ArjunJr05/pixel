import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testButton() {
    const chatId = '60064065315'; // Using the chat ID from the logs
    const token = process.env.ZOHO_OAUTH_TOKEN;
    const botUrl = process.env.BOT_URL || 'http://localhost:3001';

    console.log('Testing button send to:', chatId);

    const payload = {
        text: "✅ **Analysis Complete!**\n\n📊 **Consistency Score: 95%**\n\nThis is a test message to see if buttons work without cards.",
        buttons: [
            {
                label: "📥 Download PDF",
                action: {
                    type: "open.url",
                    data: {
                        url: `${botUrl}/test`
                    }
                }
            }
        ]
    };

    try {
        const response = await axios.post(
            `https://cliq.zoho.in/api/v2/chats/${chatId}/message`,
            payload,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('✅ Success:', response.data);
    } catch (error) {
        console.log('❌ Error:', error.response?.status, JSON.stringify(error.response?.data));
    }
}

testButton();
