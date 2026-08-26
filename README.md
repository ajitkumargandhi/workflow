# ⚡ Enterprise Workflow Engine & Multi-Tier Request Portal

A production-ready, dockerized Enterprise Request & Approval Engine built with **React**, **NestJS (TypeScript)**, and **PostgreSQL**. Features multi-tiered approval workflows, role-based queue separation, multi-currency support, asset re-issue handling, Active Directory (LDAP) synchronization, SMTP email configuration, dynamic history filtering, and Super Admin database backup & disaster recovery.

---

## 🚀 Quick Start (Deploy on Any Machine with Docker)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### Step-by-Step Deployment
1. **Extract Project Archive**:
   Extract the project ZIP folder on your target machine.

2. **Navigate into the Project Folder**:
   ```bash
   cd workflow
   ```

3. **Start the Entire Application Stack**:
   ```bash
   docker compose up -d --build
   ```

4. **Access the Portal**:
   Open your browser and visit:
   - **Web Portal**: [http://localhost](http://localhost) (or `http://<your-server-ip>`)
   - **Backend API**: [http://localhost:3000](http://localhost:3000)

---

## 🔑 Default Test Credentials

All accounts use the default password: `admin123`

| User Role | Email | Default Password | Description |
| :--- | :--- | :--- | :--- |
| 👑 **Super Admin** | `admin@company.com` | `admin123` | Full enterprise control, database backup/restore, user management, AD/SMTP config |
| 👔 **Department Manager** | `manager@company.com` | `admin123` | Approves/Rejects/Sends back team requests |
| 💻 **IT Support Agent** | `support@company.com` | `admin123` | Handles IT Assets, Laptops, Software Licenses & IT Queue |
| 🏢 **Office Admin Agent** | `office_admin@company.com` | `admin123` | Handles Office Admin, Facilities, Desks & Business Cards |
| 👤 **Employee (Requestor)** | `employee@company.com` | `admin123` | Submits requests, tracks status & action history |

---

## 🛡️ Production Go-Live Checklist

When transitioning from testing/evaluation to your production live server environment:

1. **🔐 Change Default Passwords**:
   - Log into the portal as `Super Admin` (`admin@company.com`) and update default passwords for all seeded accounts via **User Management** (`/admin/users`) or the password reset option.

2. **🔑 Set Custom Environment Secrets**:
   - In `docker-compose.yml` (or via a `.env` file on your production server), set your own custom JWT secret and database password:
     ```yaml
     environment:
       - JWT_SECRET=YourSuperStrongCustomProductionSecretKey2026!
       - DB_PASSWORD=YourSecurePostgresDBPassword
     ```

3. **📧 Configure Enterprise SMTP & AD/LDAP**:
   - Go to **Server Config** (`/admin/server`) to plug in your production SMTP email server (for automated notifications) and Active Directory domain details.

4. **🔒 Enable HTTPS (SSL)**:
   - Use an SSL reverse proxy (such as Nginx, Caddy, or Cloudflare) in front of Docker Port `80` to secure all traffic with `https://`.

5. **💾 Disaster Recovery**:
   - Use the built-in **Database Backup & Restore** tool in the Super Admin panel (`/admin/server`) to take periodic snapshot backups of your live database.

---

## ✨ Key Capabilities & System Features

### 1. 🔄 Dynamic Multi-Step Workflow Engine
- **Hierarchy-Aware Routing**: Requests route automatically to the requestor's designated manager or custom selected manager.
- **Cost-Threshold Routing**: Configurable threshold approvals (e.g. requests > $500 route to HOD/Super Admin).
- **Actions Supported**: Approve, Reject, or Send Back with mandatory feedback comments.

### 2. 🛡️ Role-Based Queue Separation (IT vs. Office Admin)
- **IT Support Queue**: IT Agents (`IT Support Agent`) only view and act on IT categories (Laptop, Desktop, Software Licenses, Network/VPN).
- **Office Admin Queue**: Office Admin Agents (`Office Admin Agent`) handle non-IT categories (Business Cards, Facilities, Desk Allocation, Office Supplies).
- **Asset Re-issue Option**: Support agents can fulfill requests via existing asset re-issue (zero cost) or new purchases.

### 3. 🌐 Multi-Currency Support
- Choose currency per request: `USD ($)`, `EUR (€)`, `GBP (£)`, `INR (₹)`, `AED (د.إ)`, `CAD ($)`, `AUD ($)`, `SGD ($)`.

### 4. 📊 Advanced Request History & Multi-Filtering
- **Date Filtering**: All Dates, Today, Last 7 Days, Last 30 Days, or Custom Date Picker (`From Date` - `To Date`).
- **Category & Status Filtering**: Filter by primary/secondary request type and real-time status.
- **Timeline Audit Drawer**: Complete historical logs including approval comments and fulfillment progress notes.

### 5. 💾 Super Admin Database Backup & Disaster Recovery
- **Snapshot Export**: Download full database snapshot (`.json`) including users, categories, workflows, requests, and logs.
- **Transactional Restoration**: Restore database state safely from any backup file.

### 6. 🔐 Active Directory / LDAP & Email SMTP Configuration
- Configure LDAP URL, Base DN, Bind User, and execute live user synchronization.
- Configure SMTP Server Host, Port, Protocols (STARTTLS, SSL/TLS), and User Credentials.
- Bulk User Import via CSV and Forgot Password reset links.

---

## 🛠️ Architecture & Tech Stack

```
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │  React Frontend │ ────> │ NestJS Backend  │ ────> │ PostgreSQL DB   │
 │   (Port 80)     │       │   (Port 3000)   │       │   (Port 5432)   │
 └─────────────────┘       └─────────────────┘       └─────────────────┘
```

- **Frontend**: React 18, React Router v6, Axios, Vanilla CSS Design Tokens
- **Backend**: NestJS, TypeORM, TypeScript, Bcrypt, JWT Authentication
- **Database**: PostgreSQL 15 (Containerized with persistent volumes)

---

## 🛑 Management Commands

- **View Container Logs**:
  ```bash
  docker compose logs -f
  ```
- **Stop Containers**:
  ```bash
  docker compose stop
  ```
- **Restart Stack**:
  ```bash
  docker compose restart
  ```
- **Reset Database and Clean Containers**:
  ```bash
  docker compose down -v && docker compose up -d --build
  ```
