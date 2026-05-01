const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT} (Bound to ${HOST})`);
  console.log(`[backend] listening on port ${PORT}`);
  try {
    console.log(`[backend] supabase host: ${new URL(process.env.SUPABASE_URL).host}`);
  } catch (err) {
    console.log('[backend] supabase host: INVALID URL');
  }
});
