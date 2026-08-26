-- Database Schema for Enterprise Request & Approval Workflow Engine

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (id, role_name) VALUES 
(1, 'Requestor'), 
(2, 'Approver'), 
(3, 'IT Agent'), 
(4, 'Admin Agent'), 
(5, 'Super Admin')
ON CONFLICT (id) DO UPDATE SET role_name = EXCLUDED.role_name;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    department VARCHAR(100),
    manager_id UUID REFERENCES users(id),
    role_id INTEGER REFERENCES roles(id),
    external_id VARCHAR(255),
    auth_source VARCHAR(20) CHECK (auth_source IN ('Local', 'AD')) DEFAULT 'Local',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. Requests Table
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id VARCHAR(50) UNIQUE NOT NULL,
    requestor_id UUID REFERENCES users(id),
    designated_manager_id UUID REFERENCES users(id),
    category_id INTEGER REFERENCES categories(id),
    status VARCHAR(20) CHECK (status IN ('Pending', 'Approved', 'In Progress', 'Rejected', 'SentBack', 'Fulfilled', 'Closed')) DEFAULT 'Pending',
    total_cost DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    fulfillment_type VARCHAR(30) DEFAULT 'New Purchase',
    justification TEXT,
    urgency VARCHAR(20) CHECK (urgency IN ('Low', 'Medium', 'High', 'Critical')),
    fulfillment_notes TEXT,
    assigned_agent_id UUID REFERENCES users(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Request Fields Table (Dynamic Form Data)
CREATE TABLE IF NOT EXISTS request_fields (
    id SERIAL PRIMARY KEY,
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    field_value TEXT
);

-- 6. Request Attachments Table
CREATE TABLE IF NOT EXISTS request_attachments (
    id SERIAL PRIMARY KEY,
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_type VARCHAR(50),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Request Work Updates Table (Progress Notes by Support Agents)
CREATE TABLE IF NOT EXISTS request_updates (
    id SERIAL PRIMARY KEY,
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES users(id),
    status VARCHAR(20),
    note TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Workflow Steps Table
CREATE TABLE IF NOT EXISTS workflow_steps (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    approver_role_id INTEGER REFERENCES roles(id),
    min_cost_threshold DECIMAL(12, 2) DEFAULT 0,
    is_mandatory BOOLEAN DEFAULT TRUE,
    UNIQUE(category_id, step_order)
);

-- 10. Approval Logs Table
CREATE TABLE IF NOT EXISTS approval_logs (
    id SERIAL PRIMARY KEY,
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES users(id),
    action VARCHAR(20) CHECK (action IN ('Approve', 'Reject', 'SendBack')),
    comments TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Server Configuration Table
CREATE TABLE IF NOT EXISTS server_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    system_name VARCHAR(255) DEFAULT 'Enterprise Workflow Engine',
    session_timeout INTEGER DEFAULT 60,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    ldap_enabled BOOLEAN DEFAULT TRUE,
    ldap_url VARCHAR(255) DEFAULT 'ldap://ad.company.local:389',
    ldap_base_dn VARCHAR(255) DEFAULT 'DC=company,DC=local',
    ldap_bind_dn VARCHAR(255) DEFAULT 'CN=Admin,DC=company,DC=local',
    ldap_bind_password VARCHAR(255) DEFAULT 'Secret123',
    smtp_host VARCHAR(255) DEFAULT 'smtp.company.com',
    smtp_port INTEGER DEFAULT 587,
    smtp_user VARCHAR(255) DEFAULT 'notifications@company.com',
    smtp_password VARCHAR(255) DEFAULT 'SmtpSecret123',
    smtp_protocol VARCHAR(20) DEFAULT 'STARTTLS'
);

INSERT INTO server_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_requests_tracking_id ON requests(tracking_id);
CREATE INDEX IF NOT EXISTS idx_requests_requestor ON requests(requestor_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_request ON approval_logs(request_id);

-- Default Password hash for 'admin123': $2b$10$0MLqd7ktJD3KGAsQ1S0LJeI/T8hENYPFU1b2/syb0UlXSLSUEcY2O

-- Seed Users
INSERT INTO users (id, full_name, email, password, department, role_id, auth_source, is_active)
VALUES 
('11111111-1111-1111-1111-111111111111', 'Super Admin User', 'admin@company.com', '$2b$10$0MLqd7ktJD3KGAsQ1S0LJeI/T8hENYPFU1b2/syb0UlXSLSUEcY2O', 'IT Administration', 5, 'Local', TRUE),
('22222222-2222-2222-2222-222222222222', 'Department Manager', 'manager@company.com', '$2b$10$0MLqd7ktJD3KGAsQ1S0LJeI/T8hENYPFU1b2/syb0UlXSLSUEcY2O', 'Operations', 2, 'Local', TRUE),
('33333333-3333-3333-3333-333333333333', 'IT Support Agent', 'support@company.com', '$2b$10$0MLqd7ktJD3KGAsQ1S0LJeI/T8hENYPFU1b2/syb0UlXSLSUEcY2O', 'IT Support', 3, 'Local', TRUE),
('55555555-5555-5555-5555-555555555555', 'Office Admin Agent', 'office_admin@company.com', '$2b$10$0MLqd7ktJD3KGAsQ1S0LJeI/T8hENYPFU1b2/syb0UlXSLSUEcY2O', 'Office Administration', 4, 'Local', TRUE)
ON CONFLICT (email) DO UPDATE SET 
password = EXCLUDED.password, 
role_id = EXCLUDED.role_id,
is_active = TRUE;

INSERT INTO users (id, full_name, email, password, department, manager_id, role_id, auth_source, is_active)
VALUES 
('44444444-4444-4444-4444-444444444444', 'John Employee', 'employee@company.com', '$2b$10$0MLqd7ktJD3KGAsQ1S0LJeI/T8hENYPFU1b2/syb0UlXSLSUEcY2O', 'Operations', '22222222-2222-2222-2222-222222222222', 1, 'Local', TRUE)
ON CONFLICT (email) DO UPDATE SET 
password = EXCLUDED.password, 
manager_id = EXCLUDED.manager_id,
role_id = EXCLUDED.role_id,
is_active = TRUE;

-- Seed Primary Categories
INSERT INTO categories (id, name, parent_id, is_active) VALUES
(1, 'IT Assets', NULL, TRUE),
(2, 'IT Support', NULL, TRUE),
(3, 'Office Admin Request', NULL, TRUE),
(4, 'Office Admin Support', NULL, TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed Secondary Sub-Categories
INSERT INTO categories (id, name, parent_id, is_active) VALUES
(10, 'Laptop', 1, TRUE),
(11, 'Monitor', 1, TRUE),
(12, 'Desktop PC', 1, TRUE),
(13, 'Keyboard & Mouse', 1, TRUE),
(20, 'Software License', 2, TRUE),
(21, 'Network & VPN Access', 2, TRUE),
(22, 'Email / Account Issue', 2, TRUE),
(30, 'Business Cards', 3, TRUE),
(31, 'Desk Allocation', 3, TRUE),
(32, 'Office Supplies', 3, TRUE),
(40, 'Facilities Maintenance', 4, TRUE),
(41, 'Air Conditioning / AC', 4, TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;

-- Reset Category Sequence
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- Seed Workflow Steps
-- Category 10 (Laptop): Step 1: Line Manager (Role 2), Step 2: HOD (Role 5, Cost > $500), Step 3: IT Agent (Role 3)
INSERT INTO workflow_steps (category_id, step_order, approver_role_id, min_cost_threshold, is_mandatory) VALUES
(10, 1, 2, 0, TRUE),
(10, 2, 5, 500, TRUE),
(10, 3, 3, 0, TRUE),
-- Category 20 (Software License): Step 1: Line Manager (Role 2), Step 2: IT Agent (Role 3)
(20, 1, 2, 0, TRUE),
(20, 2, 3, 0, TRUE),
-- Category 30 (Business Cards): Step 1: Line Manager (Role 2), Step 2: Admin Agent (Role 4)
(30, 1, 2, 0, TRUE),
(30, 2, 4, 0, TRUE),
-- Category 40 (Facilities Maintenance): Step 1: Admin Agent (Role 4)
(40, 1, 4, 0, TRUE)
ON CONFLICT (category_id, step_order) DO UPDATE SET approver_role_id = EXCLUDED.approver_role_id, min_cost_threshold = EXCLUDED.min_cost_threshold;
