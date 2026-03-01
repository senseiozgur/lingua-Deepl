import { createApp } from "./app";

const port = Number(process.env.PORT || 3000);
const app = createApp();

app.listen(port, () => {
  // Keep logging minimal for MVP startup diagnostics.
  console.log(`server listening on :${port}`);
});

