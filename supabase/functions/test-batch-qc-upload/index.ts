// One-time test evidence batch completed. All further invocations are disabled.
Deno.serve(() => Response.json({error:'This one-time batch is complete'}, {status:410}));
