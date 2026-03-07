# Hostinger VPS Production Setup

## 1. Base packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx redis-server git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2. Clone and install backend
```bash
cd /var/www
sudo mkdir -p vehicle-management-backend
sudo chown -R $USER:$USER vehicle-management-backend
cd vehicle-management-backend
git clone <YOUR_BACKEND_REPO_URL> .
npm ci --omit=dev
```

## 3. Environment variables (`.env`)
Set at minimum:
- `MONGO_URI=...`
- `JWT_SECRET=...`
- `REDIS_URL=redis://127.0.0.1:6379` (or managed Redis URL)
- `SCHEDULER_TIMEZONE=America/Chicago` (Alabama)
- `CORS_ORIGINS=https://admin.yourdomain.com`

## 4. Run API + scheduler with PM2
This repo includes `ecosystem.config.js`:
- `vm-api-1` on `5000`
- `vm-api-2` on `5001`
- `vm-scheduler` as dedicated scheduler process

Start:
```bash
cd /var/www/vehicle-management-backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Check:
```bash
pm2 status
pm2 logs vm-api-1 --lines 100
pm2 logs vm-scheduler --lines 100
```

## 5. Nginx reverse proxy + static admin frontend
Copy config shipped in this repo:
```bash
sudo cp /var/www/vehicle-management-backend/nginx.vehicle-management.conf /etc/nginx/sites-available/vehicle-management
sudo ln -s /etc/nginx/sites-available/vehicle-management /etc/nginx/sites-enabled/vehicle-management
sudo nginx -t
sudo systemctl reload nginx
```

If default site conflicts:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl reload nginx
```

## 6. SSL (Let’s Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d admin.yourdomain.com
```

## 7. Admin frontend deploy (same VPS)
```bash
# Example target used by nginx config:
sudo mkdir -p /var/www/vehicle-management-admin/dist
# Copy your frontend build output to this folder
```

## 8. Update deployment command (after git pull)
```bash
cd /var/www/vehicle-management-backend
git pull
npm ci --omit=dev
pm2 reload ecosystem.config.js --update-env
```

## Notes
- Scheduler runs only in `vm-scheduler` process (industry-standard separation).
- API processes do not run scheduler (`RUN_SCHEDULER_IN_API=false`).
- Nginx uses `ip_hash` for sticky behavior, safer with Socket.IO polling.
