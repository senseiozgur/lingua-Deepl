import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig(process.env);
const app = createApp(config);

app.listen(config.port, () => {
  // Keep logging minimal for MVP startup diagnostics.
  console.log(`server listening on :${config.port}`);
});
