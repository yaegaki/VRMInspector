const GITHUB_URL = 'https://github.com/yaegaki/VRMInspector'
export function HelpTab() {
  return (
    <div className="help-section">
      <div className="detail-list">
        <article className="detail-card">
          <span>GitHub</span>
          <strong>
            <a
              className="help-link"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
            >
              GitHub Repository
            </a>
          </strong>
        </article>

        <article className="detail-card">
          <span>Supported Files</span>
          <strong>.vrm</strong>
          <strong>.vrma</strong>
        </article>
      </div>
    </div>
  )
}
