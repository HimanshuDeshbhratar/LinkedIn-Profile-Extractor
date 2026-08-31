export default function ProfileCard({ data, meta }) {
  const { identity, media, experience, education, skills, certifications, languages, stats } =
    data;

  const initials = [identity.firstName?.[0], identity.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase();

  return (
    <div className="profile-card">
      <div className="profile-hero">
        {media.backgroundPhoto?.primary && (
          <div
            className="profile-hero-bg"
            style={{ backgroundImage: `url(${media.backgroundPhoto.primary})` }}
          />
        )}
        <div className="profile-hero-content">
          {media.profilePhoto?.primary ? (
            <img className="avatar" src={media.profilePhoto.primary} alt={identity.fullName} />
          ) : (
            <div className="avatar avatar-placeholder">{initials || '?'}</div>
          )}
          <div className="profile-identity">
            <h2>{identity.fullName || identity.vanityName}</h2>
            {identity.headline && <p className="headline">{identity.headline}</p>}
            {identity.location?.full && (
              <p className="location">
                <span>📍</span> {identity.location.full}
              </p>
            )}
            {identity.industry && (
              <p className="headline" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                {identity.industry}
              </p>
            )}
            <div className="profile-stats">
              <Stat value={stats.experienceCount} label="Experience" />
              <Stat value={stats.educationCount} label="Education" />
              <Stat value={stats.skillCount} label="Skills" />
              <Stat value={stats.certificationCount} label="Certs" />
            </div>
            <a
              href={meta.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: '0.75rem',
                color: 'var(--accent-2)',
                fontSize: '0.85rem',
              }}
            >
              View on LinkedIn →
            </a>
          </div>
        </div>
      </div>

      <div className="profile-body">
        {identity.summary && (
          <Section title="About">
            <p className="about-text">{identity.summary}</p>
          </Section>
        )}

        {experience.length > 0 && (
          <Section title="Experience">
            {experience.map((exp, i) => (
              <TimelineItem
                key={i}
                logo={exp.company?.logo}
                title={exp.title}
                subtitle={exp.company?.name}
                detail={exp.location}
                duration={formatDuration(exp.duration)}
                description={exp.description}
              />
            ))}
          </Section>
        )}

        {education.length > 0 && (
          <Section title="Education">
            {education.map((edu, i) => (
              <TimelineItem
                key={i}
                logo={edu.school?.logo}
                title={edu.school?.name}
                subtitle={[edu.degree, edu.fieldOfStudy].filter(Boolean).join(' · ')}
                duration={formatDuration(edu.duration)}
                description={edu.description}
              />
            ))}
          </Section>
        )}

        {skills.length > 0 && (
          <Section title="Skills">
            <div className="skills-grid">
              {skills.map((skill, i) => (
                <span key={i} className="skill-tag">
                  {skill.name}
                  {skill.endorsements ? ` (${skill.endorsements})` : ''}
                </span>
              ))}
            </div>
          </Section>
        )}

        {certifications.length > 0 && (
          <Section title="Certifications">
            {certifications.map((cert, i) => (
              <TimelineItem
                key={i}
                title={cert.name}
                subtitle={cert.authority}
                duration={cert.issued ? `Issued ${cert.issued}` : null}
              />
            ))}
          </Section>
        )}

        {languages.length > 0 && (
          <Section title="Languages">
            <div className="skills-grid">
              {languages.map((lang, i) => (
                <span key={i} className="skill-tag">
                  {lang.name}
                  {lang.proficiency ? ` — ${lang.proficiency}` : ''}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function TimelineItem({ logo, title, subtitle, detail, duration, description }) {
  return (
    <div className="timeline-item">
      {logo ? (
        <img className="timeline-logo" src={logo} alt="" />
      ) : (
        <div className="timeline-logo timeline-logo-placeholder">•</div>
      )}
      <div className="timeline-content">
        {title && <h4>{title}</h4>}
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {detail && <p className="subtitle">{detail}</p>}
        {duration && <p className="duration">{duration}</p>}
        {description && (
          <p className="subtitle" style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
            {description.slice(0, 300)}
            {description.length > 300 ? '…' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

function formatDuration(duration) {
  if (!duration) return null;
  const { start, end, isCurrent } = duration;
  if (!start) return null;
  const endLabel = isCurrent ? 'Present' : end || '';
  return `${start} — ${endLabel}`.trim();
}
