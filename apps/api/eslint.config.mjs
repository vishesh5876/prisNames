import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    rules: {
      // NestJS uses empty classes for modules
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
