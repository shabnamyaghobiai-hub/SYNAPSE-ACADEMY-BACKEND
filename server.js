const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// بررسی وضعیت سرور
app.get("/", (req, res) => {
  res.status(200).json({
    service: "SYNAPSE ACADEMY Backend",
    status: "running"
  });
});

// بررسی سلامت سرور
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

// مقایسه امن کلیدهای دسترسی
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const crypto = require("crypto");
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return first.length === second.length &&
    crypto.timingSafeEqual(first, second);
}

// ارسال پیام به تلگرام
async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Telegram configuration is missing");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error("Telegram delivery failed");
  }

  return true;
}

// آزمایش اتصال ربات؛ فقط مدیر مجاز است
app.post("/admin/test-telegram", async (req, res) => {
  const expectedKey = process.env.ADMIN_TEST_KEY;
  const providedKey = req.get("x-admin-key");

  if (
    !expectedKey ||
    !safeCompare(providedKey, expectedKey)
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  try {
    await sendTelegramMessage(
      "✅ اتصال آزمایشی SYNAPSE ACADEMY موفق بود.\n" +
      "سرور آماده بررسی ارسال گزارش‌هاست."
    );

    return res.json({
      success: true,
      message: "Telegram test message sent"
    });
  } catch (error) {
    console.error("Telegram test failed:", error.message);

    return res.status(502).json({
      error: "Telegram test failed. Check server configuration."
    });
  }
});

// دریافت گزارش آموزشی و ارسال آن به تلگرام
app.post("/report", async (req, res) => {
  const expectedKey = process.env.REPORT_API_KEY;
  const providedKey = req.get("x-api-key");

  if (
    !expectedKey ||
    !safeCompare(providedKey, expectedKey)
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const {
    studentName,
    courseName,
    completedClasses,
    score,
    totalQuestions
  } = req.body || {};

  if (
    typeof studentName !== "string" ||
    studentName.trim().length < 2 ||
    studentName.length > 100 ||
    typeof courseName !== "string" ||
    courseName.length > 100 ||
    !Number.isInteger(completedClasses) ||
    completedClasses < 0 ||
    completedClasses > 1000 ||
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100 ||
    !Number.isInteger(totalQuestions) ||
    totalQuestions < 1 ||
    totalQuestions > 500
  ) {
    return res.status(400).json({
      error: "Invalid report data"
    });
  }

  const message =
    "📘 گزارش آموزشی SYNAPSE ACADEMY\n\n" +
    `👤 نام دانشجو: ${studentName.trim()}\n` +
    `📚 دوره: ${courseName.trim()}\n` +
    `🗓 جلسات گذرانده‌شده: ${completedClasses}\n` +
    `🎯 امتیاز: ${score} از 100\n` +
    `❓ تعداد سؤال‌ها: ${totalQuestions}\n\n` +
    "این گزارش از سامانه آموزشی دریافت شده است.";

  try {
    await sendTelegramMessage(message);

    return res.json({
      success: true,
      message: "Report sent"
    });
  } catch (error) {
    console.error("Report delivery failed:", error.message);

    return res.status(502).json({
      error: "Report delivery failed"
    });
  }
});

// پاسخ به درخواست‌های ناموجود
app.use((req, res) => {
  res.status(404).json({
    error: "Not found"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `SYNAPSE ACADEMY backend listening on port ${PORT}`
  );
});
