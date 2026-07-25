const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim();
};

module.exports = {
  isValidEmail,
  sanitizeInput
};
