/**
 * Simple Qwen API Test
 * Test if the API is working with a basic prompt
 * 
 * BEFORE RUNNING: Update the ACCESS_TOKEN below with your token from Postman
 */

import axios from 'axios';

const CATALYST_API_URL = 'https://api.catalyst.zoho.in/quickml/v2/project/28618000000011083/llm/chat';
const CATALYST_ORG = '60064252849';

// ⚠️ PASTE YOUR ACCESS TOKEN HERE (from Postman)
const ACCESS_TOKEN = '1000.70bdc35aef4da2b5247...'; // Replace with your token

console.log('🧪 Testing Qwen API Connection...\n');

try {
    const response = await axios.post(
        CATALYST_API_URL,
        {
            prompt: "Tell me more about quantum computing and its future implications",
            model: "crm-di-qwen_text_14b-fp8-it",
            system_prompt: "Be concise and factual",
            top_p: 0.9,
            top_k: 50,
            best_of: 1,
            temperature: 0.7,
            max_tokens: 256
        },
        {
            headers: {
                'CATALYST-ORG': CATALYST_ORG,
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );

    console.log('✅ API Test Successful!\n');
    console.log('📝 Response:');
    console.log(response.data.response);
    console.log('\n📊 Usage:');
    console.log(JSON.stringify(response.data.usage, null, 2));
    console.log('\n🎉 Your Qwen API is working! Now you can use it for component matching.');

} catch (error) {
    console.error('❌ API Test Failed!');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
        console.log('\n💡 Token is invalid or expired!');
        console.log('1. Go to https://api-console.zoho.in/');
        console.log('2. Click "Self Client"');
        console.log('3. Scope: QuickML.deployment.READ');
        console.log('4. Generate new token');
        console.log('5. Paste it in this file (line 14)');
    }
}
