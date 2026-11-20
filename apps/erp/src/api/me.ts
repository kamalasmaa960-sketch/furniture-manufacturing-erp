import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { getActor } from '../server/core';

export default createEndpoint({
  description: 'Returns the signed-in user role and permissions',
  inputSchema: z.object({}),
  outputSchema: z.object({ userId: z.string(), role: z.string(), permissions: z.array(z.string()), name: z.string() }),
  execute: async ({ context }) => getActor(context),
});
