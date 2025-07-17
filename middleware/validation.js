const { body, param, validationResult } = require('express-validator');

// Common validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Validation rules for different endpoints
const validateIssueDidRequest = [
  body('age').isInt({ min: 0, max: 120 }).withMessage('Age must be between 0 and 120'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('nationality').trim().isLength({ min: 2, max: 50 }).withMessage('Nationality must be between 2 and 50 characters'),
  body('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  validate
];

const validateProofRequest = [
  body('proof').isObject().withMessage('Proof must be an object'),
  body('proof.merkleRoot').isString().withMessage('Merkle root must be a string'),
  body('proof.nullifierHash').isString().withMessage('Nullifier hash must be a string'),
  body('proof.ageVerified').isBoolean().withMessage('Age verified must be a boolean'),
  body('proof.timestamp').isInt({ min: 0 }).withMessage('Timestamp must be a positive integer'),
  body('metadata').isObject().withMessage('Metadata must be an object'),
  body('metadata.userAddress').isEthereumAddress().withMessage('Invalid user address'),
  body('service').isIn(['voting', 'alcohol', 'gambling']).withMessage('Invalid service type'),
  validate
];

const validateUserAddress = [
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  validate
];

const validateService = [
  param('service').isIn(['voting', 'alcohol', 'gambling']).withMessage('Invalid service type'),
  validate
];

const validateRevokeAccess = [
  body('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  body('service').isIn(['voting', 'alcohol', 'gambling']).withMessage('Invalid service type'),
  validate
];

module.exports = {
  validateIssueDidRequest,
  validateProofRequest,
  validateUserAddress,
  validateService,
  validateRevokeAccess,
  validate
};