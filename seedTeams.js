const sequelize = require('./models/index');
const Team = require('./models/Team');

(async () => {
  try {
    // اطمینان از همگام‌سازی جداول
    await sequelize.sync();
    // ایجاد 100 تیم
    for (let i = 1; i <= 100; i++) {
      // تولید کد تیم 8 رقمی و کد کیف پول 4 رقمی به صورت تصادفی
      const teamCode = Math.floor(10000000 + Math.random() * 90000000).toString();
      const walletCode = Math.floor(1000 + Math.random() * 9000).toString();
      // امتیاز تصادفی بین 0 تا 5000
      const score = Math.floor(Math.random() * 5000);
      // فرض می‌کنیم leaderId = 1 (یا مقدار دلخواه)
      await Team.create({
        teamName: String(i),
        teamCode,
        walletCode,
        leaderId: 1,
        score,
      });
      console.log(`Created team ${i} with score ${score}`);
    }
    console.log("Seed complete.");
    process.exit();
  } catch (err) {
    console.error("Error seeding teams:", err);
    process.exit(1);
  }
})();
