const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const session = new StringSession(""); 

let client;
let codeResolve;

// HTML-интерфейс (Простой и чистый дизайн)
const htmlPage = (content) => `
<!DOCTYPE html>
<html>
<head>
    <title>My TG Client</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding: 20px; }
        .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #0088cc; color: white; border: none; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0077b5; }
        .chat-item { padding: 10px; border-bottom: 1px solid #eee; list-style: none; }
    </style>
</head>
<body>
    <div class="card">${content}</div>
</body>
</html>
`;

app.get("/", (req, res) => {
    res.send(htmlPage(`
        <h2>Вход в Telegram</h2>
        <form action="/login" method="get">
            <input type="text" name="phone" placeholder="+79991234567" required>
            <button type="submit">Отправить код</button>
        </form>
    `));
});

app.get("/login", async (req, res) => {
    const phone = req.query.phone;
    client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
    
    // Запускаем процесс в фоне
    client.start({
        phoneNumber: async () => phone,
        phoneCode: async () => new Promise((resolve) => { codeResolve = resolve; }),
        onError: (err) => console.log(err),
    }).then(() => {
        console.log("Logged in!");
    });

    res.send(htmlPage(`
        <h2>Введите код</h2>
        <p>Код отправлен на номер ${phone}</p>
        <form action="/submit-code" method="get">
            <input type="text" name="code" placeholder="12345" required>
            <button type="submit">Войти</button>
        </form>
    `));
});

app.get("/submit-code", (req, res) => {
    if (codeResolve) {
        codeResolve(req.query.code);
        res.send(htmlPage(`
            <h2>Готово!</h2>
            <p>Вы успешно вошли. Подождите пару секунд...</p>
            <script>setTimeout(() => { window.location.href = '/chats'; }, 3000);</script>
        `));
    } else {
        res.redirect("/");
    }
});

app.get("/chats", async (req, res) => {
    if (!client || !client.connected) return res.send(htmlPage(`<h2>Ошибка</h2><p>Нужно <a href="/">авторизоваться</a></p>`));
    
    const dialogs = await client.getDialogs({});
    let list = dialogs.map(d => `<li class="chat-item"><b>${d.title}</b></li>`).join("");
    
    res.send(htmlPage(`
        <h2>Ваши чаты</h2>
        <ul style="padding:0">${list}</ul>
        <button onclick="window.location.href='/'">Выход</button>
    `));
});

app.listen(port, () => console.log(`Server running on port ${port}`));