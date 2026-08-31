import { LINKEDIN_TYPES } from './constants.js';
import {
  buildProfileUrl,
  extractProfileIdFromUrn,
  pickLocalizedText,
  parseDateRange,
  resolveImageUrls,
  getBestImageUrl,
  findInIncluded,
  findFirstInIncluded,
  indexIncludedByUrn,
  resolveReference,
  resolveGeoName,
} from './utils.js';

/**
 * Transforms raw Voyager API responses into a clean, structured profile schema.
 */
export function transformProfile(raw) {
  const included = collectAllIncluded(raw);
  const includedMap = indexIncludedByUrn(included);

  const identity = parseIdentity(raw, includedMap);
  const media = parseMedia(raw, includedMap, identity);
  const about = parseAbout(raw, includedMap, identity);
  const experience = parseExperience(raw, includedMap);
  const education = parseEducation(raw, includedMap);
  const skills = parseSkills(raw, includedMap);
  const certifications = parseCertifications(raw, includedMap);
  const languages = parseLanguages(raw, includedMap);
  const volunteer = parseVolunteer(raw);
  const honors = parseHonors(raw);

  return {
    identity: {
      ...identity,
      summary: about,
    },
    media,
    experience,
    education,
    skills,
    certifications,
    languages,
    volunteer,
    honors,
    stats: {
      experienceCount: experience.length,
      educationCount: education.length,
      skillCount: skills.length,
      certificationCount: certifications.length,
      languageCount: languages.length,
    },
  };
}

function collectAllIncluded(raw) {
  const buckets = [
    raw.resolved?.included,
    raw.graphqlData?.profiles?.included,
    raw.graphqlData?.components?.included,
    raw.dashFull?.included,
    raw.profileView?.included,
  ];

  const merged = [];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) merged.push(...bucket);
  }
  return merged;
}

function parseIdentity(raw, includedMap) {
  const top = raw.resolved?.element || {};
  const profileView = raw.profileView?.profile || {};
  const dashProfile =
    findFirstInIncluded(raw.dashFull?.included, LINKEDIN_TYPES.PROFILE) ||
    findFirstInIncluded(raw.graphqlData?.profiles?.included, LINKEDIN_TYPES.PROFILE, (p) =>
      p.publicIdentifier === raw.vanityName
    ) ||
    {};

  const firstName =
    top.firstName || dashProfile.firstName || profileView.firstName || null;
  const lastName =
    top.lastName || dashProfile.lastName || profileView.lastName || null;

  const headline =
    pickLocalizedText(top.headline) ||
    pickLocalizedText(dashProfile.headline) ||
    profileView.headline ||
    null;

  const location = parseLocation(top, dashProfile, profileView, includedMap);
  const industry =
    pickLocalizedText(top.industryName) ||
    pickLocalizedText(dashProfile.industryName) ||
    profileView.industryName ||
    null;

  const profileUrn =
    top.entityUrn ||
    raw.profileUrn ||
    (profileView.miniProfile?.entityUrn
      ? `urn:li:fsd_profile:${profileView.miniProfile.entityUrn.split(':').pop()}`
      : null);
  const profileId = extractProfileIdFromUrn(profileUrn);

  return {
    vanityName: raw.vanityName,
    profileUrn,
    profileId,
    fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
    firstName,
    lastName,
    headline,
    location,
    industry,
    profileUrl: buildProfileUrl(raw.vanityName),
    connectionDegree: parseConnectionDegree(top),
    isPremium: Boolean(top.premium || dashProfile.premium),
    creator: Boolean(top.creator || dashProfile.creator),
  };
}

function parseConnectionDegree(profile) {
  const distance = profile.memberRelationship?.memberRelationshipUnion?.connection?.distance;
  if (distance === 1) return '1st';
  if (distance === 2) return '2nd';
  if (distance === 3) return '3rd';
  if (profile.memberRelationship?.noConnection) return 'Out of network';
  return null;
}

function parseLocation(top, dashProfile, profileView, includedMap) {
  const geoRef = top.geoLocation || dashProfile.geoLocation || profileView.geoLocation;
  const geo = resolveReference(geoRef?.geo || geoRef, includedMap);
  const geoName = resolveGeoName(geo, includedMap);

  const locationName =
    geoName ||
    pickLocalizedText(top.locationName) ||
    pickLocalizedText(dashProfile.locationName) ||
    profileView.locationName ||
    null;

  if (!locationName) return null;

  const parts = locationName.split(',').map((p) => p.trim());
  return {
    full: locationName,
    city: parts[0] || null,
    region: parts.length > 2 ? parts[1] : null,
    country: parts[parts.length - 1] || null,
  };
}

