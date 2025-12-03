import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

const TestComponent = ({ message }: { message: string }) => (
  <div>
    <h1>Hello</h1>
    <p>{message}</p>
  </div>
);

describe('UI Test Infrastructure', () => {
  it('should render react components', () => {
    render(<TestComponent message="World" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });
});
