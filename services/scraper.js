const { STATUS } = require('../enums/status');
const { chromium } = require('playwright');

const MAX_DURATION = 30 * 1000;
const MAX_RETRY_CHECK_ENDPOINT = 5;

const handleFetch = async (urls) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    const result = [];
    for (const url of urls) {
      const response = {
        url,
        status: STATUS.FAILED,
        html: null,
      };

      try {
        const page = await browser.newPage();
        response.html = await fetchHTMLContent(page, url);
        response.status = STATUS.SUCCESS;
        await page.close();
      } catch(err) {
        console.error(err);
      } finally {
        result.push(response);
      }
    }

    return result;
  } catch {
    return;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

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
    await page.mouse.wheel(0, 4000);
    await delay(300);
  }

  return await page.content();
};

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = { handleFetch };