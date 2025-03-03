const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const sequelize = require('./models/index');
const User = require('./models/User');
const Team = require('./models/Team');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'yourSecretKey', // کلید مخفی مناسب را انتخاب کنید
    resave: false,
    saveUninitialized: false
}));

// سینک تمام مدل‌ها (در صورت عدم وجود جداول، ساخته می‌شوند)
sequelize.sync().then(() => console.log("Database & tables created!"));

// مسیر ریشه (هدایت به صفحه ثبت‌نام)
app.get('/', (req, res) => {
    res.redirect('/register');
});

// ------------- مسیرهای ثبت‌نام و ورود ------------- //

// صفحه ثبت‌نام (دانش‌آموز)
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// پردازش ثبت‌نام
app.post('/register', async (req, res) => {
    const { nationalId, firstName, lastName, mobile } = req.body;
    try {
        await User.create({
            nationalId,
            firstName,
            lastName,
            mobile,
            role: 'student',
            active: false
        });
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.send("خطا در ثبت‌نام.");
    }
});

// صفحه ورود (دانش‌آموز/داور)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// پردازش ورود برای دانش‌آموزان/داوران
app.post('/login', async (req, res) => {
    const { nationalId, mobile } = req.body;
    try {
        const user = await User.findOne({ where: { nationalId, mobile } });
        if(user){
            if(user.active){
                req.session.user = {
                    id: user.id,
                    role: user.role
                };
                if(user.role === 'student'){
                    res.redirect('/student');
                } else if(user.role === 'judge'){
                    res.redirect('/judge');
                } else {
                    res.send("نقش نامعتبر است.");
                }
            } else {
                res.send("حساب شما هنوز فعال نشده است.");
            }
        } else {
            res.send("اطلاعات ورود اشتباه است.");
        }
    } catch (err) {
        console.error(err);
        res.send("خطا در ورود.");
    }
});

// ------------- مسیرهای مربوط به پنل ادمین ------------- //

// صفحه ورود ادمین (دبیر)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'adminLogin.html'));
});

// پردازش ورود ادمین
app.post('/admin', (req, res) => {
    const { username, password } = req.body;
    if(username === 'admin' && password === 'Fardad1386'){
        req.session.admin = true;
        res.redirect('/admin/panel');
    } else {
        res.send("اطلاعات ورود ادمین اشتباه است.");
    }
});

// پنل ادمین: نمایش لیست کاربران
app.get('/admin/panel', async (req, res) => {
    if(!req.session.admin) {
        return res.redirect('/admin');
    }
    try {
        const users = await User.findAll();
        let userRows = '';
        users.forEach(user => {
            userRows += `<tr>
                <td>${user.id}</td>
                <td>${user.nationalId}</td>
                <td>${user.firstName}</td>
                <td>${user.lastName}</td>
                <td>${user.mobile}</td>
                <td>${user.role}</td>
                <td>${user.active}</td>
                <td>
                    <a href="/admin/edit/${user.id}">ویرایش</a> |
                    <form action="/admin/delete/${user.id}" method="POST" style="display:inline;">
                        <button type="submit" onclick="return confirm('آیا مطمئن هستید؟')">حذف</button>
                    </form>
                </td>
            </tr>`;
        });

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>پنل ادمین</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <h1>پنل ادمین</h1>
            <a href="/admin/team">مدیریت تیم‌ها</a>
            <table border="1" cellpadding="5" cellspacing="0">
                <tr>
                    <th>ID</th>
                    <th>کد ملی</th>
                    <th>نام</th>
                    <th>نام خانوادگی</th>
                    <th>شماره همراه</th>
                    <th>نقش</th>
                    <th>فعال</th>
                    <th>عملیات</th>
                </tr>
                ${userRows}
            </table>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.send("خطا در بارگذاری پنل ادمین.");
    }
});

