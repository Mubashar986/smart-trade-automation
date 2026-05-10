import {
  BookIcon,
  BrandLockup,
  CheckCircleIcon,
  ChevronDownIcon,
  CodeBracketsIcon,
  DocumentIcon,
  EyeIcon,
  IconChip,
  PulseIcon,
  ShieldIcon,
  UserIcon,
  WarningIcon,
} from './BrandSystem'

const trustChips = [
  'Natural Language to MQL5',
  'Validation-First Workflow',
  'Transparent Pipeline States',
]

const trustStrip = [
  {
    title: 'Structured Parameter Extraction',
    body: 'Your plain-English strategy is translated into structured intent before code generation begins.',
    icon: DocumentIcon,
    tone: 'teal',
  },
  {
    title: 'Safety Recovery for Risky Inputs',
    body: 'When parameters are incomplete or unsafe, SmartTrade AI guides the user through clearer recovery paths.',
    icon: WarningIcon,
    tone: 'cyan',
  },
  {
    title: 'Compilation Visibility',
    body: 'Users can see where their strategy is in the pipeline before deeper execution and analysis steps.',
    icon: EyeIcon,
    tone: 'blue',
  },
]

const workflowSteps = [
  {
    step: '01',
    title: 'Describe Your Strategy',
    body: 'Write your trading idea in plain English using the indicators, rules, and conditions you already understand.',
    icon: DocumentIcon,
    tone: 'teal',
  },
  {
    step: '02',
    title: 'Validate Intent and Safety',
    body: 'SmartTrade AI extracts structured parameters, checks safety constraints, and flags incomplete or risky inputs before deeper processing.',
    icon: ShieldIcon,
    tone: 'cyan',
  },
  {
    step: '03',
    title: 'Generate Structured MQL5 Logic',
    body: 'The platform transforms validated strategy intent into organized MQL5-ready workflow logic with transparent pipeline visibility.',
    icon: CodeBracketsIcon,
    tone: 'teal',
  },
  {
    step: '04',
    title: 'Review Compile-Ready Results',
    body: 'Follow generation and compilation states, inspect outputs, and continue refining with more confidence.',
    icon: DocumentIcon,
    tone: 'amber',
  },
]

const whyBullets = [
  'Reduce the path from idea to implementation with natural-language input and guided structure.',
  'Remove the need to manually write MQL5 syntax from scratch while preserving full control.',
  'Add validation and safety before deeper execution with clear guardrails and recovery paths.',
  'Make workflow states easier to understand with transparent pipeline visibility.',
]

const previewCards = [
  {
    title: 'Strategy Composer',
    eyebrow: 'Plain-English Input',
    tone: 'teal',
  },
  {
    title: 'Pipeline Tracking',
    eyebrow: 'Structured Workflow',
    tone: 'cyan',
  },
  {
    title: 'Safety Recovery',
    eyebrow: 'Compile-Ready Result',
    tone: 'amber',
  },
]

const audienceCards = [
  {
    title: 'Retail Traders',
    body: 'Traders with strategy ideas but no MQL5 fluency who want to automate without writing code.',
    icon: UserIcon,
  },
  {
    title: 'Automation Explorers',
    body: 'Traders exploring automation who want structured guidance instead of building from scratch.',
    icon: PulseIcon,
  },
  {
    title: 'Safety-Focused Users',
    body: 'Users who need safer, more transparent workflow support with visible guardrails and validation.',
    icon: ShieldIcon,
  },
  {
    title: 'Educators and Evaluators',
    body: 'People who value traceability, clarity, and explainability in automated trading workflows.',
    icon: BookIcon,
  },
]

