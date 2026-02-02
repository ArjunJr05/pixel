// Simple test to check if Figma tokens are in .env
import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Checking Figma OAuth Configuration...\n');

const checks = {
    'FIGMA_CLIENT_ID': process.env.FIGMA_CLIENT_ID,
    'FIGMA_CLIENT_SECRET': process.env.FIGMA_CLIENT_SECRET,
    'FIGMA_REDIRECT_URI': process.env.FIGMA_REDIRECT_URI,
    'FIGMA_ACCESS_TOKEN': process.env.FIGMA_ACCESS_TOKEN,
    'FIGMA_REFRESH_TOKEN': process.env.FIGMA_REFRESH_TOKEN
};

let allGood = true;

Object.entries(checks).forEach(([key, value]) => {
    if (value) {
        console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
        console.log(`❌ ${key}: Missing!`);
        allGood = false;
    }
});

console.log('\n' + '='.repeat(50));

if (allGood) {
    console.log('✅ All Figma OAuth credentials are configured!');
    console.log('🎉 You can now use Figma OAuth in your bot!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart server: npm start');
    console.log('   2. Test endpoint: http://localhost:3001/oauth/figma/test');
    console.log('   3. Use in bot!');
} else {
    console.log('❌ Some credentials are missing!');
    console.log('\n💡 To fix:');
    console.log('   1. Visit: http://localhost:3001/oauth/figma/start');
    console.log('   2. Authenticate with Figma');
    console.log('   3. Tokens will be saved automatically');
}
