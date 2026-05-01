import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardContent, CardHeader } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><div>Card content</div></Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-card">Content</Card>);
    expect(container.firstChild).toHaveClass('custom-card');
  });

  it('has default border and background styles', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border');
    expect(card.className).toContain('bg-white');
  });
});

describe('CardContent', () => {
  it('renders children with padding', () => {
    render(<CardContent>Inner content</CardContent>);
    expect(screen.getByText('Inner content')).toBeInTheDocument();
  });

  it('applies additional className', () => {
    const { container } = render(<CardContent className="extra">Content</CardContent>);
    expect(container.firstChild).toHaveClass('extra');
  });
});

describe('CardHeader', () => {
  it('renders header content', () => {
    render(<CardHeader><h2>Header Title</h2></CardHeader>);
    expect(screen.getByText('Header Title')).toBeInTheDocument();
  });
});

describe('Card composition', () => {
  it('renders Card with Header and Content together', () => {
    render(
      <Card>
        <CardHeader><h2>Title</h2></CardHeader>
        <CardContent>Body text</CardContent>
      </Card>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });
});
