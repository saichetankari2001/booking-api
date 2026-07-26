import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../../src/App';

describe('App', () => {
  it('renders the real home page at /', async () => {
    render(<App />);
    expect(await screen.findByText('Reserve a table')).toBeInTheDocument();
  });
});
