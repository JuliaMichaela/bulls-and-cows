import { createElement } from './ui/dom.js';

const RULES =
  'The computer picks a secret number made of unique digits. After each ' +
  'guess you get bulls (right digit in the right place) and cows (right ' +
  'digit in the wrong place). Find the number in as few attempts as you can.';

const app = createElement(
  'main',
  { className: 'app' },
  createElement('h1', { text: 'Bulls and Cows' }),
  createElement('p', { className: 'rules', text: RULES }),
);

document.body.append(app);
