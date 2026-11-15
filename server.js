require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT || 3000);
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET wajib diisi dengan string acak minimal 32 karakter.");
  process.exit(1);
}
if (!ADMIN_HASH && !ADMIN_PASSWORD) {
  console.error("Isi ADMIN_PASSWORD atau ADMIN_PASSWORD_HASH di Secrets server.");
  process.exit(1);
}

const db = new Database(path.join(__dirname, "damares-gila.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL,
 balance REAL NOT NULL DEFAULT 10000,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market (
 id INTEGER PRIMARY KEY CHECK(id=1),
 price REAL NOT NULL,
 direction TEXT NOT NULL DEFAULT 'sideways',
 speed REAL NOT NULL DEFAULT 1,
 paused INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS candles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 time INTEGER NOT NULL UNIQUE,
 open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS positions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 side TEXT NOT NULL CHECK(side IN ('BUY','SELL')),
 lot REAL NOT NULL,
 entry_price REAL NOT NULL,
 opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status TEXT NOT NULL DEFAULT 'OPEN',
 close_price REAL,
 pnl REAL
);
CREATE TABLE IF NOT EXISTS trade_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 side TEXT NOT NULL, lot REAL NOT NULL, entry_price REAL NOT NULL,
 close_price REAL NOT NULL, pnl REAL NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS redemptions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 reward TEXT NOT NULL, cost INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
const now = Math.floor(Date.now()/1000);
db.prepare("INSERT OR IGNORE INTO market(id,price,direction,speed,paused,updated_at) VALUES(1,1000,'sideways',1,0,?)").run(now);

const getMarket = () => db.prepare("SELECT * FROM market WHERE id=1").get();
const getUser = id => db.prepare("SELECT id,username,balance,created_at FROM users WHERE id=?").get(id);
const sessionMiddleware = session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: __dirname }),
  secret: process.env.SESSION_SECRET,
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7*24*60*60*1000 }
});
app.use(express.json({limit:"20kb"}));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname,"public")));
app.use("/api/auth", rateLimit({windowMs:15*60*1000, max:30, standardHeaders:true, legacyHeaders:false}));

const requireUser = (req,res,next) => req.session.userId ? next() : res.status(401).json({error:"Silakan login terlebih dahulu."});
const requireAdmin = (req,res,next) => req.session.isAdmin ? next() : res.status(401).json({error:"Akses admin diperlukan."});
const usernameOK = s => typeof s==="string" && /^[a-zA-Z0-9_]{3,18}$/.test(s);
const numberOK = (n,min,max) => Number.isFinite(Number(n)) && Number(n)>=min && Number(n)<=max;

