import { buildApp } from './app.js';
import assert from 'assert';

async function runTests() {
  // Bỏ qua lỗi schema nếu có, mock env để test
  process.env.ALLOWED_ORIGINS = 'https://frontend.example.com';
  
  const app = await buildApp();
  
  try {
    console.log("Running D-02.03 CSRF Fixtures...");

    // D-02.03-POS
    let res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'origin': 'https://frontend.example.com',
        'x-ott-request': '1'
      },
      payload: { username: "fake", password: "fake" }
    });
    console.log(`D-02.03-POS: HTTP ${res.statusCode} (Expected: pass CSRF, get 401/400/200 depending on auth logic but NOT 403 CSRF)`);
    assert(res.statusCode !== 403, "POS test failed, got 403");

    // D-02.03-NEG1: wrong origin
    res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'origin': 'https://evil.com',
        'x-ott-request': '1'
      }
    });
    console.log(`D-02.03-NEG1: HTTP ${res.statusCode} (Expected: 403 Origin/Referer not allowed)`);
    assert(res.statusCode === 403, "NEG1 test failed");

    // D-02.03-NEG2: null origin
    res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'origin': 'null',
        'x-ott-request': '1'
      }
    });
    console.log(`D-02.03-NEG2: HTTP ${res.statusCode} (Expected: 403 Origin/Referer not allowed)`);
    assert(res.statusCode === 403, "NEG2 test failed");

    // D-02.03-NEG3: no origin/referer
    res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'x-ott-request': '1'
      }
    });
    console.log(`D-02.03-NEG3: HTTP ${res.statusCode} (Expected: 403 Missing Origin and Referer)`);
    assert(res.statusCode === 403, "NEG3 test failed");

    // D-02.03-NEG4: no X-OTT-Request
    res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'origin': 'https://frontend.example.com'
      }
    });
    console.log(`D-02.03-NEG4: HTTP ${res.statusCode} (Expected: 403 Invalid X-OTT-Request header)`);
    assert(res.statusCode === 403, "NEG4 test failed");

    // D-02.01-NEG1: forged token
    res = await app.inject({
      method: 'POST',
      url: '/room/create',
      headers: {
        'origin': 'https://frontend.example.com',
        'x-ott-request': '1',
        'cookie': 'session=forged-token-abc'
      }
    });
    console.log(`D-02.01-NEG1: HTTP ${res.statusCode} (Expected: 401 FATAL_SESSION)`);
    assert(res.statusCode === 401, "Token forge test failed");

    console.log("ALL TESTS PASS");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await app.close();
  }
}

runTests();
