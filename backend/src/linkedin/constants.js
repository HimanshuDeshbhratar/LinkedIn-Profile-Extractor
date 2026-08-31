export const VOYAGER_BASE = 'https://www.linkedin.com/voyager/api';

/** Decoration IDs control which fields LinkedIn returns from dash endpoints */
export const DECORATIONS = {
  TOP_CARD: 'com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-16',
  FULL_PROFILE:
    'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
  ABOUT: 'com.linkedin.voyager.dash.deco.identity.profile.About-1',
};

/**
 * GraphQL queryIds rotate on LinkedIn deploys. Update via scripts/discover-query-ids.js
 * or by inspecting network tab on linkedin.com/in/{profile}
 */
export const QUERY_IDS = {
  PROFILES: 'voyagerIdentityDashProfiles.e9b0809465a07db1f02e70a82d455e10',
  PROFILE_COMPONENTS:
    'voyagerIdentityDashProfileComponents.86824295e1093fb0f5acdd8d57213aaa',
  PROFILE_CARDS:
    'voyagerIdentityDashProfileCards.aec4c2601fac8c5f615c7630b8db1ab3',
};

export const LINKEDIN_TYPES = {
  PROFILE: 'com.linkedin.voyager.dash.identity.profile.Profile',
  POSITION: 'com.linkedin.voyager.dash.identity.profile.Position',
  EDUCATION: 'com.linkedin.voyager.dash.identity.profile.Education',
  SKILL: 'com.linkedin.voyager.dash.identity.profile.Skill',
  CERTIFICATION: 'com.linkedin.voyager.dash.identity.profile.Certification',
  LANGUAGE: 'com.linkedin.voyager.dash.identity.profile.Language',
  COMPANY: 'com.linkedin.voyager.dash.organization.Company',
  SCHOOL: 'com.linkedin.voyager.dash.organization.School',
  GEO: 'com.linkedin.voyager.dash.common.Geo',
  VECTOR_IMAGE: 'com.linkedin.common.VectorImage',
};

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const LI_TRACK = JSON.stringify({
  clientVersion: '1.13.0',
  mpVersion: '1.13.0',
  osName: 'web',
  timezoneOffset: -330,
  deviceFormFactor: 'DESKTOP',
  mpName: 'voyager-web',
  displayDensity: 1,
  displayWidth: 1920,
  displayHeight: 1080,
});
