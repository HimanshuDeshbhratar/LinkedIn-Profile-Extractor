/**
 * Utility to discover current LinkedIn GraphQL queryIds from their JS bundles.
 * Run: node scripts/discover-query-ids.js
 *
 * LinkedIn rotates queryId hashes on deploys. Use this script to find updated values.
 */
import axios from 'axios';

const PROFILE_PAGE = 'https://www.linkedin.com/in/williamhgates/';

async function main() {
  console.log('Fetching LinkedIn profile page to extract JS bundle URLs...\n');

  const pageRes = await axios.get(PROFILE_PAGE, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });

  const html = pageRes.data;
  const bundleUrls = [...html.matchAll(/src="(https:\/\/static\.licdn\.com[^"]+\.js)"/g)].map(
    (m) => m[1]
  );

  const queryIds = new Set();
  const decorationIds = new Set();

  for (const url of bundleUrls.slice(0, 30)) {
    try {
      const js = await axios.get(url, { timeout: 15000 });
      const content = js.data;

      for (const match of content.matchAll(/"(voyagerIdentityDash[A-Za-z0-9_.]+)"/g)) {
        queryIds.add(match[1]);
      }

      for (const match of content.matchAll(
        /com\.linkedin\.voyager\.dash\.deco\.identity\.profile\.[A-Za-z0-9-]+/g
      )) {
        decorationIds.add(match[0]);
      }
    } catch {
      // Skip unreachable bundles
    }
  }

  console.log('=== GraphQL Query IDs (profile-related) ===');
  [...queryIds]
    .filter((id) => /profile/i.test(id))
    .sort()
    .forEach((id) => console.log(id));

  console.log('\n=== Decoration IDs (profile-related) ===');
  [...decorationIds].sort().forEach((id) => console.log(id));

  console.log('\nUpdate backend/src/linkedin/constants.js with any changed values.');
}

main().catch(console.error);
