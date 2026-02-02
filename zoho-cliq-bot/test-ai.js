/**
 * Test AI Component Matching
 * Run this to verify Qwen 2.5 is working correctly
 */

import { testAIMatching, areComponentsSimilar } from './ai-matcher.js';
import fs from 'fs';

// Load .env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const envLines = envFile.split('\n');
for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    }
}

console.log('🧪 Testing AI Component Matching with Qwen 2.5 14B\n');
console.log('Token:', process.env.CATALYST_ACCESS_TOKEN?.substring(0, 20) + '...\n');

// Run the built-in test
await testAIMatching();

console.log('\n🎯 Additional Tests:\n');

// Test some real-world examples
const testPairs = [
    ['search icon', 'search'],
    ['login button', 'sign in button'],
    ['profile picture', 'avatar'],
    ['home screen', 'homepage'],
    ['settings', 'preferences'],
    ['back arrow', 'back button'],
    ['menu', 'hamburger menu'],
    ['cart', 'shopping cart'],
];

for (const [name1, name2] of testPairs) {
    const result = await areComponentsSimilar(name1, name2);
    const icon = result ? '✅' : '❌';
    console.log(`${icon} "${name1}" vs "${name2}": ${result ? 'MATCH' : 'NO MATCH'}`);
}

console.log('\n✅ Test complete!');
