export default {
  extends: ['@commitlint/config-conventional'],
  // Safely ignore validation for version release commits
  ignores: [(message) => /^v?\d+\.\d+\.\d+/.test(message)],
};
