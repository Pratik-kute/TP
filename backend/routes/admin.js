const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

// GET /admin/inspect-user?email=<email>
router.get('/inspect-user', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, role, is_active, password, password_hash')
      .eq('email', email.toLowerCase().trim())
      .limit(1);

    if (error) throw error;

    if (!users || users.length === 0) {
      return res.json({ found: false });
    }

    const user = users[0];
    return res.json({
      found: true,
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: !!user.is_active,
      has_password: !!user.password,
      has_password_hash: !!user.password_hash
    });
  } catch (err) {
    console.error('Inspect error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
