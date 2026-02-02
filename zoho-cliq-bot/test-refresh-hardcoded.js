import axios from 'axios';

async function testRefresh() {
    const clientId = '1000.L015BTMC962O5T75VIYLEH1KEJ8LLF';
    const clientSecret = 'b6cbf527ce9eae6ceb5e218d313abbfbb511f12600';
    const refreshToken = '1000.f4faf50ca26ba3353c3333ba866378b8.93da08afd809c5d1c23cb7b151e592ec';

    const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
    });

    try {
        const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('Response:', response.data);
        const accessToken = response.data.access_token;
        console.log('✅ Success:', accessToken.substring(0, 10) + '...');
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testRefresh();
