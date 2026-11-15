// @ts-check
// Where feedback goes (feedback/SETUP.md). FEEDBACK_ENDPOINT is the address of the Apps Script web app that receives it
// (it ends in /exec). It is not a secret: anyone can read it here, and all it can do is add a row to a sheet.
// If it is ever empty the feedback box still opens; Send then starts an email with the same details filled in.
export const FEEDBACK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz4m07GCKH5bQZvXE0XPUjqA5Nk87-8jTXkXYX0Fl3c1CIrUHsk4rixaUPybvNyxfx_lQ/exec';
// The address the fallback email goes to, and the one named in the box when a message cannot be sent.
export const FEEDBACK_EMAIL = 'contact@thenewforeignassistance.org';
