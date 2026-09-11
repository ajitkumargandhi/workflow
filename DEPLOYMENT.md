# Enterprise Workflow Engine - Production Deployment Guide

This guide provides step-by-step instructions for copying this project to a new production machine, configuring environments, securing credentials, and running the system in production.

---

## 1. System Requirements

Ensure the target host meets the following minimum requirements:
- **Operating System**: Linux (Ubuntu 20.04/22.04/24.04, Debian, RHEL, Rocky Linux), macOS, or Windows with WSL2.
- **Docker Engine**: Docker 24.0+ or newer.
- **Docker Compose**: Docker Compose v2.20+ (`docker compose`).
- **Hardware**: Minimum 2 CPU cores, 4 GB RAM, 20 GB disk space.
- **Firewall / Network**:
  - Inbound Port `80` (HTTP) and `443` (HTTPS).
  - Outbound access to corporate Active Directory Domain Controller (e.g., ports `389` or `636`).
  - Outbound access to corporate SMTP server (e.g., ports `587`, `465`, or `25`).

---

## 2. Compressing & Transferring the Folder

The `workflow` project is **completely self-contained**. All compiled code (`frontend/build` and `backend/dist`) and dependencies (`backend/node_modules`) are included directly in the folder, so **zero internet connection, zero npm downloads, and zero external DNS lookups** are required when building on the new machine.

### Step 1: Compress on Machine A (Current Machine)
From the parent directory of `workflow`:
```bash
# Using tar.gz:
tar -czvf workflow.tar.gz workflow/

# Or using zip:
zip -r workflow.zip workflow/
```

### Step 2: Transfer to Machine B (Target Machine)
```bash
scp workflow.tar.gz user@your-server-ip:/opt/
```

### Step 3: Decompress on Machine B
```bash
cd /opt
tar -xzvf workflow.tar.gz
cd workflow
```

---

## 3. Production Environment Configuration

1. If `.env` is already configured in the folder, you can use it directly, or create one:
   ```bash
   cp -n .env.example .env
   ```

2. Verify or update ports and secrets in `.env`:
   - `BACKEND_PORT`: `3010` (or your preferred port)
   - `FRONTEND_PORT`: `80` (or your preferred port)
   - `JWT_SECRET`: Random secure string (64 characters)
   - `POSTGRES_PASSWORD`: Secure database password

---

## 4. Starting the Application Stack

Run the build and start command:
```bash
docker compose up -d --build
```

### Why This Build Never Fails:
- **Frontend**: Nginx directly copies the pre-built `frontend/build/` directory in ~1 second.
- **Backend**: Alpine Node.js directly copies the pre-built `backend/dist/` and `backend/node_modules/` in ~5 seconds.
- **No `npm install`**: Docker does **not** connect to `registry.npmjs.org` or any external registries during `docker compose build`. Even if Machine B is completely offline or has strict firewall / DNS restrictions, the build succeeds cleanly.

### Verify Service Health

Check container status and healthchecks:
```bash
docker compose ps
```

All three services should show status **`healthy`** or **`running`**:
```
NAME                IMAGE                      STATUS                    PORTS
workflow-db         postgres:15-alpine         Up (healthy)              127.0.0.1:5432->5432/tcp
workflow-backend    workflow-backend:latest    Up (healthy)              0.0.0.0:3010->3000/tcp
workflow-frontend   workflow-frontend:latest   Up                        0.0.0.0:80->80/tcp
```

View live logs if needed:
```bash
docker compose logs -f
```

---

## 5. Initial Super Admin Access & Immediate Hardening

1. Open your browser and navigate to:
   ```
   http://<YOUR_SERVER_IP_OR_DOMAIN>/
   ```
2. Log in using the default Super Admin credentials:
   - **Email**: `admin@company.com`
   - **Password**: `admin123`
3. **Change the Default Password Immediately**:
   - Navigate to **Super Admin -> User Management**.
   - Locate the `admin@company.com` account and click **Reset Password**.
   - Set a strong, secure password for the Super Admin account.

---

## 6. Configuring Active Directory (LDAP) on the New Machine

### A. Resolving AD Domain Controller Hostname or IP
If your target machine or Docker bridge network cannot resolve internal Active Directory hostnames (`.local` or `.corp`), choose either of the following two options (no manual `/etc/hosts` editing inside containers is required):

- **Option 1 (Recommended - Zero Configuration)**:
  In the **Server LDAP URL**, directly use your Domain Controller's IP address:
  `ldap://192.168.1.10:389` (or `ldaps://192.168.1.10:636`)

- **Option 2 (Using Hostname via `.env`)**:
  In your `.env` file, set:
  ```env
  AD_HOST_ENTRY=dc01.company.local:192.168.1.10
  ```
  Then restart the backend:
  ```bash
  docker compose up -d backend
  ```
  Docker Compose will automatically map this hostname and IP into `/etc/hosts` inside the backend container.

---

