-- Seed data for Enterprise Request & Approval Workflow Engine

-- 1. Ensure Roles exist (they are in schema.sql, but we'll be explicit)
-- Roles: 1: Requestor, 2: Approver, 3: IT Agent, 4: Admin Agent, 5: Super Admin

-- 2. Seed Users
-- We use a temporary table or just direct inserts. 
-- Since we need manager_id, we do it in steps.

INSERT INTO users (full_name, email, department, role_id, auth_source) 
VALUES ('Super Admin User', 'admin@company.com', 'IT', 5, 'Local');

-- Get the ID of the Super Admin to use as manager for others if needed
-- But for simplicity in a seed script, we can use subqueries.

INSERT INTO users (full_name, email, department, manager_id, role_id, auth_source) 
VALUES ('Finance Manager', 'finance_mgr@company.com', 'Finance', 
        (SELECT id FROM users WHERE email = 'admin@company.com'), 2, 'Local');

INSERT INTO users (full_name, email, department, manager_id, role_id, auth_source) 
VALUES ('IT Manager', 'it_mgr@company.com', 'IT', 
        (SELECT id FROM users WHERE email = 'admin@company.com'), 2, 'Local');

INSERT INTO users (full_name, email, department, manager_id, role_id, auth_source) 
VALUES ('Employee One', 'emp1@company.com', 'Sales', 
        (SELECT id FROM users WHERE email = 'finance_mgr@company.com'), 1, 'Local');

INSERT INTO users (full_name, email, department, manager_id, role_id, auth_source) 
VALUES ('Employee Two', 'emp2@company.com', 'IT', 
        (SELECT id FROM users WHERE email = 'it_mgr@company.com'), 1, 'Local');

-- 3. Seed Categories
INSERT INTO categories (name, parent_id) VALUES ('IT Hardware', NULL);
INSERT INTO categories (name, parent_id) VALUES ('Software', NULL);
INSERT INTO categories (name, parent_id) VALUES ('Office Supplies', NULL);

-- Sub-categories for IT Hardware
INSERT INTO categories (name, parent_id) VALUES ('Laptop', (SELECT id FROM categories WHERE name = 'IT Hardware'));
INSERT INTO categories (name, parent_id) VALUES ('Monitor', (SELECT id FROM categories WHERE name = 'IT Hardware'));
INSERT INTO categories (name, parent_id) VALUES ('Keyboard/Mouse', (SELECT id FROM categories WHERE name = 'IT Hardware'));

-- Sub-categories for Software
INSERT INTO categories (name, parent_id) VALUES ('IDE License', (SELECT id FROM categories WHERE name = 'Software'));
INSERT INTO categories (name, parent_id) VALUES ('Cloud Subscription', (SELECT id FROM categories WHERE name = 'Software'));

-- 4. Seed a basic Workflow for 'Laptop'
-- Step 1: Manager (Approver)
-- Step 2: Finance (Approver)
-- Step 3: IT Agent (Fulfillment)

INSERT INTO workflow_steps (category_id, step_order, approver_role_id, min_cost_threshold, is_mandatory)
VALUES 
((SELECT id FROM categories WHERE name = 'Laptop'), 1, 2, 0, TRUE),
((SELECT id FROM categories WHERE name = 'Laptop'), 2, 2, 1000, TRUE),
((SELECT id FROM categories WHERE name = 'Laptop'), 3, 3, 0, TRUE);
