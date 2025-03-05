const Team = require('./models/Team');

// تابع کمکی برای تولید عدد صحیح تصادفی بین min و max (شامل هر دو)
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

setInterval(async () => {
  try {
    // ایجاد آرایه ای از 1 تا 100
    const teamIds = Array.from({ length: 100 }, (_, i) => i + 1);
    // مخلوط کردن آرایه به صورت تصادفی
    teamIds.sort(() => Math.random() - 0.5);
    // انتخاب ۳ تیم تصادفی
    const selected = teamIds.slice(0, 3);
    for (const id of selected) {
      // تولید تغییر امتیاز تصادفی بین -50 و 50
      const change = getRandomIntInclusive(-1000, 1000);
      const team = await Team.findByPk(id);
      if (team) {
        team.score += change;
        await team.save();
        console.log(`Team ${id} score updated by ${change}, new score: ${team.score}`);
      } else {
        console.log(`Team with id ${id} not found`);
      }
    }
  } catch (error) {
    console.error("Error updating scores:", error);
  }
}, 50);
