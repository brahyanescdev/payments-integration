import { SequentialIdGenerator, UuidGenerator } from './id-generator.port';

describe('UuidGenerator', () => {
  it('produces well-formed, unique v4 UUIDs', () => {
    const generator = new UuidGenerator();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const first = generator.generate();
    const second = generator.generate();

    expect(first).toMatch(uuidPattern);
    expect(second).not.toBe(first);
  });
});

describe('SequentialIdGenerator', () => {
  it('counts up from one, prefixed for readability in assertions', () => {
    const generator = new SequentialIdGenerator('customer');

    expect(generator.generate()).toBe('customer-1');
    expect(generator.generate()).toBe('customer-2');
  });

  it('defaults to a generic prefix when none is given', () => {
    expect(new SequentialIdGenerator().generate()).toBe('id-1');
  });
});
