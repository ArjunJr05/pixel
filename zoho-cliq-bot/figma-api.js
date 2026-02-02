import axios from 'axios';
import { getValidFigmaToken } from './figma-oauth.js';

/**
 * Fetch Figma design file using OAuth token
 * @param {string} fileKey - Figma file key
 * @returns {Promise<Object>} Figma file data
 */
export async function fetchFigmaFile(fileKey) {
    try {
        const token = await getValidFigmaToken();

        const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        return response.data;

    } catch (error) {
        if (error.response?.status === 429) {
            throw new Error('Figma rate limit exceeded. Please try again later.');
        }
        throw error;
    }
}

/**
 * Fetch Figma design from URL using OAuth token
 * @param {string} url - Full Figma file URL
 * @returns {Promise<Object>} Figma file data
 */
export async function fetchFigmaDesignFromUrl(url) {
    // Extract file key from URL
    const fileKey = extractFileKeyFromUrl(url);

    if (!fileKey) {
        throw new Error('Invalid Figma URL');
    }

    return await fetchFigmaFile(fileKey);
}

/**
 * Extract file key from Figma URL
 * @param {string} url - Figma URL
 * @returns {string|null} File key
 */
function extractFileKeyFromUrl(url) {
    if (url.includes('/design/')) {
        const start = url.indexOf('/design/') + 8;
        let end = url.indexOf('/', start);
        if (end === -1) end = url.indexOf('?', start);
        if (end === -1) end = url.length;
        return url.substring(start, end);
    }
    return null;
}

export default {
    fetchFigmaFile,
    fetchFigmaDesignFromUrl
};