function scrollToSection(id) {
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function NavLink({ label, target }) {
  return (
    <button
      type="button"
      className="marketing-navlink"
      onClick={() => scrollToSection(target)}
    >
      {label}
    </button>
  )
}

function SectionEyebrow({ children }) {
  return <div className="marketing-eyebrow">{children}</div>
}

function SectionHeader({ id, eyebrow, title, body }) {
  return (
    <header className="marketing-section-header" id={id}>
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </header>
  )
}

export default function LandingPage({ onSignIn, onGetStarted }) {
  return (
    <div className="marketing-shell">
      <header className="marketing-topbar">
        <div className="marketing-topbar-inner">
          <button type="button" className="marketing-brand-button" onClick={() => scrollToSection('hero')}>
            <BrandLockup label="SmartTrade AI" />
          </button>

          <nav className="marketing-nav">
            <NavLink label="Workflow" target="workflow" />
            <NavLink label="Safety" target="safety" />
            <NavLink label="Product" target="preview" />
          </nav>

          <div className="marketing-actions">
            <button type="button" className="marketing-button marketing-button-ghost" onClick={onSignIn}>
              Sign In
            </button>
            <button type="button" className="marketing-button marketing-button-primary" onClick={onGetStarted}>
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="marketing-main">
        <section className="marketing-hero-section" id="hero">
          <div className="marketing-hero-grid">
            <div className="marketing-hero-copy">
              <SectionEyebrow>Intelligent automated trading platform</SectionEyebrow>
              <h1>
                Turn Plain-English Trading Ideas into
                <span> Compile-Ready MQL5 Strategies</span>
              </h1>
              <p>
                Describe your strategy in plain English. SmartTrade AI guides it through
                validation, safety checks, generation, and compilation so you can focus on
                strategy logic instead of MQL5 syntax.
              </p>

              <div className="marketing-hero-actions">
                <button type="button" className="marketing-button marketing-button-primary" onClick={onGetStarted}>
                  Get Started
                </button>
                <button
                  type="button"
                  className="marketing-button marketing-button-secondary"
                  onClick={() => scrollToSection('workflow')}
                >
                  See How It Works
                  <ChevronDownIcon />
                </button>
              </div>

              <div className="marketing-chip-row">
                {trustChips.map((chip) => (
                  <IconChip key={chip}>{chip}</IconChip>
                ))}
              </div>
            </div>

            <aside className="hero-preview-card">
              <div className="hero-preview-head">
                <span>Pipeline Status</span>
                <span className="hero-status-pill">Compiling</span>
              </div>

              <div className="hero-preview-step done">
                <div className="hero-preview-icon">
                  <CheckCircleIcon />
                </div>
                <div>
                  <strong>Describe Your Strategy</strong>
                  <p>Natural language intent captured and structured.</p>
                  <small>input to intent</small>
                </div>
              </div>

              <div className="hero-preview-step done">
                <div className="hero-preview-icon">
                  <ShieldIcon />
                </div>
                <div>
                  <strong>Validate Intent and Safety</strong>
                  <p>Parameters extracted. Safety constraints passed.</p>
                  <small>validation to guardrails</small>
                </div>
              </div>

              <div className="hero-preview-step active">
                <div className="hero-preview-icon">
                  <CodeBracketsIcon />
                </div>
                <div>
                  <strong>Generate Structured MQL5 Logic</strong>
                  <p>Transforming validated intent into compile-ready code.</p>
                  <small>generation to MQL5</small>
                </div>
              </div>

              <div className="hero-preview-step">
                <div className="hero-preview-icon muted">
                  <DocumentIcon />
                </div>
                <div>
                  <strong>Review Compile-Ready Results</strong>
                  <p>Awaiting compilation completion.</p>
                  <small>compile to output</small>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="marketing-proof-strip">
          <IconChip tone="blue" className="marketing-proof-label">
            <EyeIcon />
            Transparent Pipeline States
          </IconChip>
          <div className="marketing-proof-grid">
            {trustStrip.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="marketing-proof-card">
                  <div className={`marketing-icon-badge tone-${item.tone}`}>
                    <Icon />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="marketing-section" id="workflow">
          <SectionHeader
            id={null}
            eyebrow="Workflow"
            title="From Idea to Compile-Ready Strategy"
            body="A guided four-step pipeline that transforms your trading intuition into structured, safer, compile-ready MQL5 workflow logic."
          />

          <div className="workflow-grid">
            {workflowSteps.map((step) => {
              const Icon = step.icon
              return (
                <article key={step.step} className="workflow-card">
                  <div className="workflow-card-top">
                    <div className={`marketing-icon-badge tone-${step.tone}`}>
                      <Icon />
                    </div>
                    <span className="workflow-step-number">{step.step}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="marketing-section split-layout">
          <div className="split-copy">
            <SectionHeader
              id="product"
              eyebrow="Why SmartTrade AI"
              title="Built for Traders, Not MQL5 Specialists"
              body="Many traders understand strategy ideas but not implementation syntax. Existing workflows often force users into code, rigid rule builders, or unclear automation."
            />

            <div className="why-list">
              {whyBullets.map((bullet) => (
                <div key={bullet} className="why-list-item">
                  <span className="why-check">
                    <CheckCircleIcon />
                  </span>
                  <p>{bullet}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-code-window">
            <div className="marketing-code-head">
              <span className="code-dot red" />
              <span className="code-dot amber" />
              <span className="code-dot green" />
              <span className="code-title">Strategy.mq5</span>
            </div>
            <pre>
              <code>{`// Generated by SmartTrade AI
// Input: "Buy when RSI < 30 and price crosses EMA 50"
input group "Risk"
input double InpStopLoss = 50.0;
input double InpTakeProfit = 100.0;
input double InpRiskPercent = 1.0;

int OnInit() {
  if (InpRiskPercent > 2.0) return INIT_PARAMETERS_INCORRECT;
  return INIT_SUCCEEDED;
}`}</code>
            </pre>
          </div>
        </section>

        <section className="marketing-section" id="safety">
          <SectionHeader
            id={null}
            eyebrow="Trust"
            title="Safety and Transparency by Design"
            body="Validation comes before blind execution. Descriptive error feedback matters. Workflow states are visible, not hidden."
          />

          <div className="trust-grid">
            <article className="trust-card">
              <div className="marketing-icon-badge tone-teal">
                <ShieldIcon />
              </div>
              <h3>Strategy Validation First</h3>
              <p>Every strategy is checked for structural completeness and safety bounds before any code generation begins.</p>
            </article>
            <article className="trust-card">
              <div className="marketing-icon-badge tone-cyan">
                <WarningIcon />
              </div>
              <h3>Recovery Paths</h3>
              <p>When inputs are incomplete or unsafe, the system offers guided recovery with clear parameter correction suggestions.</p>
            </article>
            <article className="trust-card">
              <div className="marketing-icon-badge tone-amber">
                <EyeIcon />
              </div>
              <h3>Transparent Pipeline</h3>
              <p>See exactly where your strategy sits in the workflow: queued, parsing, validating, generating, or compiling.</p>
            </article>
            <article className="trust-card">
              <div className="marketing-icon-badge tone-teal">
                <DocumentIcon />
              </div>
              <h3>Honest Boundaries</h3>
              <p>Clear system limits are communicated up front. No hidden assumptions about profitability or market behavior.</p>
            </article>
          </div>
        </section>

        <section className="marketing-section" id="preview">
          <SectionHeader
            id={null}
            eyebrow="Preview"
            title="Preview the SmartTrade AI Experience"
            body="Three core surfaces make up the SmartTrade AI workflow from natural-language input to structured validation to compile-ready output."
          />

          <div className="preview-grid">
            {previewCards.map((card) => (
              <article key={card.title} className="preview-card">
                <div className="preview-card-head">
                  <span className={`preview-dot tone-${card.tone}`} />
                  <span>{card.title}</span>
                </div>
                <div className="preview-card-body">
                  {card.title === 'Strategy Composer' && (
                    <>
                      <small>Strategy description</small>
                      <blockquote>
                        "Buy EURUSD when RSI drops below 30 and price crosses above the 50-period EMA. Use a 1% risk per trade with 1:2 reward ratio."
                      </blockquote>
                    </>
                  )}
                  {card.title === 'Pipeline Tracking' && (
                    <ul className="preview-state-list">
                      <li className="active">Intent parsed</li>
                      <li className="active">Parameters validated</li>
                      <li className="active soft">Generating MQL5 logic...</li>
                      <li>Compile pending</li>
                    </ul>
                  )}
                  {card.title === 'Safety Recovery' && (
                    <div className="preview-recovery">
                      <span className="preview-warning">Review required</span>
                      <dl>
                        <div><dt>Stop Loss</dt><dd>Not specified</dd></div>
                        <div><dt>Risk %</dt><dd>Exceeds 2%</dd></div>
                        <div><dt>Timeframe</dt><dd>Ambiguous</dd></div>
                      </dl>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section" id="audience">
          <SectionHeader
            id={null}
            eyebrow="Audience"
            title="Who SmartTrade AI Is For"
            body="Designed for traders who understand the market but need a clearer path from idea to executable strategy."
          />

          <div className="audience-grid">
            {audienceCards.map((card) => {
              const Icon = card.icon
              return (
                <article key={card.title} className="audience-card">
                  <div className="marketing-icon-badge tone-blue">
                    <Icon />
                  </div>
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="marketing-final-cta">
          <h2>Get Started with SmartTrade AI</h2>
          <p>
            Move from trading intuition to a guided, more transparent strategy workflow.
            No MQL5 expertise required.
          </p>
          <div className="marketing-hero-actions center">
            <button type="button" className="marketing-button marketing-button-primary" onClick={onGetStarted}>
              Get Started
            </button>
            <button type="button" className="marketing-button marketing-button-ghost" onClick={onSignIn}>
              Sign In
            </button>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-footer-main">
          <div className="marketing-footer-brand">
            <BrandLockup label="SmartTrade AI" />
            <p>
              Intelligent automated trading platform for strategy development,
              backtesting, and execution readiness.
            </p>
          </div>

          <div className="marketing-footer-columns">
            <div>
              <h4>Product</h4>
              <button type="button" onClick={() => scrollToSection('workflow')}>Workflow</button>
              <button type="button" onClick={() => scrollToSection('safety')}>Safety</button>
              <button type="button" onClick={() => scrollToSection('preview')}>Preview</button>
            </div>
            <div>
              <h4>Account</h4>
              <button type="button" onClick={onSignIn}>Sign In</button>
              <button type="button" onClick={onGetStarted}>Get Started</button>
            </div>
            <div>
              <h4>Legal</h4>
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>

        <div className="marketing-disclaimer">
          <div className="marketing-disclaimer-title">
            <WarningIcon />
            <span>Important Notice</span>
          </div>
          <p>
            SmartTrade AI is a strategy development and workflow support platform. It does
            not provide financial advice and does not guarantee trading profitability. All
            trading strategies generated by the platform should be thoroughly reviewed and
            tested before live deployment. Past performance and simulated workflows have
            limitations. Users remain fully responsible for their trading decisions and risk
            management.
          </p>
        </div>

        <div className="marketing-footer-bottom">
          <span>© 2026 SmartTrade AI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
