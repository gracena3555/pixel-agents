import { isBrowserRuntime } from './runtime';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

interface PostMessageApi {
  postMessage(msg: unknown): void;
}

function makeWebSocketBridge(): PostMessageApi {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  let ws: WebSocket | null = null;
  const queue: unknown[] = [];

  function flush(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (queue.length > 0) {
      ws.send(JSON.stringify(queue.shift()));
    }
  }

  function connect(): void {
    ws = new WebSocket(url);
    ws.addEventListener('open', () => {
      console.log('[ws] connected');
      flush();
    });
    ws.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data as string);
        // Dispatch as window 'message' event so existing useExtensionMessages handler picks it up
        window.dispatchEvent(new MessageEvent('message', { data }));
      } catch (e) {
        console.error('[ws] bad message', e);
      }
    });
    ws.addEventListener('close', () => {
      console.warn('[ws] disconnected, retrying in 2s');
      setTimeout(connect, 2000);
    });
    ws.addEventListener('error', (e) => {
      console.error('[ws] error', e);
    });
  }

  connect();

  return {
    postMessage(msg: unknown) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      } else {
        queue.push(msg);
      }
    },
  };
}

export const vscode: PostMessageApi = isBrowserRuntime
  ? makeWebSocketBridge()
  : (acquireVsCodeApi() as PostMessageApi);