function parseAbout(raw, includedMap, identity) {
  const dashProfile = findFirstInIncluded(
    collectAllIncluded(raw),
    LINKEDIN_TYPES.PROFILE,
    (p) => p.publicIdentifier === raw.vanityName
  );

  const summary =
    pickLocalizedText(dashProfile?.summary) ||
    raw.profileView?.profile?.summary ||
    null;

  return summary;
}

function parseMedia(raw, includedMap, identity) {
  const top = raw.resolved?.element || {};
  const dashProfile = findFirstInIncluded(
    collectAllIncluded(raw),
    LINKEDIN_TYPES.PROFILE,
    (p) => p.publicIdentifier === raw.vanityName
  );

  const profileVector =
    top.profilePicture?.displayImageReference?.vectorImage ||
    dashProfile?.profilePicture?.displayImageReference?.vectorImage ||
    raw.profileView?.profile?.miniProfile?.picture?.['com.linkedin.common.VectorImage'];

  const backgroundVector =
    top.backgroundPicture?.displayImageReference?.vectorImage ||
    dashProfile?.backgroundPicture?.displayImageReference?.vectorImage;

  return {
    profilePhoto: profileVector
      ? {
          primary: getBestImageUrl(profileVector),
          variants: resolveImageUrls(profileVector),
        }
      : null,
    backgroundPhoto: backgroundVector
      ? {
          primary: getBestImageUrl(backgroundVector),
          variants: resolveImageUrls(backgroundVector),
        }
      : null,
  };
}

function parseExperience(raw, includedMap) {
  const fromDash = findInIncluded(
    collectAllIncluded(raw),
    LINKEDIN_TYPES.POSITION
  ).map((pos) => mapPosition(pos, includedMap));

  if (fromDash.length) return dedupeByKey(fromDash, (e) => `${e.title}-${e.company?.name}-${e.duration?.start}`);

  const legacy = raw.profileView?.positionView?.elements || [];
  return legacy.map((pos) => mapLegacyPosition(pos));
}

function mapPosition(pos, includedMap) {
  const company = resolveReference(pos.company || pos['*company'], includedMap);
  const companyName =
    pickLocalizedText(company?.name) ||
    pickLocalizedText(pos.companyName) ||
    null;

  const logoVector = company?.logo?.vectorImage || company?.logo?.['com.linkedin.common.VectorImage'];
  const duration = parseDateRange(pos.timePeriod?.startDate, pos.timePeriod?.endDate);

  return {
    title: pickLocalizedText(pos.title) || pos.title || null,
    company: {
      name: companyName,
      urn: company?.entityUrn || null,
      logo: getBestImageUrl(logoVector),
      industry: pickLocalizedText(company?.industry) || null,
      url: company?.url || null,
    },
    location: pickLocalizedText(pos.locationName) || pos.locationName || null,
    description: pickLocalizedText(pos.description) || pos.description || null,
    employmentType: pos.employmentType || null,
    duration,
  };
}

function mapLegacyPosition(pos) {
  const company = pos.company || {};
  const mini = company.miniCompany || {};
  const duration = parseDateRange(pos.timePeriod?.startDate, pos.timePeriod?.endDate);

  let logo = null;
  const logoVector = mini.logo?.['com.linkedin.common.VectorImage'];
  if (logoVector) logo = getBestImageUrl(logoVector);

  return {
    title: pos.title || null,
    company: {
      name: mini.name || company.name || null,
      urn: mini.entityUrn || company.entityUrn || null,
      logo,
      industry: mini.industry || null,
      url: mini.universalName
        ? `https://www.linkedin.com/company/${mini.universalName}/`
        : null,
    },
    location: pos.locationName || null,
    description: pos.description || null,
    employmentType: pos.employmentType || null,
    duration,
  };
}

function parseEducation(raw, includedMap) {
  const fromDash = findInIncluded(
    collectAllIncluded(raw),
    LINKEDIN_TYPES.EDUCATION
  ).map((edu) => mapEducation(edu, includedMap));

  if (fromDash.length) return dedupeByKey(fromDash, (e) => `${e.school?.name}-${e.degree}-${e.duration?.start}`);

  const legacy = raw.profileView?.educationView?.elements || [];
  return legacy.map((edu) => mapLegacyEducation(edu));
}

