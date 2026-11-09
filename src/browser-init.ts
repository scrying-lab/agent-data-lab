// Import first in every browser entry.
// The site's Content-Security-Policy forbids eval. Zod otherwise probes for it once with
// `new Function`, which a strict CSP reports as a violation even though the error is caught.
import { z } from 'zod'

z.config({ jitless: true })
