/**
 * Zoho Cliq Bot Handler for PixelCheck
 * This bot allows users to analyze UI/UX designs by uploading JSON files
 */

import express from 'express';
import multer from 'multer';
import { jsPDF } from 'jspdf';
import axios from 'axios';
import fs from 'fs';
import { extractFeatures, compareFeatures } from '../src/utils/analyzer-node.js';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'));
        }
    }
});

// Analyzer utilities imported above

// Store user sessions (in production, use Redis or database)
const userSessions = new Map();

/**
 * Handle incoming messages from Zoho Cliq
 */
async function handleBotMessage(req, res) {
    try {
        const { text, user, name } = req.body;
        const userId = user.id;

        // Initialize session if not exists
        if (!userSessions.has(userId)) {
            userSessions.set(userId, {
                step: 'initial',
                files: {
                    android: null,
                    ios: null,
                    web: null
                }
            });
        }

        const session = userSessions.get(userId);

        // Handle different commands
        if (text.toLowerCase() === 'start' || text.toLowerCase() === 'help') {
            return res.json(createWelcomeMessage());
        }

        if (text.toLowerCase() === 'reset') {
            userSessions.delete(userId);
            return res.json({
                text: "✅ Session reset! Type 'start' to begin a new analysis."
            });
        }

        if (text.toLowerCase() === 'status') {
            return res.json(createStatusMessage(session));
        }

        // Default response
        return res.json({
            text: "I didn't understand that. Type 'help' for available commands."
        });

    } catch (error) {
        console.error('Error handling bot message:', error);
        return res.json({
            text: `❌ Error: ${error.message}`
        });
    }
}

/**
 * Handle file uploads from Zoho Cliq
 */
async function handleFileUpload(req, res) {
    try {
        const { platform, userId } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse JSON
        const jsonData = JSON.parse(file.buffer.toString('utf-8'));

        // Validate JSON structure
        if (!jsonData.document) {
            return res.status(400).json({
                error: 'Invalid JSON structure. Expected "document" property.'
            });
        }

        // Get or create session
        if (!userSessions.has(userId)) {
            userSessions.set(userId, {
                step: 'uploading',
                files: {
                    android: null,
                    ios: null,
                    web: null
                }
            });
        }

        const session = userSessions.get(userId);
        session.files[platform] = jsonData;

        // Check if all files are uploaded
        const allFilesUploaded = session.files.android &&
            session.files.ios &&
            session.files.web;

        if (allFilesUploaded) {
            // Perform analysis
            const results = performAnalysis(session.files);
            session.results = results;
            session.step = 'complete';

            // Send results to Cliq
            return res.json({
                success: true,
                message: createResultsMessage(results),
                canDownload: true
            });
        } else {
            return res.json({
                success: true,
                message: createUploadStatusMessage(session),
                canDownload: false
            });
        }

    } catch (error) {
        console.error('Error handling file upload:', error);
        return res.status(500).json({
            error: `Failed to process file: ${error.message}`
        });
    }
}

/**
 * Perform design analysis
 */
function performAnalysis(files) {
    const androidFeatures = extractFeatures(files.android.document);
    const iosFeatures = extractFeatures(files.ios.document);
    const webFeatures = extractFeatures(files.web.document);

    return compareFeatures(androidFeatures, iosFeatures, webFeatures);
}

/**
 * Generate PDF report
 * Can be used as an Express route handler or called directly
 */
