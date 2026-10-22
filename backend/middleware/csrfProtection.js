function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const hasCookieSession = req.headers.cookie?.includes("carepoint_session=");
  const bearerSession = req.get("authorization")?.startsWith("Bearer ");
  if (hasCookieSession && !bearerSession && req.get("x-carepoint-request") !== "1") {
    return res.status(403).json({ message: "Request verification failed" });
  }
  return next();
}

module.exports = csrfProtection;