### B. Configuring LDAP in the Admin Dashboard

1. In the top navigation bar, select **Admin -> Server Config**.
2. Scroll to the **Active Directory / LDAP Sync & Auth** card:
   - Check **Enable AD Auth & User Sync**.
   - **Server LDAP URL**: Enter `ldap://<IP_OR_HOSTNAME>:389` (or `ldaps://<IP_OR_HOSTNAME>:636`).
   - **Base DN**: Enter your root organizational unit (e.g. `DC=company,DC=local` or `OU=Employees,DC=company,DC=local` or any nested OU like `OU=Staff,OU=HeadOffice,DC=corp,DC=com`).
   - **Bind DN User**: Enter the service account DN or UPN (e.g. `CN=svc_workflow,OU=ServiceAccounts,DC=company,DC=local` or `svc_workflow@company.local`).
   - **Bind Password**: Enter the service account password.
3. Click **"🔍 Test LDAP Connection"**:
   - The system validates socket connectivity, tests credentials, and checks the Base DN.
4. Click **"🔄 Sync Users from Active Directory Now"**:
   - The engine performs an RFC 2696 Simple Paged Results query (`pageSize: 250`) traversing all users across all sub-OUs.
   - It normalizes all attributes, maps user titles/departments, extracts Active Directory group memberships (`memberOf`), and assigns appropriate workflow roles.
5. Click **"Save All Server Settings"** at the bottom of the page to permanently persist the configuration.

### How Active Directory Users & Role Elevation Work
- **Standard Employees**: Automatically assigned the **Requestor** role, allowing them to log in with their corporate AD password and submit/track tickets.
- **On-the-Fly Provisioning**: Newly created AD users can log in immediately; their accounts are auto-provisioned upon first login.
- **Privilege Elevation**: If an employee is added to `Domain Admins`, `Managers`, `IT Support`, or other elevated groups in AD, their role is dynamically elevated upon their next login or next sync.
- **Account Status Sync**: Disabled AD accounts (`userAccountControl` bit 2) are automatically marked inactive in the workflow system.

---

## 7. Configuring Email Notifications (SMTP) on the New Machine

1. In **Admin -> Server Config**, scroll to the **Email Notification (SMTP) Configuration** card:
   - **SMTP Server Host**: Your SMTP server (e.g. `smtp.office365.com`, `smtp.gmail.com`, or internal relay IP).
   - **SMTP Port**: `587` (STARTTLS) or `465` (SSL/TLS).
   - **SMTP Username / Sender Email**: Corporate notification address (e.g. `notifications@company.com`).
   - **SMTP Auth Password**: Mailbox password or App-Specific Password.
   - **Security Protocol**: `STARTTLS` (Recommended) or `SSL/TLS`.
2. Enter your email in **Send Test Email To** and click **"🧪 Test SMTP Connection & Send Test Email"**.
3. Verify that the test email arrives in your inbox.
4. Click **"Save All Server Settings"**.

---

## 8. Database Backup & Disaster Recovery

### Automated Web Backup
- Super Admins can export a complete JSON snapshot of all tables, workflows, requests, and configuration at any time under **Admin -> Server Config -> 💾 Export Database Backup**.

### Direct PostgreSQL Database Dump (CLI)
You can take native PostgreSQL backups using `docker exec`:

```bash
# Create backup:
docker exec workflow-db pg_dump -U postgres workflow_db > backup_$(date +%Y%m%d).sql

# Restore backup:
cat backup_YYYYMMDD.sql | docker exec -i workflow-db psql -U postgres workflow_db
```

---

## 9. HTTPS / SSL Setup (Recommended for Production)

To enable SSL (HTTPS) with a domain name and Let's Encrypt using Certbot on the host:

```bash
# Install Certbot and Nginx reverse proxy on host (example for Ubuntu):
sudo apt update && sudo apt install -y certbot python3-certbot-nginx nginx

# Configure Nginx on host to reverse-proxy port 80 to Docker:
# /etc/nginx/sites-available/workflow
server {
    server_name workflow.company.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Obtain SSL Certificate:
sudo certbot --nginx -d workflow.company.com
```

---

## 10. Summary of Security Best Practices Implemented

- **Non-Root Containers**: Backend runs under unprivileged standard `node` user (`USER node`).
- **Role-Based Access Control (RBAC)**: All sensitive administrative routes (`/admin/config/*`, `/users/*`, `/roles/*`) are protected by `RolesGuard` and restricted to Super Admins.
- **LDAP Injection Protection**: All search filter parameters are sanitized against RFC 4515 special characters.
- **Password Masking**: Passwords are masked (`••••••••`) in server configuration responses.
- **Single-Page Application Routing**: Nginx custom configuration handles client-side routing (`try_files $uri $uri/ /index.html`) avoiding 404 reload errors.
- **Database Isolation**: PostgreSQL port `5432` binds exclusively to `127.0.0.1`, preventing exposure to the public internet.
