/**
 * Centralized error handler for the application
 * Provides user-friendly error messages and logs detailed errors
 */

// ======================= GENERIC ERROR HANDLER =======================

export const handleError = (error, context = 'Operation') => {
  // Log full error for developers
  console.error(`[${context}] Error:`, error);

  let userMessage = `${context} failed. Please try again.`;

  if (error?.message) {
    const message = error.message.toLowerCase();

    if (message.includes('duplicate') || message.includes('already exists')) {
      userMessage = 'This record already exists.';
    } else if (message.includes('not found')) {
      userMessage = 'The requested item was not found.';
    } else if (message.includes('network') || message.includes('fetch')) {
      userMessage = 'Network error. Please check your connection.';
    } else if (
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      userMessage = 'You do not have permission to perform this action.';
    } else if (
      message.includes('invalid') ||
      message.includes('malformed')
    ) {
      userMessage = 'Invalid data provided. Please check your input.';
    } else {
      userMessage = error.message;
    }
  }

  const userError = new Error(userMessage);
  userError.originalError = error;
  userError.context = context;

  return userError;
};

// ======================= SUPABASE ERROR HANDLER =======================

export const handleSupabaseError = (error, context = 'Database operation') => {
  console.error(`[Supabase ${context}] Error:`, error);

  let userMessage = `${context} failed. Please try again.`;

  if (error?.code) {
    switch (error.code) {
      case '23505': // Unique violation
        userMessage = 'This record already exists.';
        break;
      case '23503': // Foreign key violation
        userMessage = 'Referenced item does not exist.';
        break;
      case '42501': // Insufficient privilege
        userMessage = 'You do not have permission to perform this action.';
        break;
      case 'PGRST116': // No rows returned
        userMessage = 'Item not found.';
        break;
      default:
        userMessage = error.message || userMessage;
    }
  } else if (error?.message) {
    userMessage = error.message;
  }

  const userError = new Error(userMessage);
  userError.originalError = error;
  userError.context = context;
  userError.code = error?.code;

  return userError;
};

// ======================= AUTH ERROR HANDLER =======================

export const handleAuthError = (error, context = 'Authentication') => {
  console.error(`[Auth ${context}] Error:`, error);

  let userMessage = `${context} failed. Please try again.`;

  if (error?.message) {
    if (error.message.includes('Invalid login credentials')) {
      userMessage = 'Invalid email or password.';
    } else if (error.message.includes('Email not confirmed')) {
      userMessage = 'Please verify your email before signing in.';
    } else if (error.message.includes('User already registered')) {
      userMessage = 'This email is already registered.';
    } else if (error.message.includes('Password should be at least')) {
      userMessage = 'Password must be at least 6 characters.';
    } else if (error.message.includes('Invalid email')) {
      userMessage = 'Please enter a valid email address.';
    } else {
      userMessage = error.message;
    }
  }

  const userError = new Error(userMessage);
  userError.originalError = error;
  userError.context = context;

  return userError;
};

// ======================= LOGGING SERVICE =======================

export const logErrorToService = (error, context, userId = null) => {
  // Future-ready: Sentry, LogRocket, etc.
  console.error('[Error Service]', {
    context,
    userId,
    message: error?.message,
    stack: error?.stack,
    timestamp: new Date().toISOString()
  });
};

// ======================= USER ERROR FACTORY =======================

export const createUserError = (message, originalError = null, context = null) => {
  const error = new Error(message);
  error.isUserError = true;
  error.originalError = originalError;
  error.context = context;
  return error;
};

// ======================= DEFAULT EXPORT =======================

const errorHandler = {
  handleError,
  logErrorToService, // use the correctly defined function
  handleSupabaseError,
  handleAuthError,
  createUserError
};

export default errorHandler;
