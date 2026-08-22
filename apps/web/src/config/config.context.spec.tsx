import { render, screen } from '@testing-library/react';

import { makeWebConfig } from '../testing/config.fixture';
import { ConfigProvider, useConfig } from './config.context';

function ApiBaseUrlProbe() {
  return <span>{useConfig().apiBaseUrl}</span>;
}

describe('ConfigProvider', () => {
  it('exposes the configuration to descendants', () => {
    render(
      <ConfigProvider value={makeWebConfig({ apiBaseUrl: 'https://api.example.test' })}>
        <ApiBaseUrlProbe />
      </ConfigProvider>,
    );

    expect(screen.getByText('https://api.example.test')).toBeInTheDocument();
  });

  it('fails loudly when a component reads configuration outside the provider', () => {
    // React logs the thrown error; silencing keeps the expected failure readable.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ApiBaseUrlProbe />)).toThrow(/ConfigProvider/);

    consoleError.mockRestore();
  });
});
