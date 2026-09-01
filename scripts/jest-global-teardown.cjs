function getOpenResources() {
  const getHandles = process._getActiveHandles;
  const getRequests = process._getActiveRequests;
  if (typeof getHandles !== 'function') {
    return { handles: [], requests: [], unavailable: true };
  }

  const handles = getHandles.call(process).filter(handle => {
    const name = handle?.constructor?.name;
    const fd = handle?.fd;
    const isStdioSocket = name === 'Socket' && (fd === 0 || fd === 1 || fd === 2);
    return name !== 'WriteStream' && name !== 'ReadStream' && !isStdioSocket;
  });
  const requests = typeof getRequests === 'function' ? getRequests.call(process) : [];

  return { handles, requests, unavailable: false };
}

function dumpResources(handles, requests) {
  console.error(`[jest-handles] active handles: ${handles.length}`);
  for (const [index, handle] of handles.entries()) {
    const name = handle?.constructor?.name || typeof handle;
    const details = {
      local: handle?.address?.(),
      remoteAddress: handle?.remoteAddress,
      remotePort: handle?.remotePort,
      destroyed: handle?.destroyed,
      hasRef: typeof handle?.hasRef === 'function' ? handle.hasRef() : undefined,
      idleTimeout: handle?._idleTimeout,
      onTimeout: handle?._onTimeout?.name,
    };
    console.error(`[jest-handles] #${index + 1} ${name}`, details);
  }

  console.error(`[jest-handles] active requests: ${requests.length}`);
  for (const [index, request] of requests.entries()) {
    console.error(
      `[jest-handles] request #${index + 1} ${request?.constructor?.name || typeof request}`,
      request
    );
  }
}

module.exports = async () => {
  await new Promise(resolve => setTimeout(resolve, 250));

  const { handles, requests, unavailable } = getOpenResources();
  if (process.env.VH_JEST_DUMP_HANDLES === '1') {
    if (unavailable) {
      console.error('[jest-handles] process._getActiveHandles unavailable');
    } else {
      dumpResources(handles, requests);
    }
  }

  if (!unavailable && (handles.length > 0 || requests.length > 0)) {
    dumpResources(handles, requests);
    throw new Error('Jest left open handles or requests after test teardown');
  }
};
