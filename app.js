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
// اگر کاربر قبلاً لاگین کرده باشد، مستقیماً به پنل هدایت می‌شود.
app.get('/login', (req, res) => {
    if(req.session.user){
        if(req.session.user.role === 'student'){
            return res.redirect('/student');
        } else if(req.session.user.role === 'judge'){
            return res.redirect('/judge');
        }
    }
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

// مسیر خروج (Logout)
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ------------- مسیرهای مربوط به پنل ادمین ------------- //

// صفحه ورود ادمین (دبیر)
app.get('/admin', (req, res) => {
    if(req.session.admin) {
        return res.redirect('/admin/panel');
    }
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
                    <a href="/admin/edit/${user.id}" target="_blank">ویرایش</a> |
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
            <a href="/admin/team" target="_blank"><button>مدیریت تیم‌ها</button></a>
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

// مسیرهای مدیریت تیم‌ها در پنل ادمین
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
                    <a href="/admin/team/edit/${team.id}" target="_blank">ویرایش</a> |
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
            <a href="/admin/panel"><button>بازگشت به پنل ادمین</button></a>
        </body>
        </html>
        `;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در نمایش تیم‌ها.");
    }
});

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
            <a href="/admin/team"><button>بازگشت</button></a>
        </body>
        </html>
        `;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در دریافت اطلاعات تیم.");
    }
});

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

// ------------- مسیرهای مربوط به پنل‌های کاربری ------------- //

// پنل داور (بدون تغییر)
app.get('/judge', (req, res) => {
    if(!req.session.user || req.session.user.role !== 'judge'){
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'views', 'judgePanel.html'));
});

// پنل دانش‌آموز (داینامیک با سه کادر: اطلاعات کاربری، اطلاعات تیم و کیف پول)
app.get('/student', async (req, res) => {
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
            <title>پنل دانش‌آموز</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <div class="logout"><a href="/logout"><button>خروج</button></a></div>
            <h1>پنل دانش‌آموز</h1>
            <div class="panel-container">
        `;
        // کادر اطلاعات کاربری
        html += `<div class="box user-info">
                    <h2>اطلاعات کاربری</h2>
                    <p>نام: ${user.firstName} ${user.lastName}</p>
                    <p>کد ملی: ${user.nationalId}</p>
                    <p>شماره همراه: ${user.mobile}</p>
                    <button onclick="openModal('/student/updateMobile')">تغییر شماره همراه</button>
                 </div>`;
        // کادر اطلاعات تیم
        if (user.teamId) {
            const team = await Team.findByPk(user.teamId);
            const members = await User.findAll({ where: { teamId: team.id } });
            let memberList = "";
            members.forEach(member => {
                memberList += `<li>${member.firstName} ${member.lastName} ${team.leaderId === member.id ? '(سرگروه)' : ''}</li>`;
            });
            html += `<div class="box team-info">
                        <h2>اطلاعات تیم</h2>
                        <p>نام تیم: ${team.teamName}</p>
                        <p>کد تیم (8 رقمی): ${team.teamCode}</p>
                        <ul>اعضا:
                           ${memberList}
                        </ul>
                        <button onclick="openModal('/team')">مدیریت تیم</button>
                     </div>`;
            // کادر کیف پول (امتیازات)
            let availableTransfer = 0;
            if (team.score > 100) {
                availableTransfer = Math.min(Math.floor(team.score * 0.3), team.score - 100);
            }
            html += `<div class="box wallet-info">
                        <h2>کیف پول</h2>
                        <p>کد انتقال (4 رقمی): ${team.walletCode}</p>
                        <p>امتیاز کل: ${team.score}</p>
                        <p>امتیاز قابل برداشت: ${availableTransfer}</p>`;
            if (team.leaderId === user.id) {
                html += `<form action="/student/wallet/transfer" method="POST">
                            <label>کد انتقال گروه مقصد (4 رقمی):</label>
                            <input type="text" name="destWalletCode" required /><br/>
                            <label>مبلغ انتقال:</label>
                            <input type="number" name="amount" required /><br/>
                            <button type="submit">انتقال امتیاز</button>
                         </form>`;
            }
            html += `</div>`;
        } else {
            html += `<div class="box team-info">
                        <h2>اطلاعات تیم</h2>
                        <p>شما عضو هیچ تیمی نیستید.</p>
                        <button onclick="openModal('/team')">مدیریت تیم</button>
                     </div>`;
        }
        html += `</div>
            <!-- Modal Overlay -->
            <div id="modal-overlay" class="modal-overlay">
              <div id="modal-content" class="modal-content">
                <button class="modal-close" onclick="closeModal()">X</button>
              </div>
            </div>
            <script src="/js/modal.js"></script>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.send("خطا در بارگذاری پنل دانش‌آموز.");
    }
});

