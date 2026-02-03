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

let client;
let codeResolve;

// --- HTML ИНТЕРФЕЙС ---
const getUI = () => `
<!DOCTYPE html>
<html>
<head>
    <title>Custom TG Web</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; height: 100vh; display: flex; background: #e6ebee; }
        #sidebar { width: 300px; background: white; border-right: 1px solid #ddd; overflow-y: auto; }
        #chat-window { flex: 1; display: flex; flex-direction: column; background: #f5f5f5; }
        .chat-item { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; transition: 0.2s; }
        .chat-item:hover { background: #f0f7ff; }
        #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
        .msg { margin-bottom: 10px; padding: 10px; border-radius: 10px; max-width: 70%; }
        .msg.in { background: white; align-self: flex-start; }
        .msg.out { background: #dcf8c6; align-self: flex-end; }
        #input-area { padding: 15px; background: white; display: flex; gap: 10px; }
        input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        button { padding: 10px 20px; background: #0088cc; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .login-box { margin: auto; padding: 30px; background: white; border-radius: 10px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div id="app" style="display: contents;"></div>

    <script>
        let selectedChatId = null;

        async function loadApp() {
            const res = await fetch('/api/status');
            const data = await res.json();
            if (!data.connected) {
                renderLogin();
            } else {
                renderMessenger();
            }
        }

        function renderLogin() {
            document.getElementById('app').innerHTML = \`
                <div class="login-box">
                    <h2>Вход в Telegram</h2>
                    <input id="phone" type="text" placeholder="+79XXXXXXXXX">
                    <button onclick="startLogin()">Далее</button>
                    <div id="code-step" style="display:none; margin-top:10px;">
                        <input id="code" type="text" placeholder="Код из ТГ">
                        <button onclick="submitCode()">Войти</button>
                    </div>
                </div>\`;
        }

        async function startLogin() {
            const phone = document.getElementById('phone').value;
            await fetch('/api/login?phone=' + phone);
            document.getElementById('code-step').style.display = 'block';
        }

        async function submitCode() {
            const code = document.getElementById('code').value;
            await fetch('/api/submit-code?code=' + code);
            location.reload();
        }

        async function renderMessenger() {
            document.getElementById('app').innerHTML = \`
                <div id="sidebar"><h3>Чаты</h3><div id="chat-list">Загрузка...</div></div>
                <div id="chat-window">
                    <div id="messages">Выберите чат</div>
                    <div id="input-area">
                        <input id="msgInput" type="text" placeholder="Сообщение...">
                        <button onclick="sendMsg()">></button>
                    </div>
                </div>\`;
            loadChats();
        }

        async function loadChats() {
            const res = await fetch('/api/chats');
            const chats = await res.json();
            document.getElementById('chat-list').innerHTML = chats.map(c => 
                \`<div class="chat-item" onclick="openChat('\${c.id}')">\${c.title}</div>\`
            ).join('');
        }

        async function openChat(id) {
            selectedChatId = id;
            const res = await fetch('/api/messages?id=' + id);
            const msgs = await res.json();
            document.getElementById('messages').innerHTML = msgs.map(m => 
                \`<div class="msg \${m.out ? 'out' : 'in'}">\${m.text}</div>\`
            ).join('');
        }

        async function sendMsg() {
            const text = document.getElementById('msgInput').value;
            if (!selectedChatId || !text) return;
            await fetch('/api/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: selectedChatId, text })
            });
            document.getElementById('msgInput').value = '';
            openChat(selectedChatId);
        }

        loadApp();
    </script>
</body>
</html>
`;

// --- API ЭНДПОИНТЫ ---

app.get("/", (req, res) => res.send(getUI()));

app.get("/api/status", (req, res) => {
    res.json({ connected: !!(client && client.connected) });
});

app.get("/api/login", async (req, res) => {
    const phone = req.query.phone;
    client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
    await client.start({
        phoneNumber: async () => phone,
        phoneCode: async () => new Promise(r => { codeResolve = r; }),
        onError: (err) => console.log(err),
    });
    res.json({ ok: true });
});

app.get("/api/submit-code", (req, res) => {
    if (codeResolve) codeResolve(req.query.code);
    res.json({ ok: true });
});

app.get("/api/chats", async (req, res) => {
    const dialogs = await client.getDialogs({});
    res.json(dialogs.map(d => ({ id: d.id.toString(), title: d.title })));
});

app.get("/api/messages", async (req, res) => {
    const history = await client.getMessages(req.query.id, { limit: 20 });
    res.json(history.map(m => ({ text: m.message, out: m.out })));
});

app.post("/api/send", async (req, res) => {
    const { id, text } = req.body;
    await client.sendMessage(id, { message: text });
    res.json({ ok: true });
});

app.listen(port, () => console.log(`Full Client on ${port}`));