# 🚀 Quick Start: Get Dashboard Running

## 3 Simple Steps

### 1. Start Docker Services
```bash
pnpm up
```
This starts Postgres, MinIO, Redis, and Temporal.

### 2. Start API Server
```bash
pnpm api
```
Wait for: `🚀 API running at http://localhost:4000`

### 3. Start Web Server (in a new terminal)
```bash
pnpm web
```
Wait for: `Ready on http://localhost:3000`

## ✅ Open Dashboard

**http://localhost:3000/dashboard**

That's it! You should see the dashboard (empty if no submissions yet).

## 🧪 Test It

Upload a .eml file:
```bash
curl -X POST http://localhost:4000/email-intake/test/upload-eml \
  -F "file=@/path/to/your/submission.eml"
```

Then refresh the dashboard to see it!

## 🔧 If Something's Wrong

**Dashboard shows error:**
- Check API is running: `curl http://localhost:4000/email-intake/submissions`
- Check browser console (F12) for errors

**API won't start:**
- Make sure Docker is running: `docker ps`
- Check database: `cd apps/api && pnpm prisma:migrate`

**Database errors:**
- Ensure migrations applied: `cd apps/api && pnpm prisma:migrate`

---

**That's all you need!** Both servers running = dashboard works! 🎉

