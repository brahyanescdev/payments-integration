/**
 * Fetch API and text-encoding globals, patched in before the test framework loads.
 *
 * Plain CommonJS on purpose: this must run as `setupFiles` (before the jsdom
 * environment hands control to the test framework), and TypeScript/swc hoist
 * transpiled `import` statements above hand-written code in the same file, which
 * would undo any ordering attempted from a `.ts` file. `require()` calls execute
 * exactly where they are written, so the sequence here — encoders, then undici,
 * which needs them already global — is guaranteed.
 *
 * jsdom does not implement the Fetch API itself; `undici` is the same
 * implementation Node's own global `fetch` is built on outside of tests.
 */
const { TextDecoder, TextEncoder } = require('node:util');
const { ReadableStream, TransformStream, WritableStream } = require('node:stream/web');
const { MessagePort, BroadcastChannel } = require('node:worker_threads');

// undici's fetch implementation references these Web Streams and messaging
// primitives at module-evaluation time, so they must already be global before it
// loads below.
//
// `MessagePort` is provided (undici's webidl layer references it as a type), but
// `MessageChannel` deliberately is not: React's scheduler switches to a real
// `MessageChannel` for task yielding whenever the constructor is global, and an
// actual Node channel is a live OS handle Jest never sees closed — every suite
// that renders a component then hangs until forcibly killed. Without the
// constructor, React falls back to its setTimeout-based scheduler, which Jest
// already knows how to tear down.
Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream,
  TransformStream,
  WritableStream,
  MessagePort,
  BroadcastChannel,
});

const { fetch, Headers, Request, Response, FormData } = require('undici');

Object.assign(globalThis, { fetch, Headers, Request, Response, FormData });