async function generatePDFReport(req, res) {
    try {
        let results, userId, isExpress = false;

        // Determine if called as Express route or directly
        if (req && req.params && req.params.userId) {
            userId = req.params.userId;
            const session = userSessions.get(userId);
            if (!session || !session.results) {
                return res.status(404).json({ error: 'No analysis results found' });
            }
            results = session.results;
            isExpress = true;
        } else if (req && res) {
            results = req;
            userId = res;
        } else {
            throw new Error('Invalid arguments to generatePDFReport');
        }

        console.log('📄 Generating High-Fidelity PDF for User ID:', userId);

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const blueColor = [79, 70, 229]; // #4f46e5
        const greenColor = [16, 185, 129]; // #10b981
        const orangeColor = [245, 158, 11]; // #f59e0b
        const redColor = [239, 68, 68]; // #ef4444
        const textColor = [30, 41, 59]; // #1e293b
        const lightGray = [241, 245, 249]; // #f1f5f9

        let yPos = 25;

        // --- PAGE 1: COVER ---
        // Header Icon & Title (Removed Emojis to fix encoding)
        doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.setLineWidth(1.5);
        doc.line(margin, yPos + 10, pageWidth - margin, yPos + 10);

        doc.setFontSize(20);
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.setFont(undefined, 'bold');
        doc.text('PixelCheck Component Analysis Report', margin, yPos + 6);
        yPos += 25;

        // Metadata Box
        doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 35);

        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont(undefined, 'normal');
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 5, yPos + 10);
        doc.setFont(undefined, 'bold');
        doc.text(`Total Mappings Identified: ${results.consistent + results.inconsistent}`, margin + 5, yPos + 18);
        doc.setFont(undefined, 'normal');
        doc.text(`Analysis Method: Structural DNA Matching (Hybrid AI)`, margin + 5, yPos + 26);
        yPos += 50;

        // Table of Contents
        doc.setFontSize(16);
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.text('Table of Contents', margin, yPos);
        yPos += 12;

        doc.setFontSize(11);
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.text('1. Analysis Summary', margin + 5, yPos);
        yPos += 8;
        doc.text(`2. Detailed Component Audit (${results.consistent + results.inconsistent})`, margin + 5, yPos);
        yPos += 8;
        doc.text('3. Platform Discrepancy & Recommendations', margin + 5, yPos);
        yPos += 10;

        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);

        // --- PAGE 2: SUMMARY ---
        doc.addPage();
        yPos = 25;

        doc.setFontSize(18);
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.text('1. Analysis Summary', margin, yPos);
        yPos += 15;

        // Summary Grid
        const cardWidth = (pageWidth - 2 * margin - 10) / 3;
        const cardHeight = 35;

        const drawCard = (x, y, title, value, color) => {
            doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
            doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.setFont(undefined, 'normal');
            doc.text(title, x + cardWidth / 2, y + 12, { align: 'center' });
            doc.setFontSize(16);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.setFont(undefined, 'bold');
            doc.text(String(value), x + cardWidth / 2, y + 26, { align: 'center' });
        };

        drawCard(margin, yPos, 'Android Components', results.android.total, blueColor);
        drawCard(margin + cardWidth + 5, yPos, 'iOS Components', results.ios.total, blueColor);
        drawCard(margin + 2 * cardWidth + 10, yPos, 'Web Components', results.web.total, blueColor);
        yPos += 45;

        drawCard(margin, yPos, 'Consistent (All)', results.consistent, greenColor);
        drawCard(margin + cardWidth + 5, yPos, 'Inconsistent / Missing', results.inconsistent, orangeColor);
        drawCard(margin + 2 * cardWidth + 10, yPos, 'Total Unique Components', results.consistent + results.inconsistent, blueColor);
        yPos += 40;

        // --- PAGE 3+: COMPONENT AUDIT ---
        doc.addPage();
        yPos = 25;

        doc.setFontSize(18);
        doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
        doc.text('2. Detailed Component Audit', margin, yPos);
        yPos += 10;
        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('Showing presence and structure across all platforms.', margin, yPos);
        yPos += 12;

        results.mapping.text.forEach((item, index) => {
            if (yPos > pageHeight - 40) {
                doc.addPage();
                yPos = 25;
            }

            const isConsistent = item.icon === '✅';
            const color = isConsistent ? greenColor : orangeColor;

            // Status Indicator
            doc.setFillColor(color[0], color[1], color[2]);
            doc.roundedRect(margin, yPos - 5, 2, 12, 1, 1, 'F');

            // Name
            doc.setFontSize(11);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont(undefined, 'bold');
            doc.text(item.name, margin + 5, yPos);

            // Missing Analysis
            const missing = [];
            if (!item.platforms.includes('Android')) missing.push('Android');
            if (!item.platforms.includes('iOS')) missing.push('iOS');
            if (!item.platforms.includes('Web')) missing.push('Web');

            yPos += 6;
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');

            // Show Presence & Counts
            doc.setTextColor(100, 100, 100);
            const presenceText = `Present in: ${item.platforms}`;
            const countText = ` | ${item.countInfo}`;
            doc.text(presenceText + countText, margin + 5, yPos);

            // Explicitly Show Missing or Discrepancy (Red)
            if (missing.length > 0 || item.icon === '⚠️') {
                doc.setTextColor(redColor[0], redColor[1], redColor[2]);
                doc.setFont(undefined, 'bold');
                doc.text(` -> ${item.details}`, margin + 5, yPos + 6);
                yPos += 6;
            }

            // Render Detailed Inventory String with Wrapping
            if (item.detailedString) {
                yPos += 2;
                doc.setFontSize(8);
                doc.setTextColor(80, 80, 80);
                doc.setFont(undefined, 'normal');

                const detailLines = item.detailedString.split('\n');
                const maxWidth = pageWidth - margin * 2 - 10;

                detailLines.forEach(line => {
                    const wrappedLines = doc.splitTextToSize(line, maxWidth);
                    wrappedLines.forEach(rawLine => {
                        if (yPos > pageHeight - margin) {
                            doc.addPage();
                            yPos = margin + 10;
                        }
                        doc.text(rawLine, margin + 5, yPos);
                        yPos += 4;
                    });
                });
            }

            yPos += 6;
            doc.setDrawColor(240, 240, 240);
            doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
            yPos += 5;
        });

        // Recommendations section removed per user request

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        if (isExpress) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=PixelCheck-Report-${userId}.pdf`);
            return res.send(pdfBuffer);
        } else {
            const reportsDir = './reports';
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
            const filename = `Report-${userId}-${Date.now()}.pdf`;
            const reportPath = `${reportsDir}/${filename}`;
            fs.writeFileSync(reportPath, pdfBuffer);
            return reportPath;
        }

    } catch (error) {
        console.error('Error generating PDF:', error);
        if (res && typeof res.status === 'function') {
            return res.status(500).json({ error: 'Failed to generate PDF' });
        }
        throw error;
    }
}

/**
 * Create welcome message
 */
function createWelcomeMessage() {
    return {
        text: "🎨 **Welcome to PixelCheck Bot!**",
        card: {
            title: "PixelCheck - UI/UX Design Analyzer",
            theme: "modern-inline",
            sections: [
                {
                    type: "text",
                    text: "I help you analyze UI/UX design consistency across Android, iOS, and Web platforms."
                },
                {
                    type: "divider"
                },
                {
                    type: "text",
                    text: "**How to use:**\n1. Upload your Android JSON file\n2. Upload your iOS JSON file\n3. Upload your Web JSON file\n4. I'll analyze and show you the results\n5. Download the PDF report"
                },
                {
                    type: "divider"
                },
                {
                    type: "buttons",
                    buttons: [
                        {
                            label: "📱 Upload Android JSON",
                            action: {
                                type: "invoke.function",
                                data: {
                                    name: "uploadFile",
                                    platform: "android"
                                }
                            }
                        },
                        {
                            label: "🍎 Upload iOS JSON",
                            action: {
                                type: "invoke.function",
                                data: {
                                    name: "uploadFile",
                                    platform: "ios"
                                }
                            }
                        },
                        {
                            label: "🌐 Upload Web JSON",
                            action: {
                                type: "invoke.function",
                                data: {
                                    name: "uploadFile",
                                    platform: "web"
                                }
                            }
                        }
                    ]
                }
            ]
        },
        buttons: [
            {
                label: "📊 Check Status",
                action: {
                    type: "invoke.function",
                    data: {
                        name: "checkStatus"
                    }
                }
            },
            {
                label: "🔄 Reset",
                action: {
                    type: "invoke.function",
                    data: {
                        name: "reset"
                    }
                }
            }
        ]
    };
}

/**
 * Create status message
 */
function createStatusMessage(session) {
    const androidStatus = session.files.android ? '✅' : '⏳';
    const iosStatus = session.files.ios ? '✅' : '⏳';
    const webStatus = session.files.web ? '✅' : '⏳';

    return {
        text: "📊 **Current Status**",
        card: {
            title: "Upload Status",
            theme: "modern-inline",
            sections: [
                {
                    type: "text",
                    text: `${androidStatus} Android JSON: ${session.files.android ? 'Uploaded' : 'Pending'}\n${iosStatus} iOS JSON: ${session.files.ios ? 'Uploaded' : 'Pending'}\n${webStatus} Web JSON: ${session.files.web ? 'Uploaded' : 'Pending'}`
                }
            ]
        }
    };
}

/**
 * Create upload status message
 */
function createUploadStatusMessage(session) {
    const androidStatus = session.files.android ? '✅' : '⏳';
    const iosStatus = session.files.ios ? '✅' : '⏳';
    const webStatus = session.files.web ? '✅' : '⏳';

    const remaining = [];
    if (!session.files.android) remaining.push('Android');
    if (!session.files.ios) remaining.push('iOS');
    if (!session.files.web) remaining.push('Web');

    return {
        text: `✅ File uploaded successfully!\n\n**Status:**\n${androidStatus} Android\n${iosStatus} iOS\n${webStatus} Web\n\n${remaining.length > 0 ? `⏳ Still waiting for: ${remaining.join(', ')}` : ''}`,
        buttons: remaining.map(platform => ({
            label: `Upload ${platform} JSON`,
            action: {
                type: "invoke.function",
                data: {
                    name: "uploadFile",
                    platform: platform.toLowerCase()
                }
            }
        }))
    };
}

/**
 * Create results message
 */
function createResultsMessage(results) {
    const consistencyPercentage = results.consistent + results.inconsistent > 0
        ? Math.round((results.consistent / (results.consistent + results.inconsistent)) * 100)
        : 0;

    return {
        text: "✅ **Analysis Complete!**",
        card: {
            title: "PixelCheck Analysis Results",
            theme: "modern-inline",
            sections: [
                {
                    type: "text",
                    text: `**Summary**\n📱 Android: ${results.android.total} features\n🍎 iOS: ${results.ios.total} features\n🌐 Web: ${results.web.total} features`
                },
                {
                    type: "divider"
                },
                {
                    type: "text",
                    text: `**Consistency Score: ${consistencyPercentage}%**\n✅ Consistent: ${results.consistent}\n⚠️ Inconsistent: ${results.inconsistent}`
                },
                {
                    type: "divider"
                },
                {
                    type: "text",
                    text: `**Component Breakdown**\n📝 Text Elements: ${results.mapping.text.length}\n🔘 Buttons: ${results.mapping.buttons.length}`
                }
            ]
        },
        buttons: [
            {
                label: "📥 Download PDF Report",
                action: {
                    type: "invoke.function",
                    data: {
                        name: "downloadPDF"
                    }
                }
            },
            {
                label: "🔄 New Analysis",
                action: {
                    type: "invoke.function",
                    data: {
                        name: "reset"
                    }
                }
            }
        ]
    };
}


export {
    handleBotMessage,
    handleFileUpload,
    generatePDFReport,
    userSessions
};
