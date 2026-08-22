import { Email } from './email';

describe('Email', () => {
  it('accepts a well-formed address', () => {
    expect(Email.create('ana@example.com')._unsafeUnwrap().value).toBe('ana@example.com');
  });

  it('normalises case and surrounding whitespace so one person is one customer', () => {
    expect(Email.create('  Ana.Perez@Example.COM ')._unsafeUnwrap().value).toBe(
      'ana.perez@example.com',
    );
  });

  it.each(['', 'ana', 'ana@', '@example.com', 'ana@example', 'a n a@example.com'])(
    'rejects "%s"',
    (raw) => {
      expect(Email.create(raw).isErr()).toBe(true);
    },
  );

  it('rejects an address beyond the 254 character limit', () => {
    const tooLong = `${'a'.repeat(250)}@example.com`;

    expect(Email.create(tooLong)._unsafeUnwrapErr().message).toMatch(/254/);
  });

  it('compares by normalised value', () => {
    const one = Email.create('ANA@example.com')._unsafeUnwrap();
    const other = Email.create('ana@example.com')._unsafeUnwrap();

    expect(one.equals(other)).toBe(true);
    expect(one.toString()).toBe('ana@example.com');
  });
});
