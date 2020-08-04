const puppeteer = require("puppeteer");
const { v4: uuidv4 } = require("uuid");
const { createWorker, createScheduler } = require("tesseract.js");
const fs = require("fs");
const cpusNum = require("os").cpus().length;
const cluster = require("cluster");

const extractNumber = require("./extractNumber");
const asyncForEach = require("./asyncForEach");

class Scraper {
  public scheduler: any;
  constructor() {
    this.scheduler = createScheduler();
  }
  extractLikes(text: string) {
    const likesBigNumReg = new RegExp(/(\d+),(\d+) people like/);
    const likesSmallNumReg = new RegExp(/(\d+) people like/);
    const likesMatchedExpr =
      text.match(likesBigNumReg) || text.match(likesSmallNumReg);
    if (likesMatchedExpr) {
      const likes = extractNumber(likesMatchedExpr[0]);
      return likes;
    }
    return;
  }

  extractFollowers(text: string) {
    const followersBigNumReg = new RegExp(/(\d+),(\d+) people follow/);
    const followersSmallNumReg = new RegExp(/(\d+) people follow/);
    const followersMatchedExpr =
      text.match(followersBigNumReg) || text.match(followersSmallNumReg);
    if (followersMatchedExpr) {
      const followers = extractNumber(followersMatchedExpr[0]);
      return followers;
    }
    return;
  }

  async extractTxtFromImg(id: number) {
    const worker = createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    this.scheduler.addWorker(worker);
    try {
      const {
        data: { text },
      } = await this.scheduler.addJob(
        "recognize",
        `./screenshots/screenshot${id}.png`
      );
      return text;
    } catch (err) {
      console.error(err);
      return;
    }
  }

  async scrape(url: string, id?: number) {
    const trainedDataPath = "./eng.traineddata";
    try {
      if (fs.existsSync(trainedDataPath)) {
        fs.unlinkSync(trainedDataPath);
      }
    } catch (err) {
      console.error(err);
    }
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
      if (err) throw err;
    });
    let currentId = id || uuidv4();
    await page.screenshot({ path: `./screenshots/screenshot${currentId}.png` });
    const text = await this.extractTxtFromImg(currentId);
    const followers = await this.extractFollowers(text);
    const likes = await this.extractLikes(text);
    await browser.close();
    console.log(`url: ${url}, followers: ${followers}, likes: ${likes}`);
    return [followers, likes];
  }

  async scrapeList(list: string[]) {
    if (list.length < cpusNum) {
      if (cluster.isMaster) {
        for (let k = 0; k < list.length; k++) {
          const WORKER_LIST_ID = { scrapeId: k, scrapeUrl: list[k] };
          cluster.fork(WORKER_LIST_ID);
        }
        console.log("master here");
      } else {
        await this.scrape(
          process.env.scrapeUrl,
          parseInt(process.env.scrapeId, 0)
        );
        process.exit();
      }
    } else {
      const chunksLength = Math.ceil(list.length / (cpusNum / 2));
      const arrWorkerChunks = list.reduce((outputArr, item, indx) => {
        const chunkIndx = Math.floor(indx / chunksLength);
        if (!outputArr[chunkIndx]) {
          outputArr[chunkIndx] = [];
        }
        outputArr[chunkIndx].push(item);
        return outputArr;
      }, []);

      if (cluster.isMaster) {
        for (let k = 0; k < arrWorkerChunks.length; k++) {
          const WORKER_CHUNK_ID = { scrapeChunkId: k };
          cluster.fork(WORKER_CHUNK_ID);
        }
      } else {
        await asyncForEach(
          arrWorkerChunks[parseInt(process.env.scrapeChunkId, 10)],
          (id: number, url: string) => this.scrape(url, null)
        );
        process.exit();
      }
    }
    await this.scheduler.terminate();
  }
}

const scraper = new Scraper();
