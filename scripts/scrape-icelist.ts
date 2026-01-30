
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://wiki.icelist.is';
const OUTPUT_DIR = path.resolve(process.cwd(), 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'scraped_data.jsonl');

// Limits
const CONCURRENCY = 10;
const DELAY_MS = 100;

interface ScrapedEntity {
    id: string;
    name?: string;
    type: 'agent' | 'vehicle' | 'incident';
    badgeNumber?: string;
    licensePlate?: string;
    agency?: string;
    office?: string;
    state?: string;
    sourceUrl: string;
    scrapedAt: string;
    raw?: any;
}

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load existing to skip
const visitedUrls = new Set<string>();
if (fs.existsSync(OUTPUT_FILE)) {
    const lines = fs.readFileSync(OUTPUT_FILE, 'utf-8').split('\n');
    for (const line of lines) {
        try {
            if (!line.trim()) continue;
            const item = JSON.parse(line);
            visitedUrls.add(item.sourceUrl);
        } catch (e) { }
    }
    console.log(`Resuming... Found ${visitedUrls.size} already scraped entities.`);
}

async function fetchPage(url: string): Promise<string | null> {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (DataQueryBot/1.0)'
            },
            timeout: 10000
        });
        return response.data;
    } catch (error: any) {
        console.error(`Failed ${url}: ${error.code || error.message}`);
        return null;
    }
}

async function getCategoryLinks(categoryUrl: string): Promise<string[]> {
    let currentUrl: string | undefined = categoryUrl;
    const allLinks: string[] = [];

    while (currentUrl) {
        console.log(`Crawling category page: ${currentUrl}`);
        const html = await fetchPage(currentUrl);
        if (!html) break;

        const $ = cheerio.load(html);

        // Extract profile links
        $('#mw-pages .mw-category-group ul li a').each((_, el) => {
            const href = $(el).attr('href');
            if (href) allLinks.push(`${BASE_URL}${href}`);
        });

        // Debug: Log all links in mw-pages to understand structure
        const navLinks: { text: string, href: string }[] = [];
        $('#mw-pages a').each((_, el) => {
            navLinks.push({ text: $(el).text(), href: $(el).attr('href') || '' });
        });
        // console.log(`Nav links found: ${JSON.stringify(navLinks)}`);

        // Find "next page" link (Case insensitive, look for "next")
        const nextLinkEl = $('#mw-pages a').filter((_, el) => $(el).text().toLowerCase().includes('next'));
        const nextLink = nextLinkEl.last().attr('href'); // Use last to avoid "previous" if it somehow matched, though "next" shouldn't match "previous"

        if (nextLink) {
            console.log(`Found Next Page: ${nextLink}`);
            currentUrl = `${BASE_URL}${nextLink}`;
        } else {
            console.log("No 'next' link found. Reached end of category.");
            currentUrl = undefined;
        }

        await new Promise(r => setTimeout(r, 200));
    }

    return allLinks;
}

async function scrapeEntity(url: string, type: 'agent' | 'vehicle'): Promise<void> {
    if (visitedUrls.has(url)) return;

    const html = await fetchPage(url);
    if (!html) return;

    const $ = cheerio.load(html);
    const title = $('#firstHeading').text().trim();
    const info: Record<string, string> = {};

    // Parse Infobox
    $('table.infobox tr').each((_, row) => {
        const th = $(row).find('th').text().trim().toLowerCase();
        const td = $(row).find('td').text().trim();
        if (th && td) info[th] = td;
    });

    // Heuristics
    let licensePlate = '';
    if (type === 'vehicle' && title.startsWith('Vehicle:')) {
        licensePlate = title.replace('Vehicle:', '').trim();
    }
    if (info['plate'] || info['license plate']) {
        licensePlate = info['plate'] || info['license plate'];
    }

    const badge = info['badge'] || info['badge #'] || info['id'] || info['identifier'];

    const entity: ScrapedEntity = {
        id: Buffer.from(url).toString('base64').substring(0, 12),
        name: type === 'agent' ? title : undefined,
        type,
        sourceUrl: url,
        scrapedAt: new Date().toISOString(),
        agency: info['agency'] || info['department'],
        office: info['field office'] || info['office'],
        state: info['state'],
        badgeNumber: badge,
        licensePlate: licensePlate || undefined,
        raw: info
    };

    // Append to file
    fs.appendFileSync(OUTPUT_FILE, JSON.stringify(entity) + '\n');
    console.log(`Saved: ${title}`);
}

async function processBatch(urls: string[], type: 'agent' | 'vehicle') {
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
        const batch = urls.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(url => scrapeEntity(url, type)));
        if (i + CONCURRENCY < urls.length) await new Promise(r => setTimeout(r, DELAY_MS));
    }
}

async function main() {
    console.log("--- Scraping Agents ---");
    const agentLinks = await getCategoryLinks(`${BASE_URL}/index.php/Category:Agents`);
    console.log(`Found ${agentLinks.length} agents.`);
    await processBatch(agentLinks, 'agent');

    console.log("\n--- Scraping Vehicles ---");
    const vehicleLinks = await getCategoryLinks(`${BASE_URL}/index.php/Category:Vehicles`);
    console.log(`Found ${vehicleLinks.length} vehicles.`);
    await processBatch(vehicleLinks, 'vehicle');

    console.log("Done.");
}

main();
