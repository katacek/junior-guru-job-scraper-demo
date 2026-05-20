# Junior Job Tracker — StartupJobs.cz

An [Apify Actor](https://apify.com/actors) that collects junior developer job listings from [StartupJobs.cz](https://www.startupjobs.cz) using their public API.

Built as a live demo for the [junior.guru](https://junior.guru) community talk *"Scraping bez strachu"*.

---

## What does it do?

You give it a keyword (e.g. `junior`, `python`, `javascript`) and it returns a list of matching developer/engineer job offers including title, company, location, salary, and a direct link. Non-tech roles (sales, marketing, etc.) are filtered out automatically.

Results are stored in an Apify Dataset and can be exported to **CSV**, **JSON**, or **Google Sheets** in one click.

---

## Prerequisites

- [Apify account](https://console.apify.com) (free tier is enough)
- Node.js 18+
- [Apify CLI](https://docs.apify.com/cli/)

```bash
npm install -g apify-cli
apify login
```

---

## Step 1 — Find the API using DevTools

Before writing any code, open [startupjobs.cz/nabidky](https://www.startupjobs.cz/nabidky) in your browser and explore how it loads data.

1. Press **F12** to open DevTools
2. Go to the **Network** tab
3. Filter by **Fetch/XHR**
4. Reload the page or type a keyword in the search box
5. Look for a request to `/api/offers`

You'll see something like:

```
GET https://www.startupjobs.cz/api/offers?keyword=junior&limit=20&page=1
```

Open it in a new tab — you get clean JSON back. No HTML parsing needed. 🎉

```json
{
  "resultSet": [
    {
      "name": "Junior TypeScript Developer",
      "company": "Acme s.r.o.",
      "url": "/nabidka/12345/junior-typescript-developer",
      "locations": "Praha",
      "isRemote": true,
      "seniorities": ["junior"],
      "areaSlugs": ["back-end-vyvojar", "vyvoj"],
      "salary": { "min": 40000, "max": 60000, "currency": "CZK", "measure": "monthly" }
    }
  ]
}
```

---

## Step 2 — Walk through the code

The entire actor is in [`src/main.ts`](src/main.ts). Here's what it does:

```typescript
await Actor.init();
const { keyword = 'junior', maxResults = 50 } = await Actor.getInput() ?? {};

while (collected < maxResults) {
    // 1. Call the StartupJobs API — plain fetch(), JSON response
    const response = await fetch(`${API_URL}?keyword=${keyword}&page=${page}`);
    const { resultSet: offers } = await response.json();

    for (const offer of offers) {
        // 2. Skip non-developer roles (sales, marketing, etc.) and non-junior seniority
        const isDevRole = offer.areaSlugs.some((slug) => DEV_AREA_SLUGS.has(slug));
        const isJunior = offer.seniorities.includes('junior');
        if (!isDevRole || !isJunior) continue;

        // 3. Pick the fields we care about and save to Apify Dataset
        await Actor.pushData({
            title: offer.name,
            company: offer.company,
            url: `${BASE_URL}${offer.url}`,
            // ...
        });
    }
}
```

Three concepts, that's it: **fetch → filter → save**.

---

## Step 3 — Run locally

```bash
# Install dependencies
npm install

# Run without building (great for development)
npm run dev

# Or build first, then run
npm run build
npm start
```

To set a custom keyword, create `storage/key_value_stores/default/INPUT.json`:

```json
{
  "keyword": "javascript",
  "maxResults": 20
}
```

---

## Step 4 — Deploy to Apify

```bash
apify push
```

Your actor is now live at [console.apify.com](https://console.apify.com/actors) under **My Actors**.

---

## Step 5 — Schedule & export

**Run on a schedule** — e.g. every morning at 8:00:
1. Open your actor in Apify Console
2. Go to **Schedules** → **+ New Schedule**
3. Set cron: `0 8 * * 1-5` (Mon–Fri at 8:00)

**Export results:**
- Dataset → **Export** → CSV / JSON / Excel
- Or connect directly to **Google Sheets** via Apify integrations

---

## Build your own scraper

Want to scrape a different site? You can use this repo as a starting point.

1. **Pick your starting point** based on what the target site looks like:

   | Situation | Template |
   |---|---|
   | Site has a JSON API (like this demo) | Clone this repo |
   | No API, static HTML | `ts-crawlee-cheerio` |
   | No API, heavy JavaScript / dynamic content | `ts-crawlee-playwright` |

   ```bash
   apify create my-scraper --template ts-crawlee-cheerio
   ```

2. **Find the data source** — open the target site in your browser, go to DevTools → Network → Fetch/XHR, and look for an API call returning JSON. If there's no API, switch to the Elements tab and find the CSS selectors for the data you need.

3. **Edit `src/main.ts`** — replace the `fetch()` URL and the fields inside `Actor.pushData({...})` with whatever your target API or page returns. The structure stays the same: fetch → filter → save.

4. **Update `.actor/input_schema.json`** to define the inputs your scraper needs (keywords, URLs, limits, etc.).

5. **Run locally** with `npm run dev`, then deploy with `apify push`.

The Apify [documentation](https://docs.apify.com/sdk/js) and [Academy](https://docs.apify.com/academy/web-scraping-for-beginners) are great next steps from here.

---

## Going further

| What | How |
|---|---|
| Filter by seniority | Check `offer.seniorities.includes('junior')` in the loop |
| Email alert on new listings | Use Apify webhooks → Zapier → Gmail |
| Compare day-over-day | Store results with a timestamp, diff on next run |
| Scrape a JS-heavy site | Switch to `PlaywrightCrawler` from Crawlee |
| Browse 29 000+ ready-made scrapers | [apify.com/store](https://apify.com/store) |

---

## Resources

- [Apify SDK for JavaScript/TypeScript](https://docs.apify.com/sdk/js)
- [Apify Academy — Web scraping for beginners](https://docs.apify.com/academy/web-scraping-for-beginners)
- [junior.guru](https://junior.guru) — community and handbook for junior developers in CZ/SK
- [Talk slides](#) *(link will be added after the event)*
