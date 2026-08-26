import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authService = {
  async login(email, password) {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },
  async forgotPassword(email) {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },
  async resetPasswordToken(token, newPassword) {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },
};

export const userService = {
  async getUsers() {
    const response = await apiClient.get('/users');
    return response.data;
  },
  async getUser(id) {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },
  async createUser(userData) {
    const response = await apiClient.post('/users', userData);
    return response.data;
  },
  async updateUser(id, userData) {
    const response = await apiClient.put(`/users/${id}`, userData);
    return response.data;
  },
  async updateStatus(id, isActive) {
    const response = await apiClient.put(`/users/${id}/status`, { isActive });
    return response.data;
  },
  async resetPassword(id, password) {
    const response = await apiClient.put(`/users/${id}/password`, { password });
    return response.data;
  },
  async deleteUser(id) {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },
  async importUsers(csvContent) {
    const response = await apiClient.post('/users/import', { csvContent });
    return response.data;
  },
};

export const roleService = {
  async getRoles() {
    const response = await apiClient.get('/roles');
    return response.data;
  },
};

export const requestService = {
  async createRequest(payload) {
    const response = await apiClient.post('/requests', payload);
    return response.data;
  },
  async addWorkUpdate(id, data) {
    const response = await apiClient.post(`/requests/${id}/work-update`, data);
    return response.data;
  },
  async fulfillRequest(id, data) {
    const response = await apiClient.put(`/requests/${id}/fulfill`, data);
    return response.data;
  },
  async closeRequest(id, data) {
    const response = await apiClient.put(`/requests/${id}/close`, data);
    return response.data;
  },
  async getMyRequests(userId) {
    const response = await apiClient.get('/requests', { params: { userId } });
    return response.data;
  },
  async getActionedRequests(userId) {
    const response = await apiClient.get('/requests/actioned', { params: { userId } });
    return response.data;
  },
  async getRequestDetails(id) {
    const response = await apiClient.get(`/requests/${id}`);
    return response.data;
  },
  async takeAction(id, actionData) {
    const response = await apiClient.post(`/requests/${id}/action`, actionData);
    return response.data;
  },
  async getCurrentStep(id) {
    const response = await apiClient.get(`/requests/${id}/current-step`);
    return response.data;
  },
};

export const adminConfigService = {
  async getCategories() {
    const response = await apiClient.get('/admin/config/categories');
    return response.data;
  },
  async createCategory(data) {
    const response = await apiClient.post('/admin/config/categories', data);
    return response.data;
  },
  async updateCategory(id, data) {
    const response = await apiClient.put(`/admin/config/categories/${id}`, data);
    return response.data;
  },
  async deleteCategory(id) {
    const response = await apiClient.delete(`/admin/config/categories/${id}`);
    return response.data;
  },
  async getWorkflow(categoryId) {
    const response = await apiClient.get(`/admin/config/workflows/${categoryId}`);
    return response.data;
  },
  async setWorkflow(categoryId, steps) {
    const response = await apiClient.post(`/admin/config/workflows/${categoryId}`, steps);
    return response.data;
  },
  async getServerConfig() {
    const response = await apiClient.get('/admin/config/server');
    return response.data;
  },
  async saveServerConfig(config) {
    const response = await apiClient.post('/admin/config/server', config);
    return response.data;
  },
  async syncLdapUsers() {
    const response = await apiClient.post('/admin/config/sync-ldap');
    return response.data;
  },
  async exportDatabaseBackup() {
    const response = await apiClient.get('/admin/config/backup');
    return response.data;
  },
  async restoreDatabaseBackup(backupData) {
    const response = await apiClient.post('/admin/config/restore', backupData);
    return response.data;
  },
};
