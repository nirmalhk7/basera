import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AreaSearch } from '@/components/research/AreaSearch';

describe('AreaSearch', () => {
  it('submits the selected supported search kind with the query', () => {
    const onSearch = vi.fn();
    render(<AreaSearch results={[]} source={null} isSearching={false} error={null} selectedArea={null} confirmedArea={null} hasSearched={false} onSearch={onSearch} onSelect={vi.fn()} onConfirm={vi.fn()} onCancel={vi.fn()} onEditBoundary={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Search kind'), { target: { value: 'ward' } });
    fireEvent.change(screen.getByLabelText('Search for an area'), { target: { value: 'Ward 12, Pune' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith('Ward 12, Pune', 'ward');
  });
});
