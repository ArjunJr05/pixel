// Test Figma file fetching with OAuth
import dotenv from 'dotenv';
dotenv.config();

import { getValidFigmaToken } from './figma-oauth.js';
import axios from 'axios';

async function testFigmaFetch(fileKey) {
    try {
        console.log('🧪 Testing Figma file fetch...\n');
        console.log('📁 File Key:', fileKey);

        // Get valid token
        const token = await getValidFigmaToken();
        console.log('✅ Token obtained:', token.substring(0, 20) + '...\n');

        // Fetch file
        console.log('📥 Fetching file from Figma API...');
        const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
            headers: {
                'X-Figma-Token': token
            }
        });

        console.log('\n✅ File fetched successfully!');
        console.log('📄 File name:', response.data.name);
        console.log('📅 Last modified:', response.data.lastModified);
        console.log('📊 Document structure:', response.data.document ? 'Present' : 'Missing');

        // Check for components
        if (response.data.document && response.data.document.children) {
            console.log('\n🔍 Analyzing structure...');
            console.log('📦 Top-level children:', response.data.document.children.length);

            // Count all nodes
            let textCount = 0;
            let buttonCount = 0;
            let frameCount = 0;

            function countNodes(node) {
                if (!node) return;

                if (node.type === 'TEXT') textCount++;
                if (node.name && node.name.toLowerCase().includes('button')) buttonCount++;
                if (node.type === 'FRAME') frameCount++;

                if (node.children) {
                    node.children.forEach(countNodes);
                }
            }

            response.data.document.children.forEach(countNodes);

            console.log('\n📊 Component counts:');
            console.log('  📝 Text nodes:', textCount);
            console.log('  🔘 Buttons:', buttonCount);
            console.log('  📦 Frames:', frameCount);

            if (textCount === 0 && buttonCount === 0) {
                console.log('\n⚠️  WARNING: No text or button components found!');
                console.log('   This could mean:');
                console.log('   1. The file is empty');
                console.log('   2. Components are named differently');
                console.log('   3. The file structure is different');
            }
        }

        return response.data;

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Message:', error.response.data?.err || error.response.data?.message);

            if (error.response.status === 403) {
                console.log('\n💡 Solution: You don\'t have access to this file');
                console.log('   Make sure the file is:');
                console.log('   1. Owned by you, OR');
                console.log('   2. Shared with you with edit access');
            } else if (error.response.status === 404) {
                console.log('\n💡 Solution: File not found');
                console.log('   Check the file key is correct');
            }
        }
        throw error;
    }
}

// Test with a file key
const testFileKey = process.argv[2];

if (!testFileKey) {
    console.log('Usage: node test-figma-fetch.js <file_key>');
    console.log('\nExample:');
    console.log('  node test-figma-fetch.js BDTr8XPFqUTHXnvpvgLnAj');
    console.log('\nExtract file key from URL:');
    console.log('  https://www.figma.com/design/FILE_KEY/...');
    process.exit(1);
}

testFigmaFetch(testFileKey);
