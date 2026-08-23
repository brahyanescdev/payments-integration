import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders its title and content', () => {
    render(
      <Modal title="Título" onClose={jest.fn()}>
        <p>Contenido</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Título' })).toBeInTheDocument();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Título" onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );

    await user.click(screen.getByLabelText('Cerrar'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Título" onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus onto the panel when it mounts', () => {
    render(
      <Modal title="Título" onClose={jest.fn()}>
        <p>Contenido</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
  });
});
