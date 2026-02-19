import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  }
})
```
```
