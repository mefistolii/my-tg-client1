const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

// Берем ключи из переменных окружения
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const session = new StringSession(""); 

let client;
let codeResolve;

app.get("/", (req, res) => {
    res.send("<h1>Клиент запущен!</h1><p>Шаг 1: Введите в строке браузера: /login?phone=ВАШ_НОМЕР</p>");
});

app.get("/login", async (req, res) => {
    const phone = req.query.phone;
    if (!phone) return res.send("Ошибка: введите номер телефона");

    client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
    
    await client.start({
        phoneNumber: async () => phone,
        phoneCode: async () => {
            return new Promise((resolve) => { codeResolve = resolve; });
        },
        onError: (err) => console.log(err),
    });
    res.send("Авторизация успешна! Теперь вы можете управлять аккаунтом через API.");
});

app.get("/submit-code", (req, res) => {
    const code = req.query.code;
    if (codeResolve) {
        codeResolve(code);
        res.send("Код принят, проверяйте вкладку с логином!");
    } else {
        res.send("Сначала отправьте номер через /login");
    }
});

app.listen(port, () => console.log(`Сайт на порту ${port}`));