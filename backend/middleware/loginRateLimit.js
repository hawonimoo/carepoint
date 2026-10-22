const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map();

function loginRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  if (attempts.size >= 10000) {
    for (const [attemptIp, attempt] of attempts) {
      if (attempt.resetAt <= now) attempts.delete(attemptIp);
    }
  }
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    if (attempts.size >= 10000 && !current) {
      res.set("Retry-After", String(Math.ceil(WINDOW_MS / 1000)));
      return res.status(429).json({ message: "Login capacity is temporarily limited. Try again later." });
    }
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    req.clearLoginRateLimit = () => attempts.delete(key);
    return next();
  }

  if (current.count >= MAX_ATTEMPTS) {
    res.set("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
    return res.status(429).json({ message: "Too many login attempts. Try again later." });
  }

  current.count += 1;
  req.clearLoginRateLimit = () => attempts.delete(key);
  return next();
}

loginRateLimit.clear = (ip) => attempts.delete(ip);
module.exports = loginRateLimit;