function mapEducation(edu, includedMap) {
  const school = resolveReference(edu.school || edu['*school'], includedMap);
  const logoVector = school?.logo?.vectorImage || school?.logo?.['com.linkedin.common.VectorImage'];
  const duration = parseDateRange(edu.timePeriod?.startDate, edu.timePeriod?.endDate);

  return {
    school: {
      name:
        pickLocalizedText(school?.name) ||
        pickLocalizedText(edu.schoolName) ||
        null,
      urn: school?.entityUrn || null,
      logo: getBestImageUrl(logoVector),
      url: school?.url || null,
    },
    degree: pickLocalizedText(edu.degreeName) || edu.degreeName || null,
    fieldOfStudy: pickLocalizedText(edu.fieldOfStudy) || edu.fieldOfStudy || null,
    grade: edu.grade || null,
    activities: pickLocalizedText(edu.activities) || edu.activities || null,
    description: pickLocalizedText(edu.description) || edu.description || null,
    duration,
  };
}

function mapLegacyEducation(edu) {
  const school = edu.school || {};
  let logo = null;
  const logoVector = school.logo?.['com.linkedin.common.VectorImage'];
  if (logoVector) logo = getBestImageUrl(logoVector);

  const duration = parseDateRange(edu.timePeriod?.startDate, edu.timePeriod?.endDate);

  return {
    school: {
      name: school.name || null,
      urn: school.entityUrn || null,
      logo,
      url: school.url || null,
    },
    degree: edu.degreeName || null,
    fieldOfStudy: edu.fieldOfStudy || null,
    grade: edu.grade || null,
    activities: edu.activities || null,
    description: edu.description || null,
    duration,
  };
}

function parseSkills(raw, includedMap) {
  const fromDash = findInIncluded(collectAllIncluded(raw), LINKEDIN_TYPES.SKILL).map(
    (skill) => ({
      name: pickLocalizedText(skill.name) || skill.name || null,
      endorsements: skill.endorsementCount ?? null,
    })
  );

  if (fromDash.length) return dedupeByKey(fromDash.filter((s) => s.name), (s) => s.name);

  const legacySkills = raw.skills || raw.profileView?.skillView?.elements || [];
  return legacySkills
    .map((skill) => ({
      name: skill.name || null,
      endorsements: skill.endorsementCount ?? null,
    }))
    .filter((s) => s.name);
}

function parseCertifications(raw, includedMap) {
  return findInIncluded(
    collectAllIncluded(raw),
    LINKEDIN_TYPES.CERTIFICATION
  ).map((cert) => ({
    name: pickLocalizedText(cert.name) || cert.name || null,
    authority: pickLocalizedText(cert.authority) || cert.authority || null,
    licenseNumber: cert.licenseNumber || null,
    url: cert.url || null,
    issued: parseDateRange(cert.timePeriod?.startDate, null).start,
    expires: parseDateRange(null, cert.timePeriod?.endDate).end,
  }));
}

function parseLanguages(raw, includedMap) {
  const fromDash = findInIncluded(
    collectAllIncluded(raw),
    LINKEDIN_TYPES.LANGUAGE
  ).map((lang) => ({
    name: pickLocalizedText(lang.name) || lang.name || null,
    proficiency: lang.proficiency || null,
  }));

  if (fromDash.length) return fromDash.filter((l) => l.name);

  const legacy = raw.profileView?.languageView?.elements || [];
  return legacy.map((lang) => ({
    name: lang.name || null,
    proficiency: lang.proficiency || null,
  }));
}

function parseVolunteer(raw) {
  const legacy = raw.profileView?.volunteerExperienceView?.elements || [];
  return legacy.map((v) => ({
    role: v.role || null,
    organization: v.companyName || v.company?.miniCompany?.name || null,
    cause: v.causeName || null,
    description: v.description || null,
    duration: parseDateRange(v.timePeriod?.startDate, v.timePeriod?.endDate),
  }));
}

function parseHonors(raw) {
  const legacy = raw.profileView?.honorView?.elements || [];
  return legacy.map((h) => ({
    title: h.title || null,
    issuer: h.issuer || null,
    issuedOn: h.issueDate ? `${h.issueDate.year}-${String(h.issueDate.month || 1).padStart(2, '0')}` : null,
    description: h.description || null,
  }));
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
