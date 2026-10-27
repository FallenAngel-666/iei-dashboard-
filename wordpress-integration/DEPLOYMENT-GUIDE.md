# IEI TVLC Staff Administration and Analytics Portal
## Institutional Deployment & WordPress Integration Architecture Guide

**Institution:** The Institution of Engineers (India) - Tiruvallur Local Centre (IEI TVLC)  
**Reference Website:** [https://ieitvlc.org/](https://ieitvlc.org/)  
**Document Classification:** Confidential / Institutional IT Operations  

---

### 1. Executive Summary & Core Isolation Principle

As specified in Requirement 9 of the institutional charter:
> *"Prepare the application for deployment on institution-approved infrastructure. Investigate the existing WordPress and hosting setup before selecting the integration method. Keep the application isolated from WordPress core files. Do not modify the live website or publish the application without administrator approval."*

The IEI TVLC Staff Administration and Analytics Portal is architected as an **independent, secure Node.js service** that functions either on a dedicated subdomain (`portal.ieitvlc.org`), via an isolated reverse proxy path (`https://ieitvlc.org/staff-portal/`), or embedded within password-protected WordPress pages using the provided shortcode plugin `[iei_tvlc_portal]`.

This guarantees:
1. **Zero modifications to WordPress core files** (`wp-config.php`, `wp-includes`, and `wp-admin` remain strictly untouched).
2. **Zero risk of PHP memory exhaustion or database locks** on the production public website.
3. **Independent upgrade cycles**: Portal upgrades, data migrations, or certificate updates occur without interrupting the live institutional website.

---

### 2. Deployment Architectures

#### Option A: Dedicated Subdomain (Recommended for High Security)
Deploy the Node.js application to run on `portal.ieitvlc.org` or `admin.ieitvlc.org`:

```
Internet Request (HTTPS)
       │
       ▼
Cloudflare / DNS (portal.ieitvlc.org)
       │
       ▼
Nginx / Apache Reverse Proxy (Port 443 with Let's Encrypt SSL)
       │
       ▼ (Reverse Proxy HTTP :3000)
Node.js Application Server (server.js, PM2 process manager)
       │
       ▼
Persistent Atomic Relational Store (`data/portal_database.json`)
```

#### Option B: Same-Origin Subdirectory via Reverse Proxy
If the institution wishes to expose the portal under `https://ieitvlc.org/staff-portal/`:

**Nginx Configuration:**
```nginx
# Add inside the existing server block for ieitvlc.org (DO NOT touch WordPress rules)
location /staff-portal/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 90;
}
```

**Apache Configuration (`.htaccess` or VirtualHost):**
```apache
<IfModule mod_proxy.c>
    ProxyPreserveHost On
    ProxyPass /staff-portal http://127.0.0.1:3000/
    ProxyPassReverse /staff-portal http://127.0.0.1:3000/
</IfModule>
```

---

### 3. WordPress Plugin Installation (Zero Core Modification)

1. Create a zip archive containing the plugin file:
   - Target directory: `wp-content/plugins/iei-tvlc-portal-integration/`
   - File: `iei-tvlc-portal-wp-integration.php`
2. Log into the WordPress Admin dashboard as an Administrator.
3. Navigate to **Plugins > Add New > Upload Plugin** and select the zip file.
4. Click **Activate Plugin**.
5. Navigate to **Settings > IEI TVLC Portal**:
   - Set the **Portal Service URL** to `https://portal.ieitvlc.org` (or `http://localhost:3000` during staging).
   - Enter the **SSO Shared Secret** matching `JWT_SECRET` in `src/config.js`.
   - Click **Save Settings**.
6. Create or edit a WordPress page (e.g., `ieitvlc.org/staff-portal`):
   - Set page visibility to **Password Protected** or restrict to logged-in Staff members.
   - Insert the shortcode:
     ```
     [iei_tvlc_portal height="950px"]
     ```
   - Publish the page.

---

### 4. Process Supervision with PM2

To ensure 99.99% institutional uptime with automatic restart on reboots or exceptions:

```bash
# Install PM2 globally
npm install -g pm2

# Start the portal under PM2
cd /var/www/iei-tvlc-admin-portal
pm2 start server.js --name "iei-tvlc-portal"

# Save PM2 state for automatic startup on system reboot
pm2 save
pm2 startup
```

---

### 5. Production Environment Variables (`.env`)

```ini
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
JWT_SECRET=super_secret_institutional_key_replace_in_prod
COOKIE_NAME=iei_tvlc_token
```

---

### 6. Institutional Security & Data Backup Checklist

* **Nightly Backups:** Set up a cron task to archive the `data/` and `uploads/` directories:
  ```bash
  0 2 * * * tar -czf /backups/iei_tvlc_data_$(date +\%F).tar.gz /var/www/iei-tvlc-admin-portal/data /var/www/iei-tvlc-admin-portal/uploads
  ```
* **Read-Only Auditor Access:** Ensure external auditors only receive `auditor` credentials, which grants read-only analytics visibility without permission to modify chapters or events.
