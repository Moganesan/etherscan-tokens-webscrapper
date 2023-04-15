import puppeteer from "puppeteer-extra";
import UserAgent from "user-agents";
import randomUseragent from "random-useragent";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import fs from "fs";

//Enable stealth mode
puppeteer.use(StealthPlugin());

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36";

(async () => {
  // Launch the browser
  const browser = await puppeteer.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,
  });

  //Randomize User agent or Set a valid one
  const userAgent = randomUseragent.getRandom();
  const UA = userAgent || USER_AGENT;

  // Create a page
  const page = await browser.newPage();

  //Randomize viewport size
  await page.setViewport({
    width: 1920 + Math.floor(Math.random() * 100),
    height: 3000 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
  });

  await page.setUserAgent(UA);
  await page.setJavaScriptEnabled(true);
  await page.setDefaultNavigationTimeout(0);

  //Skip images/styles/fonts loading for performance
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (
      req.resourceType() == "stylesheet" ||
      req.resourceType() == "font" ||
      req.resourceType() == "image"
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.evaluateOnNewDocument(() => {
    // Pass webdriver check
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  await page.evaluateOnNewDocument(() => {
    // Pass chrome check
    window.chrome = {
      runtime: {},
      // etc.
    };
  });

  await page.evaluateOnNewDocument(() => {
    //Pass notifications check
    const originalQuery = window.navigator.permissions.query;
    return (window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters));
  });

  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, "plugins", {
      // This just needs to have `length > 0` for the current test,
      // but we could mock the plugins too if necessary.
      get: () => [1, 2, 3, 4, 5],
    });
  });

  await page.evaluateOnNewDocument(() => {
    // Overwrite the `languages` property to use a custom getter.
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  // Go to your site
  await page.goto(`https://etherscan.io/tokens?ps=100&p=1`, {
    waitUntil: "networkidle2",
  });

  await page.waitForNavigation({ waitUntil: "networkidle2" });

  const tokens = await page.evaluate(() => {
    const tokenData = [];

    const tr = document.querySelectorAll("table tbody tr");
    tr.forEach((tr) => {
      const td = tr.querySelectorAll("td");

      const contractAddress = td[1]
        .querySelector("a")
        .href.replace("https://etherscan.io/token/", "");

      const tokenName = td[1].querySelector("a div div").innerHTML;

      const symbol = td[1]
        .querySelector("a div span")
        .innerHTML.replace("(", "")
        .replace(")", "");

      tokenData.push({
        contractAddress,
        name: tokenName,
        symbol: symbol,
      });
    });

    return tokenData;
  });

  fs.writeFile("./ethereumTokens.json", JSON.stringify(tokens), (error) => {
    if (error) {
      console.log("An error has occurred ", error);
      return;
    }
    console.log("Data written successfully to disk");
  });

  await browser.close();
})();
