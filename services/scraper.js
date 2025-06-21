const { STATUS } = require('../enums/status');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pLimit = require('p-limit');

const MAX_DURATION = 30 * 1000;
const MAX_RETRY_CHECK_ENDPOINT = 5;
const CONCURRENCY_LIMIT = 5;

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

const fetchHTMLContent = async (page, url) => {
  // Block unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const blocked = ['image', 'stylesheet', 'font'];
    if (blocked.includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  // Set viewport and headers
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent(USER_AGENT);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  // Navigate to page
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Prevent overflow hiding
  await page.evaluate(() => {
    const applyVisibleOverflow = () => {
      document.body.style.overflow = 'visible';
      document.documentElement.style.overflow = 'visible';
    };

    applyVisibleOverflow();

    const observer = new MutationObserver(applyVisibleOverflow);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  });

  // Scroll simulation
  let previousScrollTop = -1;
  let retryCount = 0;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_DURATION) {
    const scrollTop = await page.evaluate(() => window.scrollY);

    if (scrollTop === previousScrollTop) {
      if (++retryCount >= MAX_RETRY_CHECK_ENDPOINT) break;
      await delay(500);
      continue;
    }

    retryCount = 0;
    previousScrollTop = scrollTop;
    await page.evaluate(() => window.scrollBy(0, 4000));
    await delay(300);
  }

  return await page.content();
};

const handleFetch = async (urls) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, // must be true for Cloud Run
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const limit = pLimit(CONCURRENCY_LIMIT);
    const results = [];

    const tasks = urls.map((url) =>
      limit(async () => {
        const response = {
          url,
          status: STATUS.SUCCESS,
          html: null,
        };

        let page;
        try {
          page = await browser.newPage();
          response.html = await fetchHTMLContent(page, url);
        } catch (err) {
          response.status = STATUS.FAILED;
          console.error(`[ERROR] ${url}`, err);
        } finally {
          if (page) await page.close();
          results.push(response);
        }
      })
    );

    await Promise.all(tasks);
    return results;
  } catch (err) {
    console.error('Browser launch failed', err);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = { handleFetch };