// صفحه ویرایش کاربر (ادمین)
app.get('/admin/edit/:id', async (req, res) => {
    if(!req.session.admin) {
        return res.redirect('/admin');
    }
    try {
        const user = await User.findByPk(req.params.id);
        if(!user){
            return res.send("کاربر یافت نشد.");
        }
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>ویرایش کاربر</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <h1>ویرایش کاربر</h1>
            <form action="/admin/edit/${user.id}" method="POST">
                <label>کد ملی:</label>
                <input type="text" name="nationalId" value="${user.nationalId}" required /><br/>
                <label>نام:</label>
                <input type="text" name="firstName" value="${user.firstName}" required /><br/>
                <label>نام خانوادگی:</label>
                <input type="text" name="lastName" value="${user.lastName}" required /><br/>
                <label>شماره همراه:</label>
                <input type="text" name="mobile" value="${user.mobile}" required /><br/>
                <label>نقش:</label>
                <select name="role">
                    <option value="student" ${user.role === 'student' ? 'selected' : ''}>دانش‌آموز</option>
                    <option value="judge" ${user.role === 'judge' ? 'selected' : ''}>داور</option>
                </select><br/>
                <label>فعال:</label>
                <select name="active">
                    <option value="true" ${user.active ? 'selected' : ''}>True</option>
                    <option value="false" ${!user.active ? 'selected' : ''}>False</option>
                </select><br/>
                <button type="submit">به‌روزرسانی</button>
            </form>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.send("خطا در دریافت اطلاعات کاربر.");
    }
});

// پردازش ویرایش کاربر (ادمین)
app.post('/admin/edit/:id', async (req, res) => {
    if(!req.session.admin) {
        return res.redirect('/admin');
    }
    try {
        const { nationalId, firstName, lastName, mobile, role, active } = req.body;
        const user = await User.findByPk(req.params.id);
        if(!user){
            return res.send("کاربر یافت نشد.");
        }
        user.nationalId = nationalId;
        user.firstName = firstName;
        user.lastName = lastName;
        user.mobile = mobile;
        user.role = role;
        user.active = active === 'true';
        await user.save();
        res.redirect('/admin/panel');
    } catch (err) {
        console.error(err);
        res.send("خطا در به‌روزرسانی کاربر.");
    }
});

// حذف کاربر (ادمین)
app.post('/admin/delete/:id', async (req, res) => {
    if(!req.session.admin) {
        return res.redirect('/admin');
    }
    try {
        await User.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/panel');
    } catch (err) {
        console.error(err);
        res.send("خطا در حذف کاربر.");
    }
});

// ------------- مسیرهای مربوط به پنل‌های کاربری ------------- //

// پنل دانش‌آموز
app.get('/student', (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'views', 'studentPanel.html'));
});

// پنل داور
app.get('/judge', (req, res) => {
    if(!req.session.user || req.session.user.role !== 'judge'){
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'views', 'judgePanel.html'));
});


// ------------- مسیرهای مربوط به تیم‌ها (بخش دانش‌آموز) ------------- //

// نمایش صفحه مدیریت تیم
app.get('/team', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const user = await User.findByPk(req.session.user.id);
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>مدیریت تیم</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <h1>مدیریت تیم</h1>
        `;
        if(user.teamId){
            const team = await Team.findByPk(user.teamId);
            const members = await User.findAll({ where: { teamId: team.id } });
            html += `<h2>اطلاعات تیم</h2>
            <p>نام تیم: ${team.teamName}</p>
            <p>کد تیم: ${team.teamCode}</p>
            <p>امتیاز: ${team.score}</p>
            <h3>اعضا:</h3>
            <ul>`;
            members.forEach(member => {
                html += `<li>${member.firstName} ${member.lastName} ${team.leaderId === member.id ? '(سرگروه)' : ''}</li>`;
            });
            html += `</ul>`;
            if(team.leaderId === user.id){
                html += `<form action="/team/delete" method="POST">
                    <button type="submit" onclick="return confirm('آیا مطمئن هستید؟ حذف تیم تمامی اعضا را از تیم خارج می‌کند.')">حذف تیم</button>
                </form>`;
            } else {
                html += `<a href="/team/leave" onclick="return confirm('آیا مطمئن هستید که می‌خواهید از تیم خارج شوید؟')"><button>خروج از تیم</button></a>`;
            }
        } else {
            html += `<p>شما عضو هیچ تیمی نیستید.</p>
            <a href="/team/create"><button>ایجاد تیم</button></a>
            <a href="/team/join"><button>ملحق شدن به تیم</button></a>`;
        }
        html += `<br/><a href="/student">بازگشت به پنل دانش‌آموز</a>`;
        html += `</body></html>`;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در نمایش اطلاعات تیم.");
    }
});

// فرم ایجاد تیم
app.get('/team/create', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    const user = await User.findByPk(req.session.user.id);
    if(user.teamId){
        return res.send("شما قبلاً عضو یک تیم هستید. برای ایجاد تیم جدید ابتدا از تیم فعلی خارج شوید.");
    }
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>ایجاد تیم</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <h1>ایجاد تیم</h1>
        <form action="/team/create" method="POST">
            <label>نام تیم:</label>
            <input type="text" name="teamName" required /><br/>
            <button type="submit">ایجاد تیم</button>
        </form>
        <a href="/team">بازگشت</a>
    </body>
    </html>
    `;
    res.send(html);
});

