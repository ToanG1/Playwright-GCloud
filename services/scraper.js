const { STATUS } = require('../enums/status');
const { chromium } = require('playwright');
const pLimit = require('p-limit');

const MAX_DURATION = 30 * 1000;
const MAX_RETRY_CHECK_ENDPOINT = 5;
const CONCURRENCY_LIMIT = 5;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const fetchHTMLContent = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await page.addInitScript(() => {
    const applyVisibleOverflow = () => {
      document.body.style.overflow = 'visible';
      document.documentElement.style.overflow = 'visible';
    };

    applyVisibleOverflow();

    const observer = new MutationObserver(applyVisibleOverflow);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  });

  await page.evaluate(() => {
    document.body.style.overflow = 'visible';
    document.documentElement.style.overflow = 'visible';
  });

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
    await page.mouse.wheel({ deltaX: 0, deltaY: 4000 });
    await delay(300);
  }

  return await page.content();
};

const handleFetch = async (urls) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
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
