const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const session = new StringSession(""); 

let client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
let codeResolve, passwordResolve;

// ГЛАВНЫЙ ИНТЕРФЕЙС
const getUI = () => `
<!DOCTYPE html>
<html>
<head>
    <title>Custom TG Web</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; height: 100vh; display: flex; background: #e6ebee; }
        
        /* Стили авторизации */
        #auth-container { margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 350px; text-align: center; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #dfe1e5; border-radius: 8px; outline: none; }
        button { width: 100%; padding: 12px; background: #3390ec; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
        
        /* Стили мессенджера */
        #messenger { display: none; width: 100%; height: 100vh; flex-direction: row; }
        #sidebar { width: 350px; background: white; border-right: 1px solid #dfe1e5; display: flex; flex-direction: column; }
        #chat-list { flex: 1; overflow-y: auto; }
        .chat-item { padding: 15px; border-bottom: 1px solid #f1f1f1; cursor: pointer; display: flex; align-items: center; }
        .chat-item:hover { background: #f4f4f5; }
        .chat-item.active { background: #3390ec; color: white; }

        #main-chat { flex: 1; display: flex; flex-direction: column; background: #f5f5f5; }
        #messages-header { padding: 15px; background: white; border-bottom: 1px solid #dfe1e5; font-weight: bold; }
        #messages-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 8px 15px; border-radius: 15px; max-width: 70%; line-height: 1.4; position: relative; }
        .msg.in { background: white; align-self: flex-start; border-bottom-left-radius: 2px; }
        .msg.out { background: #eeffde; align-self: flex-end; border-bottom-right-radius: 2px; }
        
        #input-bar { padding: 15px; background: white; display: flex; gap: 10px; border-top: 1px solid #dfe1e5; }
    </style>
</head>
<body>
    <div id="auth-container">
        <h2>Telegram Login</h2>
        <div id="phone-box">
            <input id="phone" type="text" placeholder="+79XXXXXXXXX">
            <button onclick="sendPhone()">Получить код</button>
        </div>
        <div id="code-box" style="display:none">
            <input id="code" type="text" placeholder="Код подтверждения">
            <button onclick="sendCode()">Войти</button>
        </div>
        <div id="pass-box" style="display:none">
            <p>Введите облачный пароль</p>
            <input id="pass" type="password">
            <button onclick="sendPass()">Подтвердить</button>
        </div>
    </div>

    <div id="messenger">
        <div id="sidebar">
            <div style="padding:15px; border-bottom:1px solid #dfe1e5"><b>Чаты</b></div>
            <div id="chat-list"></div>
        </div>
        <div id="main-chat">
            <div id="messages-header">Выберите чат</div>
            <div id="messages-container"></div>
            <div id="input-bar">
                <input id="msgInput" type="text" placeholder="Написать сообщение...">
                <button style="width:auto" onclick="sendMessage()">Отправить</button>
            </div>
        </div>
    </div>

    <script>
        let currentPeer = null;

        async function checkStatus() {
            const r = await fetch('/api/status');
            const d = await r.json();
            if (d.connected) {
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('messenger').style.display = 'flex';
                loadChats();
            }
        }

        async function sendPhone() {
            const phone = document.getElementById('phone').value;
            await fetch('/api/login?phone=' + phone);
            document.getElementById('phone-box').style.display = 'none';
            document.getElementById('code-box').style.display = 'block';
        }

        async function sendCode() {
            const code = document.getElementById('code').value;
            const res = await fetch('/api/submit-code?code=' + code);
            const data = await res.json();
            if (data.status === 'need_2fa') {
                document.getElementById('code-box').style.display = 'none';
                document.getElementById('pass-box').style.display = 'block';
            } else { checkStatus(); }
        }

        async function sendPass() {
            const pass = document.getElementById('pass').value;
            await fetch('/api/submit-2fa?pass=' + pass);
            setTimeout(checkStatus, 2000);
        }

        async function loadChats() {
            const r = await fetch('/api/chats');
            const chats = await r.json();
            const list = document.getElementById('chat-list');
            list.innerHTML = chats.map(c => \`
                <div class="chat-item" onclick="openChat('\${c.id}', '\${c.title}')">
                    \${c.title}
                </div>
            \`).join('');
        }

        async function openChat(id, title) {
            currentPeer = id;
            document.getElementById('messages-header').innerText = title;
            const r = await fetch('/api/messages?id=' + id);
            const msgs = await r.json();
            const container = document.getElementById('messages-container');
            container.innerHTML = msgs.map(m => \`
                <div class="msg \${m.out ? 'out' : 'in'}">\${m.text || '[Медиа или пусто]'}</div>
            \`).join('');
            container.scrollTop = container.scrollHeight;
        }

        async function sendMessage() {
            const text = document.getElementById('msgInput').value;
            if (!currentPeer || !text) return;
            await fetch('/api/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: currentPeer, text })
            });
            document.getElementById('msgInput').value = '';
            openChat(currentPeer, document.getElementById('messages-header').innerText);
        }

        setInterval(checkStatus, 5000); // Проверка статуса
        checkStatus();
    </script>
</body>
</html>
`;

// API ЭНДПОИНТЫ
app.get("/", (req, res) => res.send(getUI()));

app.get("/api/status", (req, res) => {
    res.json({ connected: !!(client && client.connected && client._connected) });
});

app.get("/api/login", async (req, res) => {
    const phone = req.query.phone;
    client.start({
        phoneNumber: async () => phone,
        phoneCode: async () => new Promise(r => { codeResolve = r; }),
        password: async () => new Promise(r => { passwordResolve = r; }),
        onError: (e) => console.log(e)
    });
    res.json({ ok: true });
});

app.get("/api/submit-code", (req, res) => {
    if (codeResolve) codeResolve(req.query.code);
    setTimeout(() => {
        if (passwordResolve) res.json({ status: 'need_2fa' });
        else res.json({ status: 'ok' });
    }, 2000);
});

app.get("/api/submit-2fa", (req, res) => {
    if (passwordResolve) passwordResolve(req.query.pass);
    res.json({ ok: true });
});

app.get("/api/chats", async (req, res) => {
    if (!client.connected) return res.json([]);
    const dialogs = await client.getDialogs({});
    res.json(dialogs.map(d => ({ id: d.id.toString(), title: d.title })));
});

app.get("/api/messages", async (req, res) => {
    const history = await client.getMessages(req.query.id, { limit: 30 });
    res.json(history.map(m => ({ text: m.message, out: m.out })));
});

app.post("/api/send", async (req, res) => {
    await client.sendMessage(req.body.id, { message: req.body.text });
    res.json({ ok: true });
});

app.listen(port, () => console.log(`Telegram Client Live on ${port}`));