// پردازش ایجاد تیم
app.post('/team/create', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const user = await User.findByPk(req.session.user.id);
        if(user.teamId){
            return res.send("شما قبلاً عضو یک تیم هستید.");
        }
        const { teamName } = req.body;
        let teamCode;
        let exists = true;
        while(exists) {
            teamCode = Math.floor(10000000 + Math.random() * 90000000).toString();
            const teamExist = await Team.findOne({ where: { teamCode } });
            if(!teamExist) {
                exists = false;
            }
        }
        const newTeam = await Team.create({
            teamName,
            teamCode,
            leaderId: user.id
        });
        user.teamId = newTeam.id;
        await user.save();
        res.redirect('/team');
    } catch(err) {
        console.error(err);
        res.send("خطا در ایجاد تیم.");
    }
});

// فرم ملحق شدن به تیم
app.get('/team/join', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    const user = await User.findByPk(req.session.user.id);
    if(user.teamId){
        return res.send("شما قبلاً عضو یک تیم هستید.");
    }
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>ملحق شدن به تیم</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <h1>ملحق شدن به تیم</h1>
        <form action="/team/join" method="POST">
            <label>کد تیم (8 رقمی):</label>
            <input type="text" name="teamCode" required /><br/>
            <button type="submit">ملحق شدن</button>
        </form>
        <a href="/team">بازگشت</a>
    </body>
    </html>
    `;
    res.send(html);
});

// پردازش ملحق شدن به تیم
app.post('/team/join', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const user = await User.findByPk(req.session.user.id);
        if(user.teamId){
            return res.send("شما قبلاً عضو یک تیم هستید.");
        }
        const { teamCode } = req.body;
        const team = await Team.findOne({ where: { teamCode } });
        if(!team){
            return res.send("تیمی با این کد یافت نشد.");
        }
        const members = await User.findAll({ where: { teamId: team.id } });
        if(members.length >= 3){
            return res.send("تیم پر است.");
        }
        user.teamId = team.id;
        await user.save();
        res.redirect('/team');
    } catch(err) {
        console.error(err);
        res.send("خطا در ملحق شدن به تیم.");
    }
});

// خروج از تیم (برای اعضای عادی)
app.get('/team/leave', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const user = await User.findByPk(req.session.user.id);
        if(!user.teamId){
            return res.send("شما عضو هیچ تیمی نیستید.");
        }
        const team = await Team.findByPk(user.teamId);
        if(team.leaderId === user.id){
            return res.send("سرگروه نمی‌تواند از تیم خارج شود. برای حذف تیم از گزینه حذف استفاده کنید.");
        }
        user.teamId = null;
        await user.save();
        res.redirect('/team');
    } catch(err) {
        console.error(err);
        res.send("خطا در خروج از تیم.");
    }
});

// حذف تیم (برای سرگروه)
app.post('/team/delete', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const user = await User.findByPk(req.session.user.id);
        if(!user.teamId){
            return res.send("شما عضو هیچ تیمی نیستید.");
        }
        const team = await Team.findByPk(user.teamId);
        if(team.leaderId !== user.id){
            return res.send("فقط سرگروه می‌تواند تیم را حذف کند.");
        }
        await User.update({ teamId: null }, { where: { teamId: team.id } });
        await Team.destroy({ where: { id: team.id } });
        res.redirect('/team');
    } catch(err) {
        console.error(err);
        res.send("خطا در حذف تیم.");
    }
});

// ------------- مسیرهای مدیریت تیم‌ها در پنل ادمین ------------- //

app.get('/admin/team', async (req, res) => {
    if(!req.session.admin){
        return res.redirect('/admin');
    }
    try {
        const teams = await Team.findAll();
        let teamRows = '';
        for(let team of teams) {
            const leader = await User.findByPk(team.leaderId);
            const members = await User.findAll({ where: { teamId: team.id } });
            teamRows += `<tr>
                <td>${team.id}</td>
                <td>${team.teamName}</td>
                <td>${team.teamCode}</td>
                <td>${leader ? leader.firstName + ' ' + leader.lastName : 'N/A'}</td>
                <td>${members.length}</td>
                <td>${team.score}</td>
                <td>
                    <a href="/admin/team/edit/${team.id}">ویرایش</a> |
                    <form action="/admin/team/delete/${team.id}" method="POST" style="display:inline;">
                        <button type="submit" onclick="return confirm('آیا مطمئن هستید؟')">حذف</button>
                    </form>
                </td>
            </tr>`;
        }
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>مدیریت تیم‌ها</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <h1>پنل مدیریت تیم‌ها</h1>
            <table border="1" cellpadding="5" cellspacing="0">
                <tr>
                    <th>ID</th>
                    <th>نام تیم</th>
                    <th>کد تیم</th>
                    <th>سرگروه</th>
                    <th>تعداد اعضا</th>
                    <th>امتیاز</th>
                    <th>عملیات</th>
                </tr>
                ${teamRows}
            </table>
            <a href="/admin/panel">بازگشت به پنل ادمین</a>
        </body>
        </html>
        `;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در نمایش تیم‌ها.");
    }
});

