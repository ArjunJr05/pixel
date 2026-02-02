import dotenv from 'dotenv';
dotenv.config();

import { getValidFigmaToken } from './figma-oauth.js';
import { fetchFigmaFile } from './figma-api.js';

async function testFigmaToken() {
    try {
        console.log('🧪 Testing Figma OAuth token...\n');

        // Test 1: Get valid token
        console.log('1️⃣ Getting valid token...');
        const token = await getValidFigmaToken();
        console.log('✅ Token retrieved:', token.substring(0, 20) + '...\n');

        // Test 2: Try to fetch a Figma file
        console.log('2️⃣ Testing Figma API with a sample file...');
        console.log('   (Using a public Figma file for testing)');

        // You can replace this with one of your actual file keys
        const testFileKey = 'BDTr8XPFqUTHXnvpvgLnAj'; // Example file

        try {
            const fileData = await fetchFigmaFile(testFileKey);
            console.log('✅ Successfully fetched Figma file!');
            console.log('   File name:', fileData.name);
            console.log('   Last modified:', fileData.lastModified);
        } catch (apiError) {
            if (apiError.response?.status === 403) {
                console.log('⚠️  Token works, but you don\'t have access to this test file');
                console.log('   Try with one of your own Figma file keys!');
            } else if (apiError.response?.status === 429) {
                console.log('⚠️  Rate limit exceeded - but token is valid!');
            } else {
                throw apiError;
            }
        }

        console.log('\n✅ Figma OAuth is working correctly!');
        console.log('🎉 You can now use Figma API in your bot!');

    } catch (error) {
        console.error('\n❌ Error testing Figma token:');
        console.error('   ', error.message);

        if (error.message.includes('No Figma access token')) {
            console.log('\n💡 Solution: Run OAuth flow to get tokens');
            console.log('   Visit: http://localhost:3001/oauth/figma/start');
        } else if (error.response?.status === 401) {
            console.log('\n💡 Solution: Token is invalid or expired');
            console.log('   Visit: http://localhost:3001/oauth/figma/start');
        }
    }
}

testFigmaToken();
