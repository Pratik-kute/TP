const http = require('http');

async function test(email, password, expectedStatus, label) {
  const body = JSON.stringify({ email, password });
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-api-key': 'v1-secret-tp-main-7f8a2b3c4d5e6f9g0h1i2j3k4l5m6n7o'
    }
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`--- ${label} ---`);
        console.log(`Status: ${res.statusCode}`);
        try {
          console.log(`Body: ${JSON.stringify(JSON.parse(data), null, 2)}`);
        } catch (e) {
          console.log(`Body: ${data}`);
        }
        console.log(`Expected Status: ${expectedStatus}`);
        console.log(res.statusCode === expectedStatus ? 'PASS' : 'FAIL');
        resolve(res.statusCode === expectedStatus);
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}

async function run() {
  const a = await test('pratikkute04@gmail.com', '123456', 200, 'Test A: Correct Credentials');
  const b = await test('pratikkute04@gmail.com', 'wrong', 401, 'Test B: Wrong Password');
  const c = await test('nobody@example.com', 'x', 401, 'Test C: Non-existent User');
  const d = await test('rahul@bizzfly.com', 'Asset#2026', 403, 'Test D: Non-auditor');
  
  if (a && b && c && d) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run();
