# Local AI Lead Catcher — real AI starter

## What it does
1. Customer submits an enquiry.
2. Your server sends the message to the OpenAI API.
3. AI returns a tailored first response plus intent, urgency and lead score.
4. The lead is stored in SQLite.
5. Business dashboard shows incoming leads and lets you update status.

## Run it
Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env
```

Put your OpenAI API key in `.env`, then:

```bash
npm start
```

Open `http://localhost:3000`.

## Important
Never put the API key in the browser/frontend. It belongs in `.env` on the server.

This is a starter for a commercial service, not a finished production deployment. Before taking real customer data, add authentication, HTTPS, rate limiting, proper consent/privacy wording, backups, monitoring, and a proper production database/hosting setup.
