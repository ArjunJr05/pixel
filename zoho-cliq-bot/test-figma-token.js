import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ override: true });

async function checkFigma() {
    const token = process.env.FIGMA_ACCESS_TOKEN;
    console.log('🔍 Checking Figma token:', token.substring(0, 10) + '...');

    try {
        const response = await axios.get('https://api.figma.com/v1/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ Figma Token OK! User:', response.data.handle);
    } catch (error) {
        console.error('❌ Figma Error:', error.response?.status, error.response?.data || error.message);
        if (error.response?.headers) {
            console.log('Retry-After:', error.response.headers['retry-after']);
        }
    }
}

checkFigma();
