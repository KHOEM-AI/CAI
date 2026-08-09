const AppError = require('./AppError');

class ValidationError extends AppError {
  constructor(message = 'Invalid input data') {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

module.exports = {
  ValidationError,
  NotFoundError
};


