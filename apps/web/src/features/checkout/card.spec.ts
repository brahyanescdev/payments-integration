import {
  detectCardBrand,
  formatCardNumber,
  isValidCardNumber,
  isValidCvc,
  isValidExpiry,
  onlyDigits,
} from './card';

// Real test-network numbers, structurally valid but never chargeable.
const VISA = '4242424242424242';
const MASTERCARD = '5555555555554444';
const AMEX = '378282246310005';

describe('detectCardBrand', () => {
  it('recognises VISA by its leading digit', () => {
    expect(detectCardBrand(VISA)).toBe('visa');
  });

  it('recognises Mastercard by its leading digits', () => {
    expect(detectCardBrand(MASTERCARD)).toBe('mastercard');
  });

  it('reports brands with no matching artwork as unknown, rather than mislabelling them', () => {
    expect(detectCardBrand(AMEX)).toBe('unknown');
  });

  it('detects VISA as soon as its leading digit is typed, for live badge feedback', () => {
    expect(detectCardBrand('42')).toBe('visa');
  });

  it('reports unknown for an empty or unrecognisable prefix', () => {
    expect(detectCardBrand('')).toBe('unknown');
    expect(detectCardBrand('99')).toBe('unknown');
  });
});

describe('isValidCardNumber', () => {
  it('accepts a Luhn-valid test number', () => {
    expect(isValidCardNumber(VISA)).toBe(true);
  });

  it('rejects a number that fails the Luhn checksum', () => {
    expect(isValidCardNumber('4242424242424241')).toBe(false);
  });

  it('rejects a number of the wrong length for its brand', () => {
    expect(isValidCardNumber('42424242')).toBe(false);
  });
});

describe('formatCardNumber', () => {
  it('groups digits into blocks of four', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
  });

  it('groups a partial number without padding it', () => {
    expect(formatCardNumber('42424')).toBe('4242 4');
  });

  it('returns an empty string for no digits', () => {
    expect(formatCardNumber('')).toBe('');
  });
});

describe('onlyDigits', () => {
  it('strips spaces and any other formatting characters', () => {
    expect(onlyDigits('4242 4242-4242.4242')).toBe('4242424242424242');
  });
});

describe('isValidExpiry', () => {
  it('accepts a well-formed future date', () => {
    expect(isValidExpiry('12/29')).toBe(true);
  });

  it('rejects a month out of range', () => {
    expect(isValidExpiry('13/29')).toBe(false);
  });

  it('rejects a date already in the past', () => {
    expect(isValidExpiry('01/20')).toBe(false);
  });

  it('rejects a malformed string', () => {
    expect(isValidExpiry('2029-12')).toBe(false);
  });
});

describe('isValidCvc', () => {
  it('accepts 3 digits for VISA', () => {
    expect(isValidCvc('123', 'visa')).toBe(true);
  });

  it('rejects 4 digits for VISA', () => {
    expect(isValidCvc('1234', 'visa')).toBe(false);
  });

  it('accepts either 3 or 4 digits when the brand is not recognised', () => {
    expect(isValidCvc('1234', 'unknown')).toBe(true);
    expect(isValidCvc('123', 'unknown')).toBe(true);
  });

  it('rejects non-numeric input', () => {
    expect(isValidCvc('12a', 'visa')).toBe(false);
  });
});
