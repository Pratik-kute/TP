require('dotenv').config();
const { API_KEY, PORT } = process.env;
const args = process.argv.slice(2);

async function run() {
  const path = args.find(a => !a.startsWith('-'));
  const isPost = args.includes('--post');
  const bodyArg = args.indexOf('--body');
  const body = bodyArg !== -1 ? args[bodyArg + 1] : null;
  const tokenArg = args.indexOf('--token');
  const token = tokenArg !== -1 ? args[tokenArg + 1] : null;

  if (!path) {
    console.error('Usage: node test-api.js <path> [--post] [--body \'<json>\'] [--token <jwt>]');
    process.exit(1);
  }

  const url = `http://localhost:${PORT || 4000}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  console.log(`[test-api] ${isPost ? 'POST' : 'GET'} ${url}`);
  
  try {
    const fetchOptions = {
      method: isPost ? 'POST' : 'GET',
      headers
    };
    if (isPost && body) fetchOptions.body = body;

    const res = await fetch(url, fetchOptions);

    console.log(`Status: ${res.status}`);
    const headersObj = {};
    res.headers.forEach((v, k) => { headersObj[k] = v; });
    console.log('Headers:', JSON.stringify(headersObj, null, 2));
    
    const text = await res.text();
    try {
      console.log('Body:', JSON.stringify(JSON.parse(text), null, 2));
    } catch (e) {
      console.log('Body:', text);
    }

    process.exit(res.ok ? 0 : 1);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
