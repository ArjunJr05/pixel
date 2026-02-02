import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log('Testing refresh for:', process.env.ZOHO_CLIENT_ID);
    const params = new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
    });

    try {
        const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.log('Error:', error.response?.status, error.response?.data || error.message);
    }
}
test();
