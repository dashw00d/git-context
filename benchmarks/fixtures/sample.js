/**
 * Sample JavaScript file for hybrid augmentation testing
 * This file contains both semantic symbols (functions) and CST elements (comments)
 */

/**
 * Main function with JSDoc comment
 * @param {string} name - The name parameter
 * @returns {string} A greeting message
 */
function greet(name) {
  return `Hello, ${name}!`;
}

// Inline comment explaining the next function
const calculateSum = (a, b) => {
  // Add two numbers
  return a + b;
};

/**
 * Class with method and doc comment
 */
class Calculator {
  /**
   * Multiply two numbers
   * @param {number} x - First number
   * @param {number} y - Second number
   * @returns {number} Product of x and y
   */
  multiply(x, y) {
    return x * y;
  }
}

// Export the functions
module.exports = { greet, calculateSum, Calculator };

