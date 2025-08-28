const express = require("express");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

// ==== FUNGSI DOWNLOAD FOTO ====
async function downloadFoto(url, outputPath) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// ==== FUNGSI FOTO → VIDEO (Optimasi) ====
function fotoKeVideo(inputFoto, outputVideo, durasiDetik = 8) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputFoto)
      .loop(durasiDetik)
      .outputOptions([
        "-c:v libx264",
        `-t ${durasiDetik}`,
        "-pix_fmt yuv420p",
        "-vf scale=720:-1", // resize agar ringan
        "-preset ultrafast", // biar cepat encode
        "-crf 30", // compress (30 = kualitas medium)
      ])
      .save(outputVideo)
      .on("end", () => resolve(outputVideo))
      .on("error", (err) => reject(err));
  });
}

// ==== FUNGSI UPLOAD TIKTOK ====
async function uploadTikTok(videoPath) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // optimasi untuk Railway
    ],
  });

  const context = await browser.newContext();

  const cookiesPath = path.join(__dirname, "cookies.json");
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  await page.goto("https://www.tiktok.com/upload", { waitUntil: "networkidle" });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click('input[type="file"]'), // ⚠️ pastikan selector benar
  ]);
  await fileChooser.setFiles(videoPath);

  console.log("Video siap di-upload ke TikTok.");
  await page.waitForTimeout(8000);

  await browser.close();
}

// ==== ROUTES EXPRESS ====

// root
app.get("/", (req, res) => {
  res.send("🚀 Service TikTok siap digunakan");
});

// generate video dari foto
app.get("/generate", async (req, res) => {
  try {
    const durasi = parseInt(req.query.durasi) || 8; // bisa custom durasi
    const fotoUrl = `https://farhan.tripointeknologi.com/proses/output/quote.png?ts=${Date.now()}`;
    const inputFoto = path.join(__dirname, "quotes.png");
    const outputVideo = path.join(__dirname, "video.mp4");

    console.log("⬇️ Download foto...");
    await downloadFoto(fotoUrl, inputFoto);

    console.log(`🎞️ Convert foto → video (${durasi}s)...`);
    await fotoKeVideo(inputFoto, outputVideo, durasi);

    res.send(`✅ Video berhasil dibuat (${durasi}s)`);
  } catch (err) {
    console.error("❌ Error generate:", err);
    res.status(500).send("Gagal generate video");
  }
});

// upload video ke TikTok
app.get("/upload", async (req, res) => {
  try {
    const outputVideo = path.join(__dirname, "video.mp4");

    if (!fs.existsSync(outputVideo)) {
      return res.status(400).send("❌ Video belum ada. Jalankan /generate dulu.");
    }

    await uploadTikTok(outputVideo);
    res.send("✅ Video berhasil diupload ke TikTok");
  } catch (err) {
    console.error("❌ Error upload:", err);
    res.status(500).send("Gagal upload ke TikTok");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di port ${PORT}`);
});