app.post("/api/auth/register", async (req,res) => {
  const {username,password} = req.body || {};
  if (!usernameOK(username)) return res.status(400).json({error:"Username 3–18 karakter, hanya huruf, angka, dan _."});
  if (typeof password!=="string" || password.length<8 || password.length>72) return res.status(400).json({error:"Password harus 8–72 karakter."});
  try {
    const hash = await bcrypt.hash(password,12);
    const info = db.prepare("INSERT INTO users(username,password_hash,balance) VALUES(?,?,10000)").run(username,hash);
    req.session.userId = Number(info.lastInsertRowid);
    res.json({user:getUser(req.session.userId)});
  } catch(e) { res.status(409).json({error:"Username sudah dipakai."}); }
});
app.post("/api/auth/login", async (req,res) => {
  const {username,password} = req.body || {};
  const u = db.prepare("SELECT * FROM users WHERE username=?").get(String(username||""));
  if (!u || !(await bcrypt.compare(String(password||""),u.password_hash))) return res.status(401).json({error:"Username atau password salah."});
  req.session.regenerate(err => {
    if(err) return res.status(500).json({error:"Gagal membuat sesi."});
    req.session.userId = u.id;
    res.json({user:getUser(u.id)});
  });
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",requireUser,(req,res)=>res.json({user:getUser(req.session.userId)}));

app.get("/api/market",(req,res)=>{
  const m=getMarket();
  const candles=db.prepare("SELECT time,open,high,low,close FROM candles ORDER BY time DESC LIMIT 120").all().reverse();
  res.json({market:m,candles});
});
app.get("/api/portfolio",requireUser,(req,res)=>{
  const uid=req.session.userId;
  res.json({
    user:getUser(uid),
    positions:db.prepare("SELECT * FROM positions WHERE user_id=? AND status='OPEN' ORDER BY id DESC").all(uid),
    history:db.prepare("SELECT * FROM trade_history WHERE user_id=? ORDER BY id DESC LIMIT 50").all(uid)
  });
});
app.post("/api/trade/open",requireUser,(req,res)=>{
  const {side,lot}=req.body||{};
  if(!["BUY","SELL"].includes(side) || !numberOK(lot,0.01,100)) return res.status(400).json({error:"Pilih BUY/SELL dan lot 0.01–100."});
  const m=getMarket(); if(m.paused) return res.status(400).json({error:"Market sedang dijeda admin."});
  const info=db.prepare("INSERT INTO positions(user_id,side,lot,entry_price) VALUES(?,?,?,?)").run(req.session.userId,side,Number(lot),m.price);
  res.json({ok:true,id:Number(info.lastInsertRowid),price:m.price});
});
app.post("/api/trade/close",requireUser,(req,res)=>{
  const id=Number(req.body?.id), uid=req.session.userId, m=getMarket();
  const p=db.prepare("SELECT * FROM positions WHERE id=? AND user_id=? AND status='OPEN'").get(id,uid);
  if(!p) return res.status(404).json({error:"Posisi tidak ditemukan."});
  const pnl=(m.price-p.entry_price)*p.lot*(p.side==="BUY"?1:-1);
  const tx=db.transaction(()=>{
    db.prepare("UPDATE positions SET status='CLOSED',close_price=?,pnl=? WHERE id=?").run(m.price,pnl,id);
    db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(pnl,uid);
    db.prepare("INSERT INTO trade_history(user_id,side,lot,entry_price,close_price,pnl) VALUES(?,?,?,?,?,?)").run(uid,p.side,p.lot,p.entry_price,m.price,pnl);
  }); tx();
  res.json({ok:true,pnl,balance:getUser(uid).balance});
});

app.get("/api/shop",requireUser,(req,res)=>{
  res.json({rewards:[
    {id:"dana500",name:"Saldo DANA Rp500",cost:100000},
    {id:"dana1000",name:"Saldo DANA Rp1.000",cost:200000},
    {id:"shirt",name:"T-shirt DAMARES GILA",cost:1000000}
  ],requests:db.prepare("SELECT * FROM redemptions WHERE user_id=? ORDER BY id DESC").all(req.session.userId)});
});
app.post("/api/shop/redeem",requireUser,(req,res)=>{
  const rewards={dana500:{name:"Saldo DANA Rp500",cost:100000},dana1000:{name:"Saldo DANA Rp1.000",cost:200000},shirt:{name:"T-shirt DAMARES GILA",cost:1000000}};
  const r=rewards[req.body?.reward], uid=req.session.userId;
  if(!r) return res.status(400).json({error:"Hadiah tidak dikenal."});
  const u=getUser(uid);
  if(u.balance<r.cost) return res.status(400).json({error:"Saldo BRAY belum cukup."});
  const tx=db.transaction(()=>{
    db.prepare("UPDATE users SET balance=balance-? WHERE id=?").run(r.cost,uid);
    const x=db.prepare("INSERT INTO redemptions(user_id,reward,cost) VALUES(?,?,?)").run(r.name,r.cost);
    return Number(x.lastInsertRowid);
  });
  const id=tx();
  res.json({ok:true,id,reward:r.name,cost:r.cost,whatsapp:"https://wa.me/6285775708819?text="+encodeURIComponent(`Halo admin DAMARES GILA, saya mengajukan penukaran #${id}: ${r.name}. Username: ${u.username}. Mohon arahan verifikasi.`)});
});

app.post("/api/admin/login",rateLimit({windowMs:15*60*1000,max:10}),async(req,res)=>{
  const {username,password}=req.body||{};
  const validAdminPassword = ADMIN_HASH
    ? await bcrypt.compare(String(password||""), ADMIN_HASH)
    : String(password||"") === ADMIN_PASSWORD;
  if(username!==ADMIN_USERNAME || !validAdminPassword) return res.status(401).json({error:"Login admin salah."});
  req.session.regenerate(err=>{
    if(err) return res.status(500).json({error:"Gagal membuat sesi."});
    req.session.isAdmin=true; res.json({ok:true});
  });
});
app.post("/api/admin/logout",requireAdmin,(req,res)=>{req.session.isAdmin=false;res.json({ok:true});});
app.get("/api/admin/overview",requireAdmin,(req,res)=>{
  res.json({
    market:getMarket(),
    players:db.prepare("SELECT id,username,balance,created_at FROM users ORDER BY id DESC LIMIT 200").all(),
    redemptions:db.prepare("SELECT r.*,u.username FROM redemptions r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 100").all()
  });
});
app.post("/api/admin/market",requireAdmin,(req,res)=>{
  const {action,value,direction,speed}=req.body||{};
  const m=getMarket();
  if(action==="setPrice" && numberOK(value,0.01,100000000)) db.prepare("UPDATE market SET price=?,updated_at=? WHERE id=1").run(Number(value),Math.floor(Date.now()/1000));
  else if(action==="move" && numberOK(value,0.01,1000000)) db.prepare("UPDATE market SET price=MAX(0.01,price+?),updated_at=? WHERE id=1").run(Number(value)*(direction==="down"?-1:1),Math.floor(Date.now()/1000));
  else if(action==="spike" && numberOK(value,0.01,1000000)) db.prepare("UPDATE market SET price=MAX(0.01,price+?),updated_at=? WHERE id=1").run(Number(value)*(direction==="down"?-1:1),Math.floor(Date.now()/1000));
  else if(action==="direction" && ["up","down","sideways"].includes(direction)) db.prepare("UPDATE market SET direction=? WHERE id=1").run(direction);
  else if(action==="speed" && numberOK(speed,0,100)) db.prepare("UPDATE market SET speed=? WHERE id=1").run(Number(speed));
  else if(action==="pause") db.prepare("UPDATE market SET paused=1-paused WHERE id=1").run();
  else return res.status(400).json({error:"Perintah market tidak valid."});
  io.emit("market",getMarket()); res.json({market:getMarket()});
});
app.post("/api/admin/redemption",requireAdmin,(req,res)=>{
  const {id,status}=req.body||{};
  if(!["FULFILLED","REJECTED"].includes(status)) return res.status(400).json({error:"Status tidak valid."});
  const r=db.prepare("SELECT * FROM redemptions WHERE id=?").get(Number(id));
  if(!r) return res.status(404).json({error:"Permintaan tidak ditemukan."});
  const tx=db.transaction(()=>{
    db.prepare("UPDATE redemptions SET status=? WHERE id=?").run(status,id);
    if(status==="REJECTED") db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(r.cost,r.user_id);
  }); tx(); res.json({ok:true});
});

const ioSession = (socket,next)=>sessionMiddleware(socket.request,{},next);
io.use(ioSession);
io.on("connection",socket=>socket.emit("market",getMarket()));

// Satu market bersama. Server terus menjalankannya walau semua pemain menutup browser,
// selama proses server tetap hidup.
let candle = null;
function tick(){
  const m=getMarket();
  const t=Math.floor(Date.now()/60)*60;
  if(!m.paused && m.speed>0){
    const drift=m.direction==="up"?1:m.direction==="down"?-1:0;
    const noise=(Math.random()-0.5)*2;
    const delta=(drift*0.12+noise*0.35)*m.speed;
    const next=Math.max(0.01,m.price+delta);
    db.prepare("UPDATE market SET price=?,updated_at=? WHERE id=1").run(next,Math.floor(Date.now()/1000));
  }
  const price=getMarket().price;
  const last=db.prepare("SELECT * FROM candles ORDER BY time DESC LIMIT 1").get();
  if(!last || last.time!==t){
    db.prepare("INSERT OR IGNORE INTO candles(time,open,high,low,close) VALUES(?,?,?,?,?)").run(t,price,price,price,price);
  } else {
    db.prepare("UPDATE candles SET high=MAX(high,?),low=MIN(low,?),close=? WHERE time=?").run(price,price,price,t);
  }
  db.prepare("DELETE FROM candles WHERE time < ?").run(t-60*60*24*7);
  io.emit("market",getMarket());
}
setInterval(tick,1000);
tick();

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public/admin.html")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public/index.html")));
server.listen(PORT,"0.0.0.0",()=>console.log(`DAMARES GILA aktif di port ${PORT}`));
