import { expect, test } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import App from '../src/App';
import '@testing-library/jest-dom'

test('button increments count', async () => {
	const { getByText } = render(<App />);
	const button = getByText(/count is/i);
	expect(button).toHaveTextContent('count is 0');
	fireEvent.click(button);
	expect(button).toHaveTextContent('count is 1');
});