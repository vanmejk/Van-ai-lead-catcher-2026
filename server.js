import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({limit:"100kb"}));
app.use(express.static(path.join(__dirname,"public")));

const db = new Database(process.env.DB_FILE || "leads.db");
db.exec(`CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, phone TEXT, email TEXT, message TEXT NOT NULL,
  ai_reply TEXT, intent TEXT, urgency TEXT, score INTEGER,
  status TEXT DEFAULT 'new', created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

const client = process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null;

function fallback(message,name){
  const m=message.toLowerCase();
  const urgent=/emergency|urgent|no heat|no heating|gas smell|flood|flooding|burst|danger|leak/.test(m);
  const quote=/quote|price|cost|estimate|how much/.test(m);
  const intent=quote?"Quote request":urgent?"Urgent repair":"General enquiry";
  const urgency=urgent?"High":"Normal";
  const score=urgent?92:quote?65:40;
  const reply=urgent
    ? `Hi ${name||"there"}, sorry you're having trouble. I've flagged your enquiry as high priority. The team will review it and contact you to confirm availability and the next steps.`
    : quote
    ? `Hi ${name||"there"}, thanks for getting in touch. I've captured your request for a quote and the team can follow up for any details or photos needed before pricing the work.`
    : `Hi ${name||"there"}, thanks for your message. I've passed your enquiry to the team and they can follow up with you shortly.`;
  return {reply,intent,urgency,score};
}

async function analyse(message,name){
  if(!client) return fallback(message,name);
  const response=await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input:[
      {role:"system",content:`You are the first-response AI for a local UK trade business. Be concise, friendly and never claim a booking or price is confirmed. Classify the enquiry and return ONLY valid JSON with keys reply,intent,urgency,score. urgency must be Low, Medium or High; score 0-100. If there is a possible safety emergency, tell the customer the business will review it urgently and advise appropriate emergency services when relevant.`},
      {role:"user",content:`Customer name: ${name||"Customer"}\nMessage: ${message}`}
    ]
  });
  const text=response.output_text.trim().replace(/^```json|```$/g,"").trim();
  return JSON.parse(text);
}

app.post("/api/leads", async (req,res)=>{
  try{
    const {name="",phone="",email="",message=""}=req.body||{};
    if(!message.trim()) return res.status(400).json({error:"Message is required"});
    const ai=await analyse(message.trim(),name.trim());
    const info=db.prepare(`INSERT INTO leads(name,phone,email,message,ai_reply,intent,urgency,score) VALUES(?,?,?,?,?,?,?,?)`)
      .run(name,phone,email,message,ai.reply,ai.intent,ai.urgency,ai.score);
    res.json({id:info.lastInsertRowid,...ai});
  }catch(e){console.error(e);res.status(500).json({error:"AI service error. Check server logs/API key."})}
});

app.get("/api/leads",(req,res)=>{
  res.json(db.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 100").all());
});

app.patch("/api/leads/:id",(req,res)=>{
  const status=req.body?.status;
  if(!["new","contacted","booked","closed"].includes(status)) return res.status(400).json({error:"Invalid status"});
  db.prepare("UPDATE leads SET status=? WHERE id=?").run(status,req.params.id);
  res.json({ok:true});
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Local AI Lead Catcher running on http://localhost:${port}`));
