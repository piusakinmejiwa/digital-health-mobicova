import app from './app';
import { env } from './config/env';

app.listen(env.port, () => {
  console.log(`MobiCova Digital Health API running on http://localhost:${env.port}`);
});