// فرم ویرایش تیم (ادمین)
app.get('/admin/team/edit/:id', async (req, res) => {
    if(!req.session.admin){
        return res.redirect('/admin');
    }
    try {
        const team = await Team.findByPk(req.params.id);
        if(!team){
            return res.send("تیم یافت نشد.");
        }
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>ویرایش تیم</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <h1>ویرایش تیم</h1>
            <form action="/admin/team/edit/${team.id}" method="POST">
                <label>نام تیم:</label>
                <input type="text" name="teamName" value="${team.teamName}" required /><br/>
                <label>کد تیم:</label>
                <input type="text" name="teamCode" value="${team.teamCode}" required /><br/>
                <label>سرگروه (آی‌دی کاربر):</label>
                <input type="text" name="leaderId" value="${team.leaderId}" required /><br/>
                <label>امتیاز:</label>
                <input type="number" name="score" value="${team.score}" required /><br/>
                <button type="submit">به‌روزرسانی تیم</button>
            </form>
            <a href="/admin/team">بازگشت</a>
        </body>
        </html>
        `;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در دریافت اطلاعات تیم.");
    }
});

// پردازش ویرایش تیم (ادمین)
app.post('/admin/team/edit/:id', async (req, res) => {
    if(!req.session.admin){
        return res.redirect('/admin');
    }
    try {
        const { teamName, teamCode, leaderId, score } = req.body;
        const team = await Team.findByPk(req.params.id);
        if(!team){
            return res.send("تیم یافت نشد.");
        }
        team.teamName = teamName;
        team.teamCode = teamCode;
        team.leaderId = leaderId;
        team.score = score;
        await team.save();
        res.redirect('/admin/team');
    } catch(err) {
        console.error(err);
        res.send("خطا در به‌روزرسانی تیم.");
    }
});

// حذف تیم توسط ادمین
app.post('/admin/team/delete/:id', async (req, res) => {
    if(!req.session.admin){
        return res.redirect('/admin');
    }
    try {
        const team = await Team.findByPk(req.params.id);
        if(!team){
            return res.send("تیم یافت نشد.");
        }
        await User.update({ teamId: null }, { where: { teamId: team.id } });
        await Team.destroy({ where: { id: team.id } });
        res.redirect('/admin/team');
    } catch(err) {
        console.error(err);
        res.send("خطا در حذف تیم.");
    }
});

// شروع سرور
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
