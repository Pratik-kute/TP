const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key']
}));

app.use(express.json());

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/assets', require('./routes/assets'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/activity', require('./routes/activity'));
app.use('/api/v1/reference', require('./routes/reference'));
app.use('/api/v1/maintenance', require('./routes/maintenance'));
app.use('/api/v1', require('./routes/maintenance'));
app.use('/api/v1', require('./routes/repairs'));
app.use('/api/v1', require('./routes/audit'));
app.use('/api/v1', require('./routes/recovery'));
app.use('/admin', require('./routes/admin'));

app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

module.exports = app;
