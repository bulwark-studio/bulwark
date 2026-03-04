const crypto = require("crypto");

function generateTOTPSecret() {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, "0");
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
}

function base32Decode(encoded) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of encoded.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret, timeStep = 30, digits = 6) {
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(time, 4);
  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}

function verifyTOTP(secret, token, window = 1) {
  const timeStep = 30;
  const now = Math.floor(Date.now() / 1000 / timeStep);
  for (let i = -window; i <= window; i++) {
    const time = now + i;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(time, 4);
    const key = base32Decode(secret);
    const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
    if (code.toString().padStart(6, "0") === token) return true;
  }
  return false;
}

function getTOTPUri(secret, username, issuer = "ChesterDevMonitor") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { generateTOTPSecret, verifyTOTP, getTOTPUri };
