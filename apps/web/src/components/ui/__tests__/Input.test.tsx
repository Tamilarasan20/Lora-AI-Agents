import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input id="email" label="Email address" />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Email address')).toBeInTheDocument();
  });

  it('renders without label when not provided', () => {
    render(<Input id="email" placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<Input id="email" label="Email" error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('applies error styling when error is set', () => {
    render(<Input id="email" label="Email" error="Error" />);
    const input = screen.getByLabelText('Email');
    expect(input.className).toContain('border-red');
  });

  it('calls onChange when user types', () => {
    const handler = jest.fn();
    render(<Input id="name" label="Name" onChange={handler} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'John' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('passes through placeholder', () => {
    render(<Input id="q" placeholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders password type input', () => {
    render(<Input id="pw" label="Password" type="password" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
