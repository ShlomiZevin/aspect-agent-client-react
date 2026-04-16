import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './AICompliancePage.module.css';

export function AICompliancePage() {
  useEffect(() => {
    document.title = 'Aspect — AI Due Diligence Disclosure';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    const root = document.getElementById('root');
    if (root) {
      root.style.overflow = 'auto';
      root.style.height = 'auto';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      if (root) {
        root.style.overflow = '';
        root.style.height = '';
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.navLogo}>
            <img src="/img/aspect-logo-regular.png" alt="Aspect" />
          </Link>
          <div className={styles.navLinks}>
            <a href="#ai-technology">AI Technology</a>
            <a href="#training-data">Training Data</a>
            <a href="#gen-ai-tools">Gen AI Tools</a>
            <a href="#summary">Summary</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <h1>AI Technology <span>Due Diligence</span></h1>
        <p className={styles.heroSub}>
          Disclosure addressing Section 4.10(k) — AI Technology, Training Data,
          and Generative AI Tools used in the Aspect platform.
        </p>
        <div className={styles.heroMeta}>
          <span>Section 4.10(k)(i)–(iv)</span>
          <span>Aspect Platform</span>
          <span>April 2026</span>
        </div>
      </header>

      <div className={styles.document}>

        {/* ═══════════════════════════════════════════
            SECTION (k)(i) — AI TECHNOLOGY
            ═══════════════════════════════════════════ */}
        <section id="ai-technology" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>k(i)</span>
            <h2 className={styles.sectionTitle}>Third-Party AI Technology</h2>
            <span className={styles.sectionRef}>Schedule 4.10(k)(i)</span>
          </div>

          <p className={styles.paragraph}>
            The following is a complete list of all third-party AI Technology incorporated in
            Aspect products, used internally for development, or commercialized by the Company.
          </p>

          {/* AI Technology Table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Technology</th>
                  <th>Provider</th>
                  <th>SDK Version</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td><strong>OpenAI Responses API</strong></td>
                  <td>OpenAI, Inc.</td>
                  <td>openai ^6.15.0</td>
                  <td>Primary chat inference (GPT-4o, GPT-5), stored prompt versioning, function/tool calling</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td><strong>OpenAI Vector Stores</strong></td>
                  <td>OpenAI, Inc.</td>
                  <td>(same SDK)</td>
                  <td>Knowledge base file search — documents uploaded to vector stores for RAG retrieval</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td><strong>OpenAI Whisper</strong></td>
                  <td>OpenAI, Inc.</td>
                  <td>(same SDK)</td>
                  <td>Audio transcription (whisper-1 model)</td>
                </tr>
                <tr>
                  <td>4</td>
                  <td><strong>Anthropic Claude API</strong></td>
                  <td>Anthropic PBC</td>
                  <td>@anthropic-ai/sdk ^0.74.0</td>
                  <td>One-shot completions, crew member generation, Anthropic Files API for KB</td>
                </tr>
                <tr>
                  <td>5</td>
                  <td><strong>Google Gemini API</strong></td>
                  <td>Google LLC</td>
                  <td>@google/genai ^1.42.0</td>
                  <td>Chat inference (Gemini 2.0 Flash), file search corpora, audio file streaming</td>
                </tr>
                <tr>
                  <td>6</td>
                  <td><strong>Pinecone</strong></td>
                  <td>Pinecone Systems, Inc.</td>
                  <td>@pinecone-database/pinecone ^7.2.0</td>
                  <td>Vector database for embedding storage and similarity search</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={styles.paragraph}>
            <strong>No open-source AI models</strong> are used locally. The platform does not
            incorporate TensorFlow, PyTorch, HuggingFace Transformers, ONNX, LLaMA, Mistral, or any
            other local inference framework. All AI inference is performed via cloud API calls to the
            providers listed above.
          </p>

          {/* License compliance */}
          <div className={styles.calloutGreen}>
            <div className={styles.calloutTitle}>License Compliance</div>
            All three LLM providers are accessed exclusively through their official SDKs under
            standard API terms of service. API keys are managed via environment variables and are
            excluded from version control (.gitignore). No custom enterprise agreements are
            currently in place — the Company operates under each provider's standard API terms.
          </div>

          {/* AI limiting ownership */}
          <p className={styles.paragraph}>
            <strong>AI Technology and Company IP:</strong> The Company does not train, fine-tune, or
            create any AI models. No model weights are owned by the Company. The proprietary value
            of the platform consists of the orchestration layer — the crew system architecture,
            dispatcher logic, prompt engineering, context persistence system, and multi-provider
            abstraction — all of which are original source code authored by Company employees. No
            AI-generated code has been incorporated into the Company's codebase.
          </p>

          <p className={styles.paragraph}>
            <strong>Third-party IP claims:</strong> No person has asserted ownership of any Company
            AI Product. The Company has not received any written communication disputing its use of
            AI Technology or the ownership of its products.
          </p>

          {/* NIST / AI Commitments gap */}
          <div className={styles.calloutAmber}>
            <div className={styles.calloutTitle}>Identified Gap — AI Governance Documentation</div>
            The Company has not yet formalized AI governance policies, a NIST AI Risk Management
            Framework (AI RMF) implementation, or written AI Commitments as defined in Section
            4.10(k)(iv). No documented controls against regurgitation, copyright infringement, or
            trade secret misappropriation in AI outputs are currently in place. The Company relies
            on the built-in content safety policies of each LLM provider.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ═══════════════════════════════════════════
            SECTION (k)(ii) — TRAINING DATA
            ═══════════════════════════════════════════ */}
        <section id="training-data" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>k(ii)</span>
            <h2 className={styles.sectionTitle}>Training Data</h2>
            <span className={styles.sectionRef}>Schedule 4.10(k)(ii)</span>
          </div>

          <div className={styles.calloutGreen}>
            <div className={styles.calloutTitle}>No Training Data Collected or Used</div>
            The Company does <strong>not</strong> train, fine-tune, validate, or test any AI models.
            No training datasets are created, curated, or submitted to any provider. No code for
            model fine-tuning, training pipelines, or dataset preparation exists in the codebase.
            The platform is a pure consumer of third-party LLM APIs.
          </div>

          <p className={styles.paragraph}>
            <strong>Web scraping and data harvesting:</strong> The Company does not perform any web
            scraping, web harvesting, or similar data collection techniques. No scraping libraries
            (Puppeteer, Cheerio, Playwright, Selenium) are present in the codebase. All data enters
            the platform through user input, authorized file uploads, or authorized database
            connections provided by the customer.
          </p>

          <p className={styles.paragraph}>
            <strong>Knowledge Base files:</strong> Customers upload documents (PDF, CSV, XLSX, DOCX,
            XML) to the platform's Knowledge Base system. These files are stored in Google Cloud
            Storage and synced to LLM provider vector stores (OpenAI Vector Stores, Google Search
            Corpora, Anthropic Files) for retrieval-augmented generation. Files are used solely for
            search/retrieval during conversations — they are not used for model training.
          </p>

          <div className={styles.calloutGreen}>
            <div className={styles.calloutTitle}>OpenAI Data Retention</div>
            All OpenAI API methods are configured with <strong>store: false</strong>, meaning
            conversation data is not retained by OpenAI beyond the duration of the API call.
            OpenAI's API terms confirm that data sent via the API with store disabled is not used
            for model training or service improvement.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ═══════════════════════════════════════════
            SECTION (k)(iii) — GENERATIVE AI TOOLS
            ═══════════════════════════════════════════ */}
        <section id="gen-ai-tools" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>k(iii)</span>
            <h2 className={styles.sectionTitle}>Generative AI Tools</h2>
            <span className={styles.sectionRef}>Schedule 4.10(k)(iii)</span>
          </div>

          <p className={styles.paragraph}>
            The following Generative AI Tools are used by the Company as of the date of this
            disclosure.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Models</th>
                  <th>Capabilities Used</th>
                  <th>Data Flow</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>OpenAI API</strong></td>
                  <td>GPT-4o, GPT-5, Whisper</td>
                  <td>Chat inference, function calling, file search, audio transcription</td>
                  <td>User messages, conversation history, KB search results, business data query results</td>
                </tr>
                <tr>
                  <td><strong>Anthropic API</strong></td>
                  <td>Claude Sonnet 4</td>
                  <td>One-shot completions, crew generation, file-based KB</td>
                  <td>System prompts, user messages, context data</td>
                </tr>
                <tr>
                  <td><strong>Google Gemini API</strong></td>
                  <td>Gemini 2.0 Flash</td>
                  <td>Chat inference, function calling, file search, audio streaming</td>
                  <td>User messages, conversation history, KB search results</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sensitive data in prompts */}
          <h3 style={{ color: '#ffffff', fontSize: '1.1rem', margin: '2rem 0 1rem' }}>
            Data Categories Flowing to LLM Providers
          </h3>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data Category</th>
                  <th>Description</th>
                  <th>Risk Assessment</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>User messages</strong></td>
                  <td>Free-text questions and instructions from end users</td>
                  <td><span className={styles.statusCompliant}>Expected</span></td>
                </tr>
                <tr>
                  <td><strong>Conversation history</strong></td>
                  <td>Prior messages in the session, used for context continuity</td>
                  <td><span className={styles.statusCompliant}>Expected</span></td>
                </tr>
                <tr>
                  <td><strong>System prompts</strong></td>
                  <td>Crew member guidance containing business logic and behavioral instructions</td>
                  <td><span className={styles.statusGap}>Proprietary Logic</span></td>
                </tr>
                <tr>
                  <td><strong>KB search results</strong></td>
                  <td>Snippets from uploaded documents returned by vector store search</td>
                  <td><span className={styles.statusGap}>Customer Data</span></td>
                </tr>
                <tr>
                  <td><strong>Business data query results</strong></td>
                  <td>Aggregated numerical results from customer databases — sales totals, inventory counts, branch performance metrics. Data is analytical in nature (sums, averages, comparisons), not individual customer records or PII.</td>
                  <td><span className={styles.statusGap}>Business Data</span></td>
                </tr>
                <tr>
                  <td><strong>User context</strong></td>
                  <td>Persisted user-level preferences and session context injected into prompts (e.g., language, display preferences)</td>
                  <td><span className={styles.statusCompliant}>Low Risk</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Source code / trade secrets */}
          <div className={styles.calloutGreen}>
            <div className={styles.calloutTitle}>Source Code and Trade Secrets</div>
            The Company does <strong>not</strong> include source code, credentials, API keys, or
            material trade secrets in AI Prompts or inputs to Generative AI Tools. System prompts
            contain natural-language behavioral guidance only. All API keys are loaded from
            environment variables at runtime and are never embedded in prompt text.
          </div>

          {/* AI-generated IP */}
          <div className={styles.calloutBlue}>
            <div className={styles.calloutTitle}>Generative AI and Company IP</div>
            The Company has <strong>not</strong> used Generative AI Tools to develop any material
            owned Company Intellectual Property. AI outputs are conversational responses delivered to
            end users in real-time — they are not incorporated into the Company's codebase, product
            features, or documentation. All platform source code is authored by Company employees.
          </div>

          {/* DPA gap */}
          <div className={styles.calloutAmber}>
            <div className={styles.calloutTitle}>Identified Gap — Data Processing Agreements</div>
            Aggregated business metrics (sales totals, inventory counts, branch comparisons) and
            uploaded reference documents flow to third-party LLM providers as part of normal
            platform operation. The data is analytical in nature — not individual customer records
            or PII. The Company currently operates under each provider's standard API terms. No
            dedicated Data Processing Agreements (DPAs) with OpenAI, Anthropic, or Google have been
            executed.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ═══════════════════════════════════════════
            SUMMARY
            ═══════════════════════════════════════════ */}
        <section id="summary" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>Summary</span>
            <h2 className={styles.sectionTitle}>Compliance Status</h2>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <h3>Compliant / Low Risk</h3>
              <ul>
                <li><span className={styles.checkMark}>✓</span> No model training or fine-tuning performed</li>
                <li><span className={styles.checkMark}>✓</span> No training data collected, created, or processed</li>
                <li><span className={styles.checkMark}>✓</span> No web scraping or data harvesting</li>
                <li><span className={styles.checkMark}>✓</span> No open-source AI models used locally</li>
                <li><span className={styles.checkMark}>✓</span> No AI-generated source code in the product</li>
                <li><span className={styles.checkMark}>✓</span> No source code or credentials in AI prompts</li>
                <li><span className={styles.checkMark}>✓</span> Credentials excluded from version control</li>
                <li><span className={styles.checkMark}>✓</span> Company IP is orchestration code, not model weights</li>
                <li><span className={styles.checkMark}>✓</span> No third-party IP ownership claims received</li>
              </ul>
            </div>
            <div className={styles.summaryCard}>
              <h3>Gaps to Address</h3>
              <ul>
                <li><span className={styles.crossMark}>!</span> <strong>AI governance docs needed</strong> — internal AI policy and NIST AI RMF documentation to be prepared</li>
                <li><span className={styles.crossMark}>!</span> <strong>DPAs recommended</strong> — Data Processing Agreements with LLM providers not yet executed</li>
                <li><span className={styles.crossMark}>!</span> <strong>Output safeguards</strong> — no documented controls against IP-infringing outputs (relies on provider safety policies)</li>
                <li><span className={styles.crossMark}>!</span> <strong>Data retention policy</strong> — formal retention/purge policy for conversations to be documented</li>
              </ul>
            </div>
          </div>

          {/* Remediation path */}
          <h3 style={{ color: '#ffffff', fontSize: '1.1rem', margin: '2rem 0 1rem' }}>
            Recommended Remediation Steps
          </h3>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Severity</th>
                  <th>Effort</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>Draft and publish internal AI Governance Policy covering AI Commitments as defined in Section 4.10(k)(iv)</td>
                  <td><span className={styles.statusGap}>Medium</span></td>
                  <td>Internal document — 5-10 pages covering AI usage policy, risk assessment, and mitigation measures</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>Execute Data Processing Agreements with OpenAI, Anthropic, and Google</td>
                  <td><span className={styles.statusGap}>Medium</span></td>
                  <td>Legal — each provider offers standard DPA enrollment via their platforms</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>Document controls against IP-infringing AI outputs (provider safety policies, citation mechanisms)</td>
                  <td><span className={styles.statusGap}>Medium</span></td>
                  <td>Policy documentation + optional engineering enhancements</td>
                </tr>
                <tr>
                  <td>4</td>
                  <td>Define and document data retention policy for conversations and context data</td>
                  <td><span className={styles.statusGap}>Medium</span></td>
                  <td>Policy documentation + optional TTL-based auto-purge implementation</td>
                </tr>
                <tr>
                  <td>5</td>
                  <td>Prepare NIST AI Risk Management Framework alignment documentation</td>
                  <td><span className={styles.statusNA}>Low</span></td>
                  <td>Internal document mapping current practices to NIST AI RMF categories</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          This document is prepared for due diligence purposes under Section 4.10(k) of the
          Agreement. It reflects the state of the Aspect platform codebase as of April 2026.
        </p>
      </footer>
    </div>
  );
}
