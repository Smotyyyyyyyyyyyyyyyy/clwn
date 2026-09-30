# Bot Discord — ghid pas cu pas (pentru începători)

Ce face botul:
- **Roluri VIP automate** (Plus / Pro / Ultra), când site-ul îl anunță că cineva a plătit
- **Moderare:** `/ban`, `/kick`, `/timeout`, `/untimeout`, `/clear` + anti-spam automat (invitații către alte servere, flood, mențiuni în masă)
- **Giveaway-uri:** `/giveaway start`, `/giveaway end` (cu buton „Enter")
- **Comenzi utile:** `/profile`, `/stats`, `/ping`
- **`/setup-info`:** postează în canalul `information` planurile VIP + butonul „Go to site"

---

## 1. Instalează Node.js
Descarcă versiunea **LTS** de la https://nodejs.org și instaleaz-o. Verifică în terminal: `node -v` (trebuie 18 sau mai mare).

## 2. Creează botul în Discord
1. Mergi la https://discord.com/developers/applications → **New Application** (pune numele platformei tale).
2. **Bot** (meniul din stânga):
   - **Reset Token** → copiază tokenul (îl pui în `.env`; **nu îl da nimănui**, cine îl are controlează botul).
   - Activează **Message Content Intent** (Privileged Gateway Intents) și salvează.
3. **General Information** → copiază **Application ID** (= `CLIENT_ID`).
4. **OAuth2 → URL Generator**: bifează scope-urile `bot` și `applications.commands`. La permisiuni bifează:
   Manage Roles, Kick Members, Ban Members, Moderate Members, Manage Messages, Send Messages, Embed Links, Read Message History, View Channels.
   Deschide linkul generat și adaugă botul în serverul tău.

## 3. Ia ID-urile
În Discord: **Setări → Advanced → Developer Mode** (pornit). Apoi click dreapta pe:
- server → **Copy Server ID** (= `GUILD_ID`)
- fiecare rol VIP (în Server Settings → Roles) → **Copy Role ID** (= `ROLE_PLUS_ID`, `ROLE_PRO_ID`, `ROLE_ULTRA_ID`)

**Important:** în Server Settings → Roles, trage rolul botului **deasupra** rolurilor Plus/Pro/Ultra și deasupra rolurilor pe care vrei să le modereze. Altfel botul nu poate da roluri sau bana.

## 4. Configurează
```
npm install
```
Copiază `.env.example` în `.env` (pe Windows: `copy .env.example .env`) și completează valorile.
Pentru `API_SECRET` pune un text lung și aleatoriu (30+ caractere).

Prețurile și avantajele le editezi în `src/config.js` (înlocuiește `X`, `Y`, `Z`).

## 5. Pornește
```
npm start          # pornește botul (înregistrează singur comenzile slash la fiecare pornire)
```
Apoi, în canalul `information`, scrie `/setup-info`.

## 6. Cum îl anunți de pe site că cineva a plătit
Când plata reușește (webhook de la Stripe / Lemon Squeezy / Paddle), serverul site-ului trimite:

```
POST https://adresa-botului:3000/vip
Header: x-api-secret: <API_SECRET>
Body (JSON): { "discordId": "123456789012345678", "plan": "pro" }
```

- `plan` poate fi `plus`, `pro`, `ultra` sau `none` (când expiră abonamentul → scoate rolul).
- Utilizatorul trebuie să fie în server, iar `discordId` îl obții când se loghează pe site cu Discord.
- Nu expune endpoint-ul fără HTTPS (pune-l în spatele unui reverse proxy, de ex. Caddy, Nginx sau Cloudflare Tunnel).

## 7. GitHub + Railway (hosting 24/7)

### A) Pune codul pe GitHub
1. Fă cont pe https://github.com și creează un repository **Private** (ex: `server-bot`).
2. Dezarhivează proiectul. Verifică să NU existe fișierul `.env` în ce urci (`.gitignore` îl exclude deja).
3. Instalează Git (https://git-scm.com), apoi în folderul proiectului:
```
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/USERNAME/server-bot.git
git push -u origin main
```
(Alternativ, pe GitHub: **Add file → Upload files** și tragi fișierele, fără `.env` și fără `node_modules`.)

### B) Deploy pe Railway
1. https://railway.com → **Login with GitHub**.
2. **New Project → Deploy from GitHub repo** → alegi repository-ul (dă acces Railway la el).
3. Railway detectează singur Node.js și rulează `npm start`.
4. Intră pe serviciu → **Variables** și adaugă (același conținut ca în `.env`):
   `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `SITE_URL`, `ROLE_PLUS_ID`, `ROLE_PRO_ID`, `ROLE_ULTRA_ID`, `API_SECRET`.
   **Nu adăuga `PORT`**, îl setează Railway.
5. **Volume** (important): adaugă un Volume serviciului și montează-l la `/app/data`.
   Fără el, giveaway-urile active se pierd la fiecare redeploy.
6. **Settings → Networking → Generate Domain**. Primești un URL de tip `https://ceva.up.railway.app`.
   Site-ul va apela `https://ceva.up.railway.app/vip` (are HTTPS gratis). Test rapid: deschide `/health` în browser.
7. Vezi **Logs**: trebuie să apară `Logged in as ...` și `Registered 10 slash commands.`

De acum, orice `git push` pe `main` redeploy-ează automat botul.

## 8. Alte variante de hosting
Botul trebuie să ruleze mereu. Variante: un VPS ieftin, Railway, Fly.io sau un mini-PC/Raspberry Pi acasă.
Pe un VPS poți folosi `pm2` (`npm i -g pm2` apoi `pm2 start src/index.js --name bot`).

## Siguranță
- Nu urca `.env` pe GitHub (e deja în `.gitignore`).
- Dacă tokenul a fost văzut de altcineva, dă **Reset Token** imediat.
- Dă rol de Administrator doar oamenilor de încredere.
