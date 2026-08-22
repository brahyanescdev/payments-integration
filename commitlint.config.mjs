export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scopes mirror the workspace layout so history stays greppable per area.
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'shared', 'e2e', 'infra', 'ci', 'docs', 'deps', 'repo'],
    ],
  },
};
