import { Actor, log } from 'apify';

const BASE_URL = 'https://www.startupjobs.cz';
const API_URL = `${BASE_URL}/api/offers`;
const PAGE_SIZE = 20;

// Set gives O(1) lookup; these are the area slugs the public API uses for dev roles
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
    'developer',
]);

type Seniority = 'junior' | 'medior' | 'senior';
type Collaboration = 'external' | 'remote' | 'internship';

type Input = {
    keyword?: string;
    seniority?: Seniority | '';
    maxResults?: number;
};

type Salary = {
    min?: number;
    max?: number;
    currency?: string;
    measure?: 'monthly';
};

type Offer = {
    name?: string;
    company?: string;
    url?: string;
    locations?: string;
    isRemote?: boolean;
    seniorities?: Seniority[];
    collaborations?: Collaboration;
    areaSlugs?: string[];
    salary?: Salary;
    description?: string;
};

type ApiResponse = {
    resultSet?: Offer[];
};

type OutputItem = {
    title: string | undefined;
    company: string | undefined;
    url: string;
    location: string | undefined;
    isRemote: boolean;
    seniority: string;
    collaboration: Collaboration | undefined;
    salary_min: number | undefined;
    salary_max: number | undefined;
    salary_currency: string | undefined;
};

await Actor.init();

// Stop quickly when the user aborts the run, to avoid unnecessary compute costs
Actor.on('aborting', async () => {
    await Actor.exit();
});

const { keyword = '', seniority = '', maxResults = 50 } = (await Actor.getInput<Input>()) ?? {};

log.info(`Searching StartupJobs.cz for: "${keyword}" | seniority: "${seniority || 'all'}" (max ${maxResults} results)`);

let collected = 0;
let page = 1;

while (collected < maxResults) {
    // URL example: https://www.startupjobs.cz/api/offers?keyword=javascript&limit=20&page=1
    const url = new URL(API_URL);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    const response = await fetch(url.toString());

    // The API can return an HTML error page instead of JSON when rate-limited or unavailable,
    // so we check content-type before attempting to parse.
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        log.warning(`Page ${page}: unexpected response (status ${response.status}), stopping.`);
        break;
    }

    const { resultSet: offers = [] } = (await response.json()) as ApiResponse;

    if (!offers.length) {
        log.info('No more results from API.');
        break;
    }

    for (const offer of offers) {
        if (collected >= maxResults) break;

        const isDevRole = (offer.areaSlugs ?? []).some((slug) => DEV_AREA_SLUGS.has(slug));
        // The public API has no seniority query param, so we filter client-side
        const isSeniorityMatch = !seniority || (offer.seniorities ?? []).includes(seniority as Seniority);
        // The API can return broader results than expected - this double-checks the keyword is actually in the title or description
        const isKeywordMatch = !keyword || offer.name?.toLowerCase().includes(keyword.toLowerCase()) || offer.description?.toLowerCase().includes(keyword.toLowerCase());
        if (!isDevRole || !isSeniorityMatch || !isKeywordMatch) continue;

        const { salary } = offer;
        const item: OutputItem = {
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
        };
        await Actor.pushData(item);
        collected++;
    }

    log.info(`Page ${page} done — ${collected} jobs collected so far`);
    page++;
}

log.info(`Finished. Total jobs saved: ${collected}`);

await Actor.exit();
