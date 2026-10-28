/**
 * ============================================================================
 * OFFICIAL INSTITUTIONAL BRANDING COMPONENT — MGR IEI STUDENT CHAPTER
 * ============================================================================
 * 
 * Manages authentic asset delivery and responsive presentation for:
 * 1. The Institution of Engineers (India) Official Royal Charter Emblem
 * 2. Dr. M.G.R. Educational and Research Institute Official Chapter Banner
 * 
 * Guidelines:
 * - Strict preservation of original aspect ratios (object-fit: contain)
 * - Zero distortion, zero stretching, zero direct recoloring, zero generic icons
 * - Balanced visual weight between circular emblem and horizontal banner
 * - Fully responsive across mobile, tablet, desktop, and 4K displays
 */

const Branding = {
  assets: {
    ieiLogo: '/assets/iei-official-logo.png',
    mgrLogo: '/assets/mgr-iei-official-logo.png',
    ieiAlt: 'The Institution of Engineers (India) - Established 1920, Incorporated by Royal Charter 1935',
    mgrAlt: 'Dr. M.G.R. Educational and Research Institute (University with Graded Autonomy Status) - NAAC A+ Accredited'
  },

  /**
   * Generates the prestigious dual-logo institutional lockup for the Login gateway
   */
  renderLoginBranding() {
    return `
      <div class="inst-login-brand-lockup" role="banner">
        <div class="inst-logos-dual-stage">
          <!-- Logo 1: The Institution of Engineers (India) Official Circular Emblem -->
          <div class="inst-logo-frame inst-logo-iei-frame" title="${this.assets.ieiAlt}">
            <img 
              src="${this.assets.ieiLogo}" 
              alt="${this.assets.ieiAlt}" 
              class="inst-logo-img inst-logo-iei-img"
              loading="eager"
            />
          </div>

          <!-- Refined Institutional Luxury Divider with Gold Diamond -->
          <div class="inst-logo-crest-divider" aria-hidden="true">
            <span class="inst-divider-line"></span>
            <span class="inst-divider-crest">◆</span>
            <span class="inst-divider-line"></span>
          </div>

          <!-- Logo 2: Dr. M.G.R. Educational & Research Institute Official Banner -->
          <div class="inst-logo-frame inst-logo-mgr-frame" title="${this.assets.mgrAlt}">
            <img 
              src="${this.assets.mgrLogo}" 
              alt="${this.assets.mgrAlt}" 
              class="inst-logo-img inst-logo-mgr-img"
              loading="eager"
            />
          </div>
        </div>

        <!-- Institutional Typography Stack -->
        <div class="inst-login-titles">
          <div class="inst-gold-badge">
            <span class="badge-dot"></span>
            <span>OFFICIAL INSTITUTIONAL MANAGEMENT PLATFORM</span>
            <span class="badge-dot"></span>
          </div>
          <h1 class="inst-heading-primary">MGR IEI STUDENTS CHAPTER</h1>
          <p class="inst-subheading-secondary">
            The Institution of Engineers (India) • Dr. M.G.R. Educational and Research Institute
          </p>
          <div class="inst-accreditation-strip">
            <span>Established 1920</span>
            <span class="sep">•</span>
            <span>Royal Charter 1935</span>
            <span class="sep">•</span>
            <span>NAAC A+ University</span>
            <span class="sep">•</span>
            <span>ISO 9001:2015</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Generates the sidebar institutional branding block with prominent MGR University Logo & IEI Emblem
   */
  renderSidebarBranding() {
    return `
      <div class="sidebar-brand-block" onclick="App.navigate('dashboard')" role="button" tabindex="0" title="Return to Dashboard">
        <!-- Prominent Official MGR University Logo -->
        <div class="sidebar-mgr-showcase">
          <img 
            src="${this.assets.mgrLogo}" 
            alt="${this.assets.mgrAlt}" 
            class="sidebar-mgr-logo-img"
            loading="eager"
          />
        </div>
        
        <!-- Chapter Identity with IEI Emblem -->
        <div class="sidebar-sub-brand">
          <div class="sidebar-brand-emblem-wrap">
            <img 
              src="${this.assets.ieiLogo}" 
              alt="The Institution of Engineers (India)" 
              class="sidebar-brand-emblem"
              loading="lazy"
            />
          </div>
          <div class="sidebar-brand-info">
            <div class="sidebar-brand-title">MGR IEI CHAPTER</div>
            <div class="sidebar-brand-subtitle">Student &amp; Staff Portal</div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Generates the compact header branding lockup with MGR University prominence
   */
  renderHeaderBranding() {
    return `
      <div class="header-brand-capsule" title="Dr. M.G.R. Educational & Research Institute - IEI Student Chapter">
        <div class="header-logo-group">
          <img 
            src="${this.assets.mgrLogo}" 
            alt="Dr. M.G.R. Educational and Research Institute" 
            class="header-mgr-banner"
            loading="eager"
          />
          <div class="header-logo-vdiv" aria-hidden="true"></div>
          <img 
            src="${this.assets.ieiLogo}" 
            alt="IEI Emblem" 
            class="header-iei-emblem"
            loading="eager"
          />
        </div>
        <div class="header-title-block">
          <span class="header-chapter-name">MGR IEI STUDENTS CHAPTER</span>
          <span class="header-chapter-meta">Student Committee &amp; Staff Portal</span>
        </div>
      </div>
    `;
  },

  /**
   * Inserts the branding elements into designated placeholders in DOM
   */
  init() {
    const loginHolder = document.getElementById('branding-login-placeholder');
    if (loginHolder) {
      loginHolder.innerHTML = this.renderLoginBranding();
    }

    const sidebarHolder = document.getElementById('branding-sidebar-placeholder');
    if (sidebarHolder) {
      sidebarHolder.innerHTML = this.renderSidebarBranding();
    }

    const headerHolder = document.getElementById('branding-header-placeholder');
    if (headerHolder) {
      headerHolder.innerHTML = this.renderHeaderBranding();
    }
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Branding.init());
} else {
  Branding.init();
}
