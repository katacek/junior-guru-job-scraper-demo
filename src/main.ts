import { Actor, log } from 'apify';

const BASE_URL = 'https://www.startupjobs.cz';
const API_URL = `${BASE_URL}/api/offers`;
const PAGE_SIZE = 20;


const DEV_AREA_SLUGS = new Set([
    'vyvoj',
    'back-end-vyvojar',
    'front-end-vyvojar',
    'fullstack-vyvojar',
    'mobile-vyvojar',
    'machine-learning',
    'devops-specialista',
    'it-security-specialista',
    'system-admin',
    'qa-tester',
]);

interface Input {
    keyword?: string;
    seniority?: string;
    maxResults?: number;
}

interface Salary {
    min?: number;
    max?: number;
    currency?: string;
}

interface Offer {
    name?: string;
    company?: string;
    url?: string;
    locations?: string;
    isRemote?: boolean;
    seniorities?: string[];
    collaborations?: string;
    areaSlugs?: string[];
    salary?: Salary;
}

await Actor.init();

const { keyword = 'javascript', seniority = 'junior', maxResults = 50 } = (await Actor.getInput<Input>()) ?? {};

log.info(`Searching StartupJobs.cz for: "${keyword}" | seniority: "${seniority || 'all'}" (max ${maxResults} results)`);

let collected = 0;
let page = 1;

while (collected < maxResults) {
    const url = new URL(API_URL);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    const response = await fetch(url.toString());
    const { resultSet: offers = [] } = (await response.json()) as { resultSet?: Offer[] };

    if (!offers.length) {
        log.info('No more results from API.');
        break;
    }

    for (const offer of offers) {
        if (collected >= maxResults) break;

        const isDevRole = (offer.areaSlugs ?? []).some((slug) => DEV_AREA_SLUGS.has(slug));
        const isSeniorityMatch = !seniority || (offer.seniorities ?? []).includes(seniority);
        if (!isDevRole || !isSeniorityMatch) continue;

        const { salary } = offer;
        await Actor.pushData({
            title: offer.name,
            company: offer.company,
            url: `${BASE_URL}${offer.url}`,
            location: offer.locations,
            isRemote: offer.isRemote ?? false,
            seniority: (offer.seniorities ?? []).join(', '),
            collaboration: offer.collaborations,
            salary_min: salary?.min,
            salary_max: salary?.max,
            salary_currency: salary?.currency,
        });
        collected++;
    }

    log.info(`Page ${page} done — ${collected} jobs collected so far`);
    page++;
}

log.info(`Finished. Total jobs saved: ${collected}`);

await Actor.exit();
