import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Modal } from './Modal';

/** An `onClose` recreated on every render — exactly how every real caller passes it (`onClose={() => dispatch(...)}`). */
function ModalWithInlineOnClose({ tick }: { tick: number }) {
  return (
    <Modal title="Título" onClose={() => undefined}>
      <input aria-label="Campo" data-tick={tick} />
    </Modal>
  );
}

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

  it('never steals focus back to the panel on a re-render, even with a fresh onClose every time', async () => {
    // Regression test: every real caller passes an inline `onClose`, a new
    // function identity on every parent re-render — typing into a field inside
    // the modal is exactly the kind of re-render that produces one. If the
    // panel's initial-focus effect ever depended on `onClose` again, this
    // would fail: the field would lose focus back to the panel after the
    // very first re-render, forcing the buyer to click back into it.
    const user = userEvent.setup();
    const { rerender } = render(<ModalWithInlineOnClose tick={0} />);

    const field = screen.getByLabelText('Campo');
    await user.click(field);
    expect(field).toHaveFocus();

    rerender(<ModalWithInlineOnClose tick={1} />);

    expect(field).toHaveFocus();
  });
});
