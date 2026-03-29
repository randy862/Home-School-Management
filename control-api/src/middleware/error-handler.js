function errorHandler(error, _req, res, _next) {
  res.status(error.statusCode || 500).json({ error: error.message || "Unexpected error." });
}

module.exports = {
  errorHandler
};
