import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const domGlobals = [
  'document',
  'window',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'alert',
  'requestAnimationFrame',
].map((name) => ({
  name,
  message: 'Game logic must not depend on the DOM or browser APIs.',
}));

const htmlInjectionMessage =
  'Build elements with createElement/textContent instead of HTML strings.';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: htmlInjectionMessage },
        { property: 'outerHTML', message: htmlInjectionMessage },
        { property: 'insertAdjacentHTML', message: htmlInjectionMessage },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: htmlInjectionMessage,
        },
        {
          selector:
            'Literal[value=/^(innerHTML|outerHTML|insertAdjacentHTML)$/]',
          message: htmlInjectionMessage,
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Pure game logic: no classes, no DOM, no browser globals.
    files: ['src/core/**/*.ts', 'src/game/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...domGlobals],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration, ClassExpression',
          message: 'Game logic is written as pure functions, not classes.',
        },
        {
          selector:
            'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: htmlInjectionMessage,
        },
        {
          selector:
            'Literal[value=/^(innerHTML|outerHTML|insertAdjacentHTML)$/]',
          message: htmlInjectionMessage,
        },
      ],
    },
  },
  {
    // The config itself mentions the restricted names as strings.
    files: ['eslint.config.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
);
