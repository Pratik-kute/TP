const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'No token provided.' }
    });
  }

  const token = authHeader.split(' ')[1];

  if (token === process.env.API_KEY) {
    req.isApiKey = true;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.isApiKey = false;
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: 'TOKEN_EXPIRED', message: 'Session expired.' }
    });
  }
};

module.exports = authMiddleware;