// مسیر تغییر شماره همراه دانش‌آموز
app.get('/student/updateMobile', async (req, res) => {
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
            <title>تغییر شماره همراه</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <h1>تغییر شماره همراه</h1>
            <form action="/student/updateMobile" method="POST">
                <label>شماره همراه جدید:</label>
                <input type="text" name="mobile" value="${user.mobile}" required /><br/>
                <button type="submit">بروزرسانی</button>
            </form>
            <button onclick="closeModal()">بستن</button>
        </body>
        </html>
        `;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در دریافت اطلاعات.");
    }
});

app.post('/student/updateMobile', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const { mobile } = req.body;
        const user = await User.findByPk(req.session.user.id);
        user.mobile = mobile;
        await user.save();
        res.redirect('/student');
    } catch(err) {
        console.error(err);
        res.send("خطا در بروزرسانی شماره همراه.");
    }
});

// ------------- مسیرهای مربوط به تیم‌ها ------------- //

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
                html += `<button onclick="if(confirm('آیا مطمئن هستید که می‌خواهید از تیم خارج شوید؟')) { window.location.href='/team/leave' }">خروج از تیم</button>`;
            }
        } else {
            html += `<p>شما عضو هیچ تیمی نیستید.</p>
            <button onclick="window.location.href='/team/create'">ایجاد تیم</button>
            <button onclick="window.location.href='/team/join'">ملحق شدن به تیم</button>`;
        }
        html += `<br/><button onclick="closeModal()">بستن</button>`;
        html += `</body></html>`;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در نمایش اطلاعات تیم.");
    }
});

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
        <button onclick="closeModal()">بستن</button>
    </body>
    </html>
    `;
    res.send(html);
});

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
        // تولید کد walletCode 4 رقمی
        let walletCode;
        exists = true;
        while(exists) {
            walletCode = Math.floor(1000 + Math.random() * 9000).toString();
            const codeExist = await Team.findOne({ where: { walletCode } });
            if(!codeExist) {
                exists = false;
            }
        }
        const newTeam = await Team.create({
            teamName,
            teamCode,
            walletCode,
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
        <button onclick="closeModal()">بستن</button>
    </body>
    </html>
    `;
    res.send(html);
});

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

// ------------- مسیرهای مربوط به انتقال امتیاز (کیف پول) ------------- //

// مرحله اول: دریافت اطلاعات انتقال و نمایش صفحه تایید
app.post('/student/wallet/transfer', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const user = await User.findByPk(req.session.user.id);
        if(!user.teamId) {
            return res.send("شما عضو هیچ تیمی نیستید.");
        }
        const team = await Team.findByPk(user.teamId);
        if(team.leaderId !== user.id) {
            return res.send("فقط سرگروه می‌تواند امتیاز انتقال دهد.");
        }
        const { destWalletCode, amount } = req.body;
        const transferAmount = parseInt(amount);
        if(transferAmount <= 0) {
            return res.send("مبلغ انتقال نامعتبر است.");
        }
        let availableTransfer = 0;
        if (team.score > 100) {
            availableTransfer = Math.min(Math.floor(team.score * 0.3), team.score - 100);
        }
        if(transferAmount > availableTransfer) {
            return res.send("مبلغ انتقال بیشتر از حد مجاز است.");
        }
        // پیدا کردن تیم مقصد از روی walletCode
        const destTeam = await Team.findOne({ where: { walletCode: destWalletCode } });
        if(!destTeam) {
            return res.send("تیم مقصد یافت نشد.");
        }
        if(destTeam.id === team.id) {
            return res.send("تیم مقصد نمی‌تواند تیم خودتان باشد.");
        }
        // نمایش صفحه تایید انتقال
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>تایید انتقال امتیاز</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <h1>تایید انتقال امتیاز</h1>
            <p>نام تیم مقصد: ${destTeam.teamName}</p>
            <p>مبلغ انتقال: ${transferAmount}</p>
            <form action="/student/wallet/transfer/confirm" method="POST">
                <input type="hidden" name="destTeamId" value="${destTeam.id}" />
                <input type="hidden" name="amount" value="${transferAmount}" />
                <button type="submit">بله، تایید می‌کنم</button>
            </form>
            <button onclick="closeModal()">خیر، انصراف</button>
        </body>
        </html>
        `;
        res.send(html);
    } catch(err) {
        console.error(err);
        res.send("خطا در انتقال امتیاز.");
    }
});

// مرحله دوم: تایید نهایی و انتقال امتیاز
app.post('/student/wallet/transfer/confirm', async (req, res) => {
    if(!req.session.user || req.session.user.role !== 'student'){
        return res.redirect('/login');
    }
    try {
        const user = await User.findByPk(req.session.user.id);
        if(!user.teamId) {
            return res.send("شما عضو هیچ تیمی نیستید.");
        }
        const team = await Team.findByPk(user.teamId);
        if(team.leaderId !== user.id) {
            return res.send("فقط سرگروه می‌تواند امتیاز انتقال دهد.");
        }
        const { destTeamId, amount } = req.body;
        const transferAmount = parseInt(amount);
        let availableTransfer = 0;
        if (team.score > 100) {
            availableTransfer = Math.min(Math.floor(team.score * 0.3), team.score - 100);
        }
        if(transferAmount > availableTransfer) {
            return res.send("مبلغ انتقال بیشتر از حد مجاز است.");
        }
        const destTeam = await Team.findByPk(destTeamId);
        if(!destTeam) {
            return res.send("تیم مقصد یافت نشد.");
        }
        if(destTeam.id === team.id) {
            return res.send("تیم مقصد نمی‌تواند تیم خودتان باشد.");
        }
        // انجام انتقال: کسر از تیم مبدا و اضافه کردن به تیم مقصد
        team.score -= transferAmount;
        destTeam.score += transferAmount;
        await team.save();
        await destTeam.save();
        res.redirect('/student');
    } catch(err) {
        console.error(err);
        res.send("خطا در تایید انتقال امتیاز.");
    }
});

// شروع سرور
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
