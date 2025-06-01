/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Ensure this line is correct
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'), // If you use form-specific styling often
    // require('@tailwindcss/aspect-ratio'), // For aspect ratio utilities if needed for images/videos
  ],
}