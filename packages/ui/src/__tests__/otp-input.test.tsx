/**
 * OtpInput component tests.
 *
 * Covers: digit typing, paste, backspace, arrow navigation,
 * auto-focus advance, onComplete callback, disabled state,
 * accessible labels.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpInput } from '../components/otp-input';

describe('OtpInput', () => {
  it('renders correct number of inputs', () => {
    render(<OtpInput />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('renders custom length', () => {
    render(<OtpInput length={4} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });

  it('each input has accessible label', () => {
    render(<OtpInput />);
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Digit ${i}`)).toBeInTheDocument();
    }
  });

  it('has group role with "Verification code" label', () => {
    render(<OtpInput />);
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument();
  });

  it('calls onChange when digit is typed', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput onChange={handleChange} />);

    const firstInput = screen.getByLabelText('Digit 1');
    await user.click(firstInput);
    await user.keyboard('5');

    expect(handleChange).toHaveBeenCalledWith(expect.stringContaining('5'));
  });

  it('advances focus on typing a digit', async () => {
    const user = userEvent.setup();
    render(<OtpInput onChange={() => {}} />);

    const firstInput = screen.getByLabelText('Digit 1');
    await user.click(firstInput);
    await user.keyboard('1');

    // Focus should now be on digit 2
    expect(screen.getByLabelText('Digit 2')).toHaveFocus();
  });

  it('handles backspace: clears current digit', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput value="123456" onChange={handleChange} />);

    const thirdInput = screen.getByLabelText('Digit 3');
    await user.click(thirdInput);
    await user.keyboard('{Backspace}');

    // Should clear digit 3 (result: "12" + "" + "456" → joined as "12456" then padded)
    expect(handleChange).toHaveBeenCalledWith('12456');
  });

  it('handles backspace on empty digit: moves to previous', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput value="12" onChange={handleChange} />);

    const thirdInput = screen.getByLabelText('Digit 3');
    await user.click(thirdInput);
    await user.keyboard('{Backspace}');

    // Should move focus to digit 2 and clear it
    expect(screen.getByLabelText('Digit 2')).toHaveFocus();
  });

  it('handles paste of full code', async () => {
    const handleChange = vi.fn();
    const handleComplete = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput onChange={handleChange} onComplete={handleComplete} />);

    const firstInput = screen.getByLabelText('Digit 1');
    await user.click(firstInput);

    // Paste a 6-digit code
    await user.paste('123456');

    expect(handleChange).toHaveBeenCalledWith('123456');
    expect(handleComplete).toHaveBeenCalledWith('123456');
  });

  it('strips non-digit characters from paste', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<OtpInput onChange={handleChange} />);

    const firstInput = screen.getByLabelText('Digit 1');
    await user.click(firstInput);
    await user.paste('12ab34');

    // Should only keep digits: 1234
    expect(handleChange).toHaveBeenCalledWith(expect.stringMatching(/^1234/));
  });

  it('handles arrow key navigation', async () => {
    const user = userEvent.setup();
    render(<OtpInput value="12" onChange={() => {}} />);

    const secondInput = screen.getByLabelText('Digit 2');
    await user.click(secondInput);
    await user.keyboard('{ArrowLeft}');

    expect(screen.getByLabelText('Digit 1')).toHaveFocus();
  });

  it('calls onComplete when all digits are filled', async () => {
    const handleComplete = vi.fn();
    const user = userEvent.setup();

    // Start with 5 digits
    render(<OtpInput value="12345" onChange={() => {}} onComplete={handleComplete} />);

    const sixthInput = screen.getByLabelText('Digit 6');
    await user.click(sixthInput);
    await user.keyboard('6');

    expect(handleComplete).toHaveBeenCalledWith('123456');
  });

  it('disables all inputs when disabled', () => {
    render(<OtpInput disabled />);
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it('renders with inputMode="numeric"', () => {
    render(<OtpInput />);
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('inputmode', 'numeric');
    });
  });
});
