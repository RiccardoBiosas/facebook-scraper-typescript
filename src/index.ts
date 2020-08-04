const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");
const fs = require("fs");

const extractNumber = require("./extractNumber");

class Scraper {
  extractLikes(text: string) {
    const likesBigNumReg = new RegExp(/(\d+),(\d+) people like/);
    const likesSmallNumReg = new RegExp(/(\d+) people like/);
    const likesMatchedExpr =
      text.match(likesBigNumReg) || text.match(likesSmallNumReg);
    const likes = extractNumber(likesMatchedExpr[0]);
    return likes;
  }

  extractFollowers(text: string) {
    const followersBigNumReg = new RegExp(/(\d+),(\d+) people follow/);
    const followersSmallNumReg = new RegExp(/(\d+) people follow/);
    const followersMatchedExpr =
      text.match(followersBigNumReg) || text.match(followersSmallNumReg);
    console.log("followers match ", followersMatchedExpr);
    const followers = extractNumber(followersMatchedExpr[0]);
    return followers;
  }

  async extractTxtFromImg(id: number) {
    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const {
      data: { text },
    } = await worker.recognize(`./screenshots/screenshot${id}.png`);
    await worker.terminate();
    return text;
  }

  async scrape(id: number, url: string) {
    const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request: any) => {
      if (request.resourceType() === "document") {
        request.continue();
      } else {
        request.abort();
      }
    });
    await page.goto(url);
    await page.evaluate(() => window.scrollTo(1000, 1000));
    fs.mkdir("./screenshots", { recursive: true }, (err: any) => {
      console.log(typeof err);
      if (err) throw err;
    });
    await page.screenshot({ path: `./screenshots/screenshot${id}.png` });

    const text = await this.extractTxtFromImg(id);
    const followers = await this.extractFollowers(text);
    const likes = await this.extractLikes(text);
    await browser.close();
    console.log(`followers: ${followers}, likes: ${likes}`);
    return followers;
  }
}

const scraper = new Scraper();
