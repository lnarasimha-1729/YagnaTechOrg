class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const errorHandler = (err, req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) {
        console.error(err);
    } else if (status >= 400) {
        // Log 4xx with path so client-side toasts can be correlated with the
        // backend error. Keep it concise — full stack only for 5xx above.
        console.warn(`[${status}] ${req.method} ${req.originalUrl} — ${err.message}`);
    }
    res.status(status).json({ error: err.message || 'Server error' });
};

module.exports = { HttpError, asyncHandler, errorHandler };
