/**
 * Format analysis results for Zoho Cliq bot response
 */

export function formatAnalysisResponse(results, user_id, botUrl) {
    const score = results.consistent + results.inconsistent > 0
        ? Math.round((results.consistent / (results.consistent + results.inconsistent)) * 100)
        : 0;

    const summaryText = `📊 **Consistency Score: ${score}%**\n` +
        `✅ Consistent: ${results.consistent} | ⚠️ Inconsistent: ${results.inconsistent}\n` +
        `📱 Android: ${results.android.total} | 🍎 iOS: ${results.ios.total} | 🌐 Web: ${results.web.total}`;

    // Create a compact list of components (max 10 to keep message clean)
    let componentsText = "Key Components:\n";
    const allComponents = [...results.mapping.text, ...results.mapping.buttons];
    const displayItems = allComponents.slice(0, 10);

    displayItems.forEach((item, idx) => {
        const countInfo = item.countInfo ? ` [${item.countInfo}]` : '';
        const status = item.details ? ` (${item.details})` : '';
        componentsText += `${idx + 1}. ${item.name}${countInfo} ${item.icon}${status}\n`;

        // Add detailed breakdown if it exists
        if (item.detailedString) {
            const rawLines = item.detailedString.split('\n');
            const detailLines = rawLines.filter(line => line.trim() && !line.includes('Inventory:'));
            detailLines.forEach(line => {
                componentsText += `   ${line.trim()}\n`;
            });
        }
    });

    if (allComponents.length > 10) {
        componentsText += `... and ${allComponents.length - 10} more.`;
    }

    const downloadUrl = `${botUrl}/bot/download/${user_id}`;

    let text = `✅ **Analysis Complete!**\n\n` +
        `${summaryText}\n\n` +
        `${componentsText}\n\n` +
        `📥 [Download PDF Report](${downloadUrl})`;

    // Return simple text + buttons (most reliable)
    return {
        text: text,
        buttons: [
            {
                label: "📥 Download PDF",
                action: {
                    type: "open.url",
                    data: {
                        url: downloadUrl
                    }
                }
            }
        ]
    };
}
