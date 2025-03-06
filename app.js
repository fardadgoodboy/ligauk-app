// Import required modules and models
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const sequelize = require('./models/index');
const User = require('./models/User');
const Team = require('./models/Team');
const Transaction = require('./models/Transaction'); // Model for logging transactions

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'yourSecretKey', // Choose a proper secret key
    resave: false,
    saveUninitialized: true
}));

// Sync database models
sequelize.sync().then(() => console.log("Database & tables created!"));

// --------------------------
// Public Routes (ثبت‌نام، ورود)
// --------------------------

// Redirect root to registration page
app.get('/', (req, res) => {
    res.redirect('/register');
});

// Serve registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Handle registration
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
        res.redirect('/error?message=' + encodeURIComponent("خطا در ثبت‌نام.") + "&back=/register");
    }
});

// Serve login page
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'student' ? '/student' : '/judge');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Handle login
app.post('/login', async (req, res) => {
    const { nationalId, mobile } = req.body;
    try {
        const user = await User.findOne({ where: { nationalId, mobile } });
        if (user) {
            if (user.active) {
                req.session.user = { id: user.id, role: user.role };
                res.redirect(user.role === 'student' ? '/student' : '/judge');
            } else {
                res.redirect('/error?message=' + encodeURIComponent("حساب شما هنوز فعال نشده است.") + "&back=/login");
            }
        } else {
            res.redirect('/error?message=' + encodeURIComponent("اطلاعات ورود اشتباه است.") + "&back=/login");
        }
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در ورود.") + "&back=/login");
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --------------------------
// Admin Routes (پنل ادمین)
// --------------------------

// Serve admin login page
app.get('/admin', (req, res) => {
    if (req.session.admin) return res.redirect('/admin/panel');
    res.sendFile(path.join(__dirname, 'views', 'adminLogin.html'));
});

// Handle admin login
app.post('/admin', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'adminpass') {
        req.session.admin = true;
        res.redirect('/admin/panel');
    } else {
        res.redirect('/error?message=' + encodeURIComponent("اطلاعات ورود ادمین اشتباه است.") + "&back=/admin");
    }
});

// Admin Panel - Users (جدول کاربران با جستجوی ستونی و به‌روزرسانی خودکار)
app.get('/admin/panel', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>پنل ادمین - کاربران</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <div class="admin-menu">
            <button onclick="window.location.href='/admin/team'">گروه‌ها</button>
            <button onclick="window.location.href='/admin/transactions'">تراکنش‌ها</button>
        </div>
        <table id="usersTable" border="1" cellpadding="5" cellspacing="0">
          <thead>
            <tr>
                <th>ID<br><input type="text" onkeyup="filterTable('usersTable', 0)" placeholder="جستجو"></th>
                <th>کد ملی<br><input type="text" onkeyup="filterTable('usersTable', 1)" placeholder="جستجو"></th>
                <th>نام<br><input type="text" onkeyup="filterTable('usersTable', 2)" placeholder="جستجو"></th>
                <th>نام خانوادگی<br><input type="text" onkeyup="filterTable('usersTable', 3)" placeholder="جستجو"></th>
                <th>شماره همراه<br><input type="text" onkeyup="filterTable('usersTable', 4)" placeholder="جستجو"></th>
                <th>نقش<br><input type="text" onkeyup="filterTable('usersTable', 5)" placeholder="جستجو"></th>
                <th>فعال<br><input type="text" onkeyup="filterTable('usersTable', 6)" placeholder="جستجو"></th>
                <th>عملیات</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <script>
        // Fetch user data and update table every 3 seconds
        async function fetchUsers() {
          const response = await fetch('/admin/users/json');
          const users = await response.json();
          const tbody = document.querySelector('#usersTable tbody');
          tbody.innerHTML = '';
          users.forEach(user => {
            const activeText = user.active 
              ? '<span class="active-true">True</span>' 
              : '<span class="active-false">False</span>';
            const roleText = user.role === 'judge' 
              ? '<span class="role-judge">judge</span>' 
              : user.role;
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td>\${user.id}</td>
              <td>\${user.nationalId}</td>
              <td>\${user.firstName}</td>
              <td>\${user.lastName}</td>
              <td>\${user.mobile}</td>
              <td>\${roleText}</td>
              <td>\${activeText}</td>
              <td>
                  <a href="/admin/edit/\${user.id}" target="_blank" class="op-edit">edit</a> |
                  <form action="/admin/delete/\${user.id}" method="POST" style="display:inline;">
                      <button type="submit" class="op-delete">delete</button>
                  </form>
              </td>
            \`;
            tbody.appendChild(tr);
          });
        }
        // Filter table rows by column value
        function filterTable(tableId, colIndex) {
          const input = document.querySelector(\`#\${tableId} thead tr th:nth-child(\${colIndex+1}) input\`);
          const filter = input.value.toUpperCase();
          const table = document.getElementById(tableId);
          const tr = table.getElementsByTagName("tr");
          for (let i = 1; i < tr.length; i++) {
            const td = tr[i].getElementsByTagName("td")[colIndex];
            if (td) {
              const txtValue = td.textContent || td.innerText;
              tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
            }
          }
        }
        fetchUsers();
        setInterval(fetchUsers, 10000);
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

// Endpoint for admin users JSON data
app.get('/admin/users/json', async (req, res) => {
    try {
        const users = await User.findAll();
        const data = users.map(user => ({
          id: user.id,
          nationalId: user.nationalId,
          firstName: user.firstName,
          lastName: user.lastName,
          mobile: user.mobile,
          role: user.role,
          active: user.active
        }));
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Serve admin user edit page (modal)
app.get('/admin/edit/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.send("کاربر یافت نشد.");
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ویرایش کاربر</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <div class="modal-content">
                <h1>ویرایش کاربر</h1>
                <form action="/admin/edit/${user.id}" method="POST">
                    <label>کد ملی:</label>
                    <input type="text" name="nationalId" value="${user.nationalId}" required><br>
                    <label>نام:</label>
                    <input type="text" name="firstName" value="${user.firstName}" required><br>
                    <label>نام خانوادگی:</label>
                    <input type="text" name="lastName" value="${user.lastName}" required><br>
                    <label>شماره همراه:</label>
                    <input type="text" name="mobile" value="${user.mobile}" required><br>
                    <label>نقش:</label>
                    <select name="role">
                        <option value="student" ${user.role === 'student' ? 'selected' : ''}>دانش‌آموز</option>
                        <option value="judge" ${user.role === 'judge' ? 'selected' : ''}>داور</option>
                    </select><br>
                    <label>فعال:</label>
                    <select name="active">
                        <option value="true" ${user.active ? 'selected' : ''}>True</option>
                        <option value="false" ${!user.active ? 'selected' : ''}>False</option>
                    </select><br>
                    <button type="submit">ثبت</button>
                </form>
                <button onclick="window.location.href='/admin/panel'">بازگشت</button>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در دریافت اطلاعات کاربر.") + "&back=/admin/panel");
    }
});

// Handle admin user edit submission
app.post('/admin/edit/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    try {
        const { nationalId, firstName, lastName, mobile, role, active } = req.body;
        const user = await User.findByPk(req.params.id);
        if (!user) return res.redirect('/error?message=' + encodeURIComponent("کاربر یافت نشد.") + "&back=/admin/panel");
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
        res.redirect('/error?message=' + encodeURIComponent("خطا در به‌روزرسانی کاربر.") + "&back=/admin/panel");
    }
});

// Handle admin user deletion
app.post('/admin/delete/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    try {
        await User.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/panel');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در حذف کاربر.") + "&back=/admin/panel");
    }
});

// Admin Panel - Teams (جدول گروه‌ها با جستجوی ستونی)
app.get('/admin/team', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>پنل ادمین - گروه‌ها</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <div class="admin-menu">
            <button onclick="window.location.href='/admin/panel'">کاربران</button>
            <button onclick="window.location.href='/admin/transactions'">تراکنش‌ها</button>
        </div>
        <table id="teamsTable" border="1" cellpadding="5" cellspacing="0">
          <thead>
            <tr>
                <th>ID<br><input type="text" onkeyup="filterTable('teamsTable', 0)" placeholder="جستجو"></th>
                <th>نام گروه<br><input type="text" onkeyup="filterTable('teamsTable', 1)" placeholder="جستجو"></th>
                <th>کد گروه<br><input type="text" onkeyup="filterTable('teamsTable', 2)" placeholder="جستجو"></th>
                <th>سرگروه<br><input type="text" onkeyup="filterTable('teamsTable', 3)" placeholder="جستجو"></th>
                <th>تعداد اعضا<br><input type="text" onkeyup="filterTable('teamsTable', 4)" placeholder="جستجو"></th>
                <th>امتیاز<br><input type="text" onkeyup="filterTable('teamsTable', 5)" placeholder="جستجو"></th>
                <th>عملیات</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <script>
        // Fetch teams data and update table every 3 seconds
        async function fetchTeams() {
          const response = await fetch('/admin/teams/json');
          const teams = await response.json();
          const tbody = document.querySelector('#teamsTable tbody');
          tbody.innerHTML = '';
          teams.forEach(team => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td>\${team.id}</td>
              <td>\${team.teamName}</td>
              <td>\${team.teamCode}</td>
              <td>\${team.leaderId || '-'}</td>
              <td>\${team.memberCount || '-'}</td>
              <td>\${team.score}</td>
              <td>
                  <a href="/admin/team/edit/\${team.id}" target="_blank" class="op-edit">edit</a> |
                  <form action="/admin/team/delete/\${team.id}" method="POST" style="display:inline;">
                      <button type="submit" class="op-delete">delete</button>
                  </form>
              </td>
            \`;
            tbody.appendChild(tr);
          });
        }
        // Filter table rows by column value
        function filterTable(tableId, colIndex) {
          const input = document.querySelector(\`#\${tableId} thead tr th:nth-child(\${colIndex+1}) input\`);
          const filter = input.value.toUpperCase();
          const table = document.getElementById(tableId);
          const tr = table.getElementsByTagName("tr");
          for (let i = 1; i < tr.length; i++) {
            const td = tr[i].getElementsByTagName("td")[colIndex];
            if (td) {
              const txtValue = td.textContent || td.innerText;
              tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
            }
          }
        }
        fetchTeams();
        setInterval(fetchTeams, 10000);
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

// Endpoint for admin teams JSON data
app.get('/admin/teams/json', async (req, res) => {
    try {
        const teams = await Team.findAll();
        const data = await Promise.all(teams.map(async team => {
          const members = await User.findAll({ where: { teamId: team.id } });
          return {
            id: team.id,
            teamName: team.teamName,
            teamCode: team.teamCode,
            leaderId: team.leaderId,
            memberCount: members.length,
            score: team.score
          };
        }));
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Serve admin team edit page
app.get('/admin/team/edit/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    try {
        const team = await Team.findByPk(req.params.id);
        if (!team) return res.send("گروه یافت نشد.");
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ویرایش گروه</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <div class="modal-content">
                <h1>ویرایش گروه</h1>
                <form action="/admin/team/edit/${team.id}" method="POST">
                    <label>نام گروه:</label>
                    <input type="text" name="teamName" value="${team.teamName}" required><br>
                    <label>کد گروه:</label>
                    <input type="text" name="teamCode" value="${team.teamCode}" required><br>
                    <label>سرگروه (آی‌دی کاربر):</label>
                    <input type="text" name="leaderId" value="${team.leaderId}" required><br>
                    <label>امتیاز:</label>
                    <input type="number" name="score" value="${team.score}" required><br>
                    <button type="submit">به‌روزرسانی گروه</button>
                </form>
                <button onclick="window.location.href='/admin/team'">بازگشت</button>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در دریافت اطلاعات گروه.") + "&back=/admin/team");
    }
});

// Handle admin team edit submission
app.post('/admin/team/edit/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    try {
        const { teamName, teamCode, leaderId, score } = req.body;
        const team = await Team.findByPk(req.params.id);
        if (!team) return res.redirect('/error?message=' + encodeURIComponent("گروه یافت نشد.") + "&back=/admin/team");
        team.teamName = teamName;
        team.teamCode = teamCode;
        team.leaderId = leaderId;
        team.score = score;
        await team.save();
        res.redirect('/admin/team');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در به‌روزرسانی گروه.") + "&back=/admin/team");
    }
});

// Handle admin team deletion
app.post('/admin/team/delete/:id', async (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    try {
        const team = await Team.findByPk(req.params.id);
        if (!team) return res.redirect('/error?message=' + encodeURIComponent("گروه یافت نشد.") + "&back=/admin/team");
        await User.update({ teamId: null }, { where: { teamId: team.id } });
        await Team.destroy({ where: { id: team.id } });
        res.redirect('/admin/team');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در حذف گروه.") + "&back=/admin/team");
    }
});

// Admin Panel - Transactions (جدول تراکنش‌ها با جستجوی ستونی)
app.get('/admin/transactions', (req, res) => {
    if (!req.session.admin) return res.redirect('/admin');
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>پنل ادمین - تراکنش‌ها</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <div class="admin-menu">
            <button onclick="window.location.href='/admin/panel'">کاربران</button>
            <button onclick="window.location.href='/admin/team'">گروه‌ها</button>
        </div>
        <table id="transactionsTable" border="1" cellpadding="5" cellspacing="0">
          <thead>
            <tr>
                <th>ID<br><input type="text" onkeyup="filterTable('transactionsTable', 0)" placeholder="جستجو"></th>
                <th>نوع<br><input type="text" onkeyup="filterTable('transactionsTable', 1)" placeholder="جستجو"></th>
                <th>توضیحات<br><input type="text" onkeyup="filterTable('transactionsTable', 2)" placeholder="جستجو"></th>
                <th>آیدی کاربر<br><input type="text" onkeyup="filterTable('transactionsTable', 3)" placeholder="جستجو"></th>
                <th>آیدی گروه<br><input type="text" onkeyup="filterTable('transactionsTable', 4)" placeholder="جستجو"></th>
                <th>زمان<br><input type="text" onkeyup="filterTable('transactionsTable', 5)" placeholder="جستجو"></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <script>
        // Helper function to assign CSS class based on transaction type
        function getTxClass(type) {
            return 'tx-' + type;
        }
        // Fetch transaction data and update table every 3 seconds
        async function fetchTransactions() {
          const response = await fetch('/admin/transactions/json');
          const transactions = await response.json();
          const tbody = document.querySelector('#transactionsTable tbody');
          tbody.innerHTML = '';
          transactions.forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td>\${tx.id}</td>
              <td><span class="\${getTxClass(tx.type)}">\${tx.type}</span></td>
              <td>\${tx.description}</td>
              <td>\${tx.userId || '-'}</td>
              <td>\${tx.teamId || '-'}</td>
              <td>\${tx.createdAt}</td>
            \`;
            tbody.appendChild(tr);
          });
        }
        // Filter table rows by column value
        function filterTable(tableId, colIndex) {
          const input = document.querySelector(\`#\${tableId} thead tr th:nth-child(\${colIndex+1}) input\`);
          const filter = input.value.toUpperCase();
          const table = document.getElementById(tableId);
          const tr = table.getElementsByTagName("tr");
          for (let i = 1; i < tr.length; i++) {
            const td = tr[i].getElementsByTagName("td")[colIndex];
            if (td) {
              const txtValue = td.textContent || td.innerText;
              tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
            }
          }
        }
        fetchTransactions();
        setInterval(fetchTransactions, 10000);
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

// Endpoint for admin transactions JSON data
app.get('/admin/transactions/json', async (req, res) => {
    try {
        const transactions = await Transaction.findAll({ order: [['createdAt', 'DESC']] });
        const data = transactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          description: tx.description,
          userId: tx.userId,
          teamId: tx.teamId,
          createdAt: tx.createdAt
        }));
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --------------------------
// Judge Routes (داور)
// --------------------------

// Serve judge panel
app.get('/judge', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'judge') return res.redirect('/login');
    try {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>داور</title>
          <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
          <form action="/judge/award" method="POST">
            <label>کد انتقال (۴ رقمی):</label>
            <input type="text" name="walletCode" required><br>
            <label>مبلغ (مثبت یا منفی):</label>
            <input type="text" name="amount" required><br>
            <button type="submit">انتقال امتیاز</button>
          </form>
          <button onclick="window.location.href='/judge/groups'">لیست گروه‌ها</button>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در بارگذاری پنل داور.") + "&back=/login");
    }
});

// Handle judge award (score transfer) confirmation initiation
app.post('/judge/award', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'judge') return res.redirect('/login');
    try {
        const { walletCode, amount } = req.body;
        const transferAmount = parseFloat(amount);
        const team = await Team.findOne({ where: { walletCode } });
        if (!team) return res.redirect('/error?message=' + encodeURIComponent("گروهی با این کد یافت نشد.") + "&back=/judge");
        
        // Serve confirmation page for score transfer
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>تایید انتقال امتیاز</title>
          <link rel="stylesheet" href="/css/style.css">
        </head>
        <body class="confirm-modal-body">
          <div class="confirm-container">
            <h1>تایید انتقال امتیاز</h1>
            <p>نام گروه: ${team.teamName}</p>
            <p>مبلغ انتقال: ${transferAmount}</p>
            <form action="/judge/award/confirm" method="POST">
              <input type="hidden" name="teamId" value="${team.id}">
              <input type="hidden" name="amount" value="${transferAmount}">
              <button type="submit">تایید</button>
              <button type="button" onclick="window.location.href='/judge'">انصراف</button>
            </form>
          </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در انتقال امتیاز.") + "&back=/judge");
    }
});

// Process judge award confirmation
app.post('/judge/award/confirm', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'judge') return res.redirect('/login');
    try {
        const { teamId, amount } = req.body;
        const transferAmount = parseFloat(amount);
        const team = await Team.findByPk(teamId);
        if (!team) return res.redirect('/error?message=' + encodeURIComponent("گروه یافت نشد.") + "&back=/judge");
        team.score += transferAmount;
        await team.save();

        // Log transaction for score transfer by judge
        await Transaction.create({
          type: 'score_award',
          description: `انتقال امتیاز به گروه "${team.teamName}" به مبلغ ${transferAmount}.`,
          teamId: team.id,
          details: { amount: transferAmount }
        });

        res.redirect('/judge');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در تایید انتقال امتیاز.") + "&back=/judge");
    }
});

// Serve judge teams list
app.get('/judge/groups', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'judge') return res.redirect('/login');
    try {
        const teams = await Team.findAll({ order: [['score', 'DESC']] });
        let rows = '';
        teams.forEach(team => {
            rows += `<tr id="team-${team.id}">
                <td>${team.teamName}</td>
                <td>${team.walletCode}</td>
                <td class="team-score">${team.score}</td>
                <td>
                  <button onclick="openModal('/judge/groups/award?teamId=${team.id}')">انتقال امتیاز</button>
                </td>
            </tr>`;
        });
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>لیست گروه‌ها</title>
          <link rel="stylesheet" href="/css/style.css">
          <script src="/js/modal.js"></script>
          <script>
            async function refreshGroups() {
              try {
                const response = await fetch('/judge/groups/json');
                const data = await response.json();
                data.forEach(team => {
                  const row = document.getElementById('team-' + team.id);
                  if (row) {
                    const scoreCell = row.querySelector('.team-score');
                    if (scoreCell) {
                      scoreCell.innerText = team.score;
                    }
                  }
                });
              } catch (error) {
                console.error('خطا در به‌روزرسانی گروه‌ها:', error);
              }
            }
            setInterval(refreshGroups, 10000);
          </script>
        </head>
        <body>
          <h1>لیست گروه‌ها</h1>
          <table border="1" cellpadding="5" cellspacing="0" id="groups-table">
            <tr>
              <th>نام گروه</th>
              <th>کد انتقال</th>
              <th>امتیاز</th>
              <th>عملیات</th>
            </tr>
            ${rows}
          </table>
          <button onclick="window.location.href='/judge'">بازگشت</button>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در بارگذاری لیست گروه‌ها.") + "&back=/judge");
    }
});

// Endpoint for judge teams JSON data (score updates)
app.get('/judge/groups/json', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'judge') return res.status(401).json({ error: "Unauthorized" });
    try {
        const teams = await Team.findAll({ order: [['score', 'DESC']] });
        const data = teams.map(team => ({
            id: team.id,
            score: team.score
        }));
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Serve judge team award (score transfer) form
app.get('/judge/groups/award', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'judge') return res.redirect('/login');
    try {
        const teamId = req.query.teamId;
        const team = await Team.findByPk(teamId);
        if (!team) return res.redirect('/error?message=' + encodeURIComponent("گروه یافت نشد.") + "&back=/judge/groups");
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>تایید انتقال امتیاز</title>
          <link rel="stylesheet" href="/css/style.css">
        </head>
        <body class="confirm-modal-body">
          <div class="confirm-container">
            <h1>انتقال امتیاز برای گروه ${team.teamName}</h1>
            <form action="/judge/groups/award/confirm" method="POST">
              <input type="hidden" name="teamId" value="${team.id}">
              <label>مبلغ انتقال (مثبت یا منفی):</label>
              <input type="text" name="amount" required><br>
              <button type="submit">تایید</button>
              <button type="button" onclick="window.location.href='/judge/groups'">انصراف</button>
            </form>
          </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در دریافت اطلاعات گروه.") + "&back=/judge/groups");
    }
});

// Process judge team award confirmation
app.post('/judge/groups/award/confirm', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'judge') return res.redirect('/login');
    try {
        const { teamId, amount } = req.body;
        const transferAmount = parseFloat(amount);
        const team = await Team.findByPk(teamId);
        if (!team) return res.redirect('/error?message=' + encodeURIComponent("گروه یافت نشد.") + "&back=/judge/groups");
        team.score += transferAmount;
        await team.save();

        // Log transaction for judge score transfer
        await Transaction.create({
          type: 'score_award',
          description: `انتقال امتیاز به گروه "${team.teamName}" به مبلغ ${transferAmount}.`,
          teamId: team.id,
          details: { amount: transferAmount }
        });

        res.redirect('/judge/groups');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در انتقال امتیاز.") + "&back=/judge/groups");
    }
});

// --------------------------
// Student Routes (دانش‌آموز)
// --------------------------

// Serve student panel
app.get('/student', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>پنل دانش‌آموز</title>
            <link rel="stylesheet" href="/css/style.css">
            <script src="/js/modal.js"></script>
        </head>
        <body>
            <div class="logout"><a href="/logout"><button>خروج</button></a></div>
            <h1>پنل دانش‌آموز</h1>
            <div class="panel-container">
        `;
        // User information box
        html += `<div class="box user-info">
                    <h2>اطلاعات کاربری</h2>
                    <p>نام: ${user.firstName} ${user.lastName}</p>
                    <p>کد ملی: ${user.nationalId}</p>
                    <p>شماره همراه: ${user.mobile}</p>
                    <button onclick="openModal('/student/updateMobile')">تغییر شماره همراه</button>
                 </div>`;
        // Team information box
        if (user.teamId) {
            const team = await Team.findByPk(user.teamId);
            const members = await User.findAll({ where: { teamId: team.id } });
            let memberList = "";
            members.forEach(member => {
                memberList += `<li>${member.firstName} ${member.lastName} ${team.leaderId === member.id ? '(سرگروه)' : ''}</li>`;
            });
            html += `<div class="box team-info">
                        <h2>اطلاعات گروه</h2>
                        <p>نام گروه: ${team.teamName}</p>
                        <p>کد گروه: ${team.teamCode}</p>
                        <ul>اعضا:
                           ${memberList}
                        </ul>`;
            if (team.leaderId === user.id) {
                html += `<button onclick="openModal('/confirm?message=' + encodeURIComponent('آیا مطمئن هستید؟ حذف گروه تمامی اعضا را از گروه خارج می‌کند.') + '&action=/team/delete&cancel=/student')">حذف گروه</button>`;
            } else {
                html += `<button onclick="openModal('/confirm?message=' + encodeURIComponent('آیا مطمئن هستید که می‌خواهید از گروه خارج شوید؟') + '&action=/team/leave&cancel=/student')">خروج از گروه</button>`;
            }
            html += `</div>`;
            // Wallet information box
            let availableTransfer = 0;
            if (team.score > 100) {
                availableTransfer = Math.min(Math.floor(team.score * 0.3), team.score - 100);
            }
            html += `<div class="box wallet-info">
                        <h2>کیف پول</h2>
                        <p>کد انتقال: ${team.walletCode}</p>
                        <p>امتیاز کل: ${team.score}</p>
                        <p>امتیاز قابل انتقال: ${availableTransfer}</p>`;
            if (team.leaderId === user.id) {
                html += `<form action="/student/wallet/transfer" method="POST">
                            <label>کد انتقال گروه مقصد:</label>
                            <input type="text" name="destWalletCode" required><br>
                            <label>مبلغ انتقال:</label>
                            <input type="number" name="amount" required><br>
                            <button type="submit">انتقال امتیاز</button>
                         </form>`;
            }
            html += `</div>`;
        } else {
            html += `<div class="box team-info">
                        <h2>اطلاعات گروه</h2>
                        <p>شما عضو هیچ گروهی نیستید.</p>
                        <button onclick="openModal('/team/create')">ایجاد گروه</button>
                        <button onclick="openModal('/team/join')">ملحق شدن به گروه</button>
                     </div>`;
        }
        // Scoreboard box
        html += `<div class="box scoreboard-box">
                    <h2>جدول امتیازات برتر</h2>
                    <ul id="top-teams"></ul>
                    <button onclick="window.open('/scoreboard/full', '_blank')">نمایش جدول امتیازات</button>
                 </div>`;
        html += `</div>
            <div id="modal-overlay" class="modal-overlay" style="display:none;">
              <div id="modal-content" class="modal-content"></div>
            </div>
            <script>
              async function updateTopTeams() {
                try {
                  const response = await fetch('/scoreboard/json');
                  const teams = await response.json();
                  const topTeams = teams.sort((a, b) => b.score - a.score).slice(0, 5);
                  const list = document.getElementById('top-teams');
                  list.innerHTML = '';
                  topTeams.forEach(team => {
                    const li = document.createElement('li');
                    li.innerText = team.teamName + ' - ' + team.score;
                    list.appendChild(li);
                  });
                } catch (error) {
                  console.error('خطا در به‌روزرسانی جدول امتیازات:', error);
                }
              }
              updateTopTeams();
              setInterval(updateTopTeams, 60000);
            </script>
            <script src="/js/modal.js"></script>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در بارگذاری پنل دانش‌آموز.") + "&back=/login");
    }
});

// Serve student mobile update modal
app.get('/student/updateMobile', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>تغییر شماره همراه</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <div>
                <h1>تغییر شماره همراه</h1>
                <form action="/student/updateMobile" method="POST">
                    <label>شماره همراه جدید:</label>
                    <input type="text" name="mobile" value="${user.mobile}" required><br>
                    <button type="submit">بروزرسانی</button>
                    <button type="button" class="close-modal">انصراف</button>
                </form>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در دریافت اطلاعات.") + "&back=/student");
    }
});

// Handle student mobile update
app.post('/student/updateMobile', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const { mobile } = req.body;
        const user = await User.findByPk(req.session.user.id);
        user.mobile = mobile;
        await user.save();
        res.redirect('/student');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در بروزرسانی شماره همراه.") + "&back=/student");
    }
});

// --------------------------
// Team Routes (گروه‌ها برای دانش‌آموز)
// --------------------------

// Serve team management modal
app.get('/team', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        let html = `<div>
            <h1>مدیریت گروه</h1>`;
        if (user.teamId) {
            const team = await Team.findByPk(user.teamId);
            const members = await User.findAll({ where: { teamId: team.id } });
            html += `<h2>اطلاعات گروه</h2>
            <p>نام گروه: ${team.teamName}</p>
            <p>کد گروه: ${team.teamCode}</p>
            <p>امتیاز: ${team.score}</p>
            <ul>`;
            members.forEach(member => {
                html += `<li>${member.firstName} ${member.lastName} ${team.leaderId === member.id ? '(سرگروه)' : ''}</li>`;
            });
            html += `</ul>`;
            if (team.leaderId === user.id) {
                html += `<button onclick="openModal('/confirm?message=' + encodeURIComponent('آیا مطمئن هستید؟ حذف گروه تمامی اعضا را از گروه خارج می‌کند.') + '&action=/team/delete&cancel=/student')">حذف گروه</button>`;
            } else {
                html += `<button onclick="openModal('/confirm?message=' + encodeURIComponent('آیا مطمئن هستید که می‌خواهید از گروه خارج شوید؟') + '&action=/team/leave&cancel=/student')">خروج از گروه</button>`;
            }
        } else {
            html += `<h2>اطلاعات گروه</h2>
                     <p>شما عضو هیچ گروهی نیستید.</p>
                     <button onclick="openModal('/team/create')">ایجاد گروه</button>
                     <button onclick="openModal('/team/join')">ملحق شدن به گروه</button>`;
        }
        html += `</div>`;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در نمایش اطلاعات گروه.") + "&back=/student");
    }
});

// Serve team creation modal
app.get('/team/create', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    const user = await User.findByPk(req.session.user.id);
    if (user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما قبلاً عضو یک گروه هستید.") + "&back=/team");
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ایجاد گروه</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <div>
            <h1>ایجاد گروه</h1>
            <form action="/team/create" method="POST">
                <label>نام گروه:</label>
                <input type="text" name="teamName" required><br>
                <button type="submit">ایجاد گروه</button>
                <button type="button" class="close-modal">انصراف</button>
            </form>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

// Handle team creation
app.post('/team/create', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        if (user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما قبلاً عضو یک گروه هستید.") + "&back=/team");
        const { teamName } = req.body;
        let teamCode, walletCode, exists = true;
        while (exists) {
            teamCode = Math.floor(10000000 + Math.random() * 90000000).toString();
            const teamExist = await Team.findOne({ where: { teamCode } });
            if (!teamExist) exists = false;
        }
        exists = true;
        while (exists) {
            walletCode = Math.floor(1000 + Math.random() * 9000).toString();
            const codeExist = await Team.findOne({ where: { walletCode } });
            if (!codeExist) exists = false;
        }
        const newTeam = await Team.create({
            teamName,
            teamCode,
            walletCode,
            leaderId: user.id
        });
        user.teamId = newTeam.id;
        await user.save();

        // Log team creation transaction
        await Transaction.create({
          type: 'team_creation',
          description: `گروه "${newTeam.teamName}" با کد "${newTeam.teamCode}" ایجاد شد.`,
          userId: user.id,
          teamId: newTeam.id,
          details: { walletCode: newTeam.walletCode }
        });

        res.redirect('/student');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در ایجاد گروه.") + "&back=/team");
    }
});

// Serve team join modal
app.get('/team/join', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    const user = await User.findByPk(req.session.user.id);
    if (user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما قبلاً عضو یک گروه هستید.") + "&back=/team");
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ملحق شدن به گروه</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <div>
            <h1>ملحق شدن به گروه</h1>
            <form action="/team/join" method="POST">
                <label>کد گروه:</label>
                <input type="text" name="teamCode" required><br>
                <button type="submit">ملحق شدن</button>
                <button type="button" class="close-modal">انصراف</button>
            </form>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

// Handle team join
app.post('/team/join', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        if (user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما قبلاً عضو یک گروه هستید.") + "&back=/student");
        const { teamCode } = req.body;
        const team = await Team.findOne({ where: { teamCode } });
        if (!team) return res.redirect('/error?message=' + encodeURIComponent("گروهی با این کد یافت نشد.") + "&back=/student");
        const members = await User.findAll({ where: { teamId: team.id } });
        if (members.length >= 3) return res.redirect('/error?message=' + encodeURIComponent("گروه پر است.") + "&back=/student");
        user.teamId = team.id;
        await user.save();

        // Log team join transaction
        await Transaction.create({
          type: 'team_join',
          description: `کاربر ${user.firstName} ${user.lastName} به گروه "${team.teamName}" پیوست.`,
          userId: user.id,
          teamId: team.id,
          details: {}
        });

        res.redirect('/student');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در ملحق شدن به گروه.") + "&back=/student");
    }
});

// Handle team leave
app.post('/team/leave', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        if (!user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما عضو هیچ گروهی نیستید.") + "&back=/student");
        const team = await Team.findByPk(user.teamId);
        if (team.leaderId === user.id) return res.redirect('/error?message=' + encodeURIComponent("سرگروه نمی‌تواند از گروه خارج شود. برای حذف گروه از گزینه حذف استفاده کنید.") + "&back=/student");
        user.teamId = null;
        await user.save();

        // Log team leave transaction
        await Transaction.create({
          type: 'team_leave',
          description: `کاربر ${user.firstName} ${user.lastName} از گروه "${team.teamName}" خارج شد.`,
          userId: user.id,
          teamId: team.id,
          details: {}
        });

        res.redirect('/student');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در خروج از گروه.") + "&back=/student");
    }
});

// Handle team deletion (only team leader can delete)
app.post('/team/delete', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        if (!user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما عضو هیچ گروهی نیستید.") + "&back=/team");
        const team = await Team.findByPk(user.teamId);
        if (team.leaderId !== user.id) return res.redirect('/error?message=' + encodeURIComponent("فقط سرگروه می‌تواند گروه را حذف کند.") + "&back=/team");
        await User.update({ teamId: null }, { where: { teamId: team.id } });
        await Team.destroy({ where: { id: team.id } });

        // Log team deletion transaction
        await Transaction.create({
          type: 'team_deletion',
          description: `گروه "${team.teamName}" توسط سرگروه حذف شد.`,
          userId: user.id,
          teamId: team.id,
          details: {}
        });

        res.redirect('/student');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در حذف گروه.") + "&back=/team");
    }
});

// --------------------------
// Wallet / Score Transfer Routes (دانش‌آموز)
// --------------------------

// Handle score transfer initiation (by team leader)
app.post('/student/wallet/transfer', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        if (!user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما عضو هیچ گروهی نیستید.") + "&back=/student");
        const team = await Team.findByPk(user.teamId);
        if (team.leaderId !== user.id) return res.redirect('/error?message=' + encodeURIComponent("فقط سرگروه می‌تواند امتیاز انتقال دهد.") + "&back=/student");

        const { destWalletCode, amount } = req.body;
        const transferAmount = parseInt(amount);
        if (transferAmount <= 0) return res.redirect('/error?message=' + encodeURIComponent("مبلغ انتقال نامعتبر است.") + "&back=/student");

        let availableTransfer = 0;
        if (team.score > 100) {
            availableTransfer = Math.min(Math.floor(team.score * 0.3), team.score - 100);
        }
        if (transferAmount > availableTransfer) return res.redirect('/error?message=' + encodeURIComponent("مبلغ انتقال بیشتر از حد مجاز است.") + "&back=/student");

        const destTeam = await Team.findOne({ where: { walletCode: destWalletCode } });
        if (!destTeam) return res.redirect('/error?message=' + encodeURIComponent("گروه مقصد یافت نشد.") + "&back=/student");
        if (destTeam.id === team.id) return res.redirect('/error?message=' + encodeURIComponent("گروه مقصد نمی‌تواند گروه خودتان باشد.") + "&back=/student");

        // Serve confirmation page for wallet transfer
        const html = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>تایید انتقال امتیاز</title>
                <link rel="stylesheet" href="/css/style.css">
            </head>
            <body class="confirm-modal-body">
                <div class="confirm-container">
                    <h1>تایید انتقال امتیاز</h1>
                    <p>نام گروه مقصد: ${destTeam.teamName}</p>
                    <p>مبلغ انتقال: ${transferAmount}</p>
                    <form action="/student/wallet/transfer/confirm" method="POST">
                        <input type="hidden" name="destTeamId" value="${destTeam.id}">
                        <input type="hidden" name="amount" value="${transferAmount}">
                        <button type="submit">تایید</button>
                        <button type="button" class="close-modal">انصراف</button>
                    </form>
                </div>
            </body>
        </html>
        `;
        res.send(html);
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در انتقال امتیاز.") + "&back=/student");
    }
});

// Process wallet transfer confirmation
app.post('/student/wallet/transfer/confirm', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') return res.redirect('/login');
    try {
        const user = await User.findByPk(req.session.user.id);
        if (!user.teamId) return res.redirect('/error?message=' + encodeURIComponent("شما عضو هیچ گروهی نیستید.") + "&back=/student");
        const team = await Team.findByPk(user.teamId);
        if (team.leaderId !== user.id) return res.redirect('/error?message=' + encodeURIComponent("فقط سرگروه می‌تواند امتیاز انتقال دهد.") + "&back=/student");
        const { destTeamId, amount } = req.body;
        const transferAmount = parseInt(amount);
        let availableTransfer = 0;
        if (team.score > 100) {
            availableTransfer = Math.min(Math.floor(team.score * 0.3), team.score - 100);
        }
        if (transferAmount > availableTransfer) return res.redirect('/error?message=' + encodeURIComponent("مبلغ انتقال بیشتر از حد مجاز است.") + "&back=/student");
        const destTeam = await Team.findByPk(destTeamId);
        if (!destTeam) return res.redirect('/error?message=' + encodeURIComponent("گروه مقصد یافت نشد.") + "&back=/student");
        if (destTeam.id === team.id) return res.redirect('/error?message=' + encodeURIComponent("گروه مقصد نمی‌تواند گروه خودتان باشد.") + "&back=/student");
        team.score -= transferAmount;
        destTeam.score += transferAmount;
        await team.save();
        await destTeam.save();

        // Log score transfer transaction
        await Transaction.create({
          type: 'score_transfer',
          description: `انتقال امتیاز از گروه "${team.teamName}" به گروه "${destTeam.teamName}" به مبلغ ${transferAmount}.`,
          userId: user.id,
          teamId: team.id,
          details: { amount: transferAmount, destTeamId: destTeam.id }
        });

        res.redirect('/student');
    } catch (err) {
        console.error(err);
        res.redirect('/error?message=' + encodeURIComponent("خطا در تایید انتقال امتیاز.") + "&back=/student");
    }
});

// --------------------------
// Scoreboard Routes (جدول امتیازات)
// --------------------------

// Endpoint for scoreboard JSON data
app.get('/scoreboard/json', async (req, res) => {
    try {
      const teams = await Team.findAll();
      const data = teams.map(team => ({
        id: team.id,
        teamName: team.teamName,
        teamCode: team.teamCode,
        score: team.score
      }));
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
});  
  
// Serve full scoreboard page
app.get('/scoreboard/full', async (req, res) => {
    let myTeamId = null;
    if (req.session.user && req.session.user.role === 'student') {
        const user = await User.findByPk(req.session.user.id);
        myTeamId = user.teamId;
    }
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>جدول امتیازات مسابقه</title>
      <link rel="stylesheet" href="/css/style-score.css">
      <style>
        body {
          background: #000;
          margin: 0;
          padding: 0;
          overflow: hidden;
          position: relative;
        }
        .scoreboard-container {
          position: relative;
          width: 100%;
          height: 100vh;
        }
        /* دایره‌ها: اندازه 3px، انتقال با انیمیشن */
        .team-circle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: white;
          border: 1px solid white;
          box-shadow: 0 0 3px rgba(255,255,255,0.5);
          cursor: pointer;
          transition: top 0.5s ease-in-out, left 0.5s ease-in-out, box-shadow 0.5s ease-in-out;
          z-index: 2;
        }
        .team-circle.my-team {
          background: #ff0000;
          border-color: #ff0000;
          box-shadow: 0 0 3px rgba(255,0,0,0.8);
          z-index: 3;
        }
        /* خطوط امتیاز: از لبه‌های صفحه (left=0,right=0) و با transition */
        .score-line {
          position: absolute;
          height: 1px;
          background: rgba(255, 255, 255, 0.15);
          left: 0;
          right: 0;
          transition: top 0.5s ease-in-out, box-shadow 0.5s ease-in-out;
          box-shadow: 0 0 2px rgba(255,255,255,0.05);
          z-index: 1;
        }
        .score-line.my-team-line {
          background: rgba(255, 0, 0, 0.8);
          box-shadow: 0 0 5px rgba(255, 0, 0, 0.8);
        }
        .tooltip {
          position: absolute;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 0.9rem;
          pointer-events: none;
          white-space: nowrap;
        }
      </style>
    </head>
    <body>
      <div class="scoreboard-container" id="scoreboard-container"></div>
      <script>
        const myTeamId = ${myTeamId ? myTeamId : 'null'};
        const prevLinePositions = {};
        
        async function updateScoreboard() {
          try {
            const response = await fetch('/scoreboard/json');
            const teams = await response.json();
            teams.sort((a, b) => a.teamCode.localeCompare(b.teamCode));
            const container = document.getElementById('scoreboard-container');
            const containerHeight = window.innerHeight;
            const containerWidth = window.innerWidth;
            const topMargin = 50;
            const bottomMargin = 50;
            const availableHeight = containerHeight - topMargin - bottomMargin;
            const leftMargin = 30, rightMargin = 30;
            const availableWidth = containerWidth - leftMargin - rightMargin;
            const gap = teams.length > 1 ? availableWidth / (teams.length - 1) : 0;
            
            teams.forEach((team, index) => {
              const maxScore = Math.max(...teams.map(t => t.score), 1000);
              const ratio = team.score / maxScore;
              const topPos = topMargin + (1 - ratio) * availableHeight;
              const leftPos = leftMargin + index * gap;
              
              let circle = document.getElementById('circle-' + team.id);
              if (!circle) {
                circle = document.createElement('div');
                circle.id = 'circle-' + team.id;
                circle.classList.add('team-circle');
                circle.addEventListener('click', (e) => {
                  showTooltip(e, team);
                });
                container.appendChild(circle);
              }
              if (typeof myTeamId === 'number' && myTeamId === team.id) {
                circle.classList.add('my-team');
              } else {
                circle.classList.remove('my-team');
              }
              circle.style.top = topPos + 'px';
              circle.style.left = leftPos + 'px';
              
              let scoreLine = document.getElementById('scoreline-' + team.id);
              if (!scoreLine) {
                scoreLine = document.createElement('div');
                scoreLine.id = 'scoreline-' + team.id;
                scoreLine.classList.add('score-line');
                container.appendChild(scoreLine);
              }
              if (typeof myTeamId === 'number' && myTeamId === team.id) {
                scoreLine.classList.add('my-team-line');
              } else {
                scoreLine.classList.remove('my-team-line');
              }
              const newTop = topPos + 1.5;
              scoreLine.style.top = newTop + 'px';
              
              if (!prevLinePositions[team.id] || Math.abs(newTop - prevLinePositions[team.id]) > 1) {
                if (typeof myTeamId === 'number' && myTeamId === team.id) {
                  scoreLine.style.boxShadow = "0 0 10px red";
                } else {
                  scoreLine.style.boxShadow = "0 0 10px blue";
                }
                setTimeout(() => {
                  scoreLine.style.boxShadow = "0 0 2px rgba(255,255,255,0.05)";
                }, 500);
              }
              prevLinePositions[team.id] = newTop;
            });
            
            // حذف عناصری که در teams موجود نیستند
            const existingCircles = container.querySelectorAll('.team-circle');
            existingCircles.forEach(circle => {
              const id = circle.id.replace('circle-', '');
              if (!teams.find(t => t.id == id)) {
                circle.remove();
              }
            });
            const existingLines = container.querySelectorAll('.score-line');
            existingLines.forEach(line => {
              const id = line.id.replace('scoreline-', '');
              if (!teams.find(t => t.id == id)) {
                line.remove();
              }
            });
          } catch (error) {
            console.error('Error updating scoreboard:', error);
          }
        }
        
        function showTooltip(e, team) {
          document.querySelectorAll('.tooltip').forEach(el => el.remove());
          const tooltip = document.createElement('div');
          tooltip.classList.add('tooltip');
          tooltip.innerText = team.teamName + ' - ' + team.score;
          document.body.appendChild(tooltip);
          const rect = e.target.getBoundingClientRect();
          let tooltipLeft = rect.left;
          if (tooltipLeft < 10) tooltipLeft = 10;
          if (tooltipLeft + tooltip.offsetWidth > window.innerWidth - 10) {
            tooltipLeft = window.innerWidth - tooltip.offsetWidth - 10;
          }
          tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
          tooltip.style.left = tooltipLeft + 'px';
          setTimeout(() => { tooltip.remove(); }, 3000);
        }
        
        updateScoreboard();
        setInterval(updateScoreboard, 10000);
      </script>
    </body>
    </html>
    `;
    res.send(html);
});

// --------------------------
// Error and Confirmation Routes (صفحات خطا و تایید)
// --------------------------

// Serve error page
app.get('/error', (req, res) => {
    const message = req.query.message || "خطایی رخ داده است.";
    const back = req.query.back || "/";
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>خطا</title>
      <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
      <div class="error-message">
        <h1>خطا</h1>
        <p>${message}</p>
        <button onclick="window.location.href='${back}'">بازگشت</button>
      </div>
    </body>
    </html>
    `;
    res.send(html);
});

// Serve confirmation page (modal)
app.get('/confirm', (req, res) => {
    const message = req.query.message || "آیا مطمئن هستید؟";
    const action = req.query.action || "/";
    const cancel = req.query.cancel || "/";
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تایید</title>
      <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
      <div class="modal-content">
        <h1>تایید</h1>
        <p>${message}</p>
        <form action="${action}" method="POST">
          <button type="submit">بله</button>
          <button type="button" onclick="window.location.href='${cancel}'">خیر</button>
        </form>
      </div>
    </body>
    </html>
    `;
    res.send(html);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
