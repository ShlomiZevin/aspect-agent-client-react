import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AspectLandingPage.module.css';

export function AspectLandingPage() {
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    document.title = 'אספקט AI - האייג\'נט שלך לתשאול נתונים בשפה חופשית';
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';

    return () => {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLogo}>
            <img src="/img/aspect-logo-regular.png" alt="Aspect" />
          </div>
          <div className={styles.navLinks}>
            <a href="#benefits">יתרונות</a>
            <a href="#demo">דוגמאות</a>
            <a href="#compare">למה אנחנו?</a>
            <button onClick={() => setChatOpen(true)} className={styles.navCta}>
              נסו עכשיו
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>AI שמבין את העסק שלכם</div>
          <h1 className={styles.heroTitle}>
            תשאלו שאלה.
            <br />
            <span className={styles.highlight}>קבלו תובנה.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            במקום לחכות לדוחות, לבקש מהמתכנת, או ללמוד מערכות מסובכות -
            פשוט תשאלו את השאלה בעברית ותקבלו תשובה מיידית.
          </p>
          <div className={styles.heroCta}>
            <button onClick={() => setChatOpen(true)} className={styles.primaryButton}>
              נסו עכשיו
            </button>
            <a href="#compare" className={styles.secondaryButton}>
              למה זה עדיף על AI מובנה?
            </a>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.chatDemo}>
            <div className={styles.chatHeader}>
              <div className={styles.chatLogoWrapper}>
                <img src="/img/aspect-logo-regular.png" alt="Aspect AI" className={styles.chatLogo} />
              </div>
              <span>Aspect AI</span>
            </div>
            <div className={styles.chatMessages}>
              <div className={styles.chatBubbleUser}>
                <span>השווה לי את המכירות של שלושת הסניפים הכי רווחיים ברבעון האחרון, ותגיד לי אם יש מגמה שצריך לשים לב אליה</span>
              </div>
              <div className={styles.chatBubbleBot}>
                <div className={styles.botAnswer}>
                  <p><strong>שלושת הסניפים המובילים ברבעון:</strong></p>
                  <div className={styles.dataTable}>
                    <div className={styles.dataRow}>
                      <span>תל אביב</span>
                      <span className={styles.dataValue}>₪2.4M</span>
                      <span className={styles.dataChange}>+18%</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>רמת גן</span>
                      <span className={styles.dataValue}>₪1.8M</span>
                      <span className={styles.dataChange}>+12%</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>הרצליה</span>
                      <span className={styles.dataValue}>₪1.6M</span>
                      <span className={styles.dataChangeNeg}>-3%</span>
                    </div>
                  </div>
                  <div className={styles.insight}>
                    <span className={styles.insightIcon}>💡</span>
                    <p>שים לב: סניף הרצליה הראה צמיחה של 22% עד אמצע הרבעון, אבל ירד מאז. המכירות בקטגוריית "פרימיום" נפלו ב-40%. כדאי לבדוק אם יש בעיית מלאי או תמחור.</p>
                  </div>
                </div>
              </div>
              <div className={styles.chatBubbleUser}>
                <span>מתי בדיוק התחילה הירידה בהרצליה ומה קרה באותו זמן?</span>
              </div>
              <div className={styles.chatBubbleBot}>
                <div className={styles.botAnswer}>
                  <p>הירידה התחילה ב-<strong>15 בנובמבר</strong>. בדקתי מה קרה:</p>
                  <ul className={styles.findings}>
                    <li>באותו תאריך המתחרה "פרחי השרון" פתח סניף 200 מטר משם</li>
                    <li>הם מציעים מבצע השקה - 30% הנחה על זרי פרימיום</li>
                    <li>45% מהלקוחות שהפסיקו לקנות היו לקוחות פרימיום קבועים</li>
                  </ul>
                  <p className={styles.recommendation}>
                    <strong>המלצה:</strong> שקול מבצע נאמנות ללקוחות הפרימיום או שדרוג חווית הרכישה בסניף.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Benefits Section */}
      <section id="benefits" className={styles.benefitsSection}>
        <h2>מה זה נותן לכם?</h2>
        <div className={styles.benefitsGrid}>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>⚡</div>
            <h3>תשובות בשניות</h3>
            <p>במקום לחכות שעות לדוח או לבקש ממישהו - תשאלו ותקבלו. עכשיו.</p>
          </div>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>🧠</div>
            <h3>תובנות, לא רק מספרים</h3>
            <p>לא סתם נתונים - הוא מזהה מגמות, מתריע על בעיות, ונותן המלצות.</p>
          </div>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>👥</div>
            <h3>כל אחד יכול</h3>
            <p>לא צריך ללמוד מערכת. לא צריך להיות טכני. פשוט לשאול בעברית.</p>
          </div>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>🎯</div>
            <h3>מכיר את העסק</h3>
            <p>הוא יודע מה זה "סניף מרכז", מי זה "מוטי מהמחסן", ומה זה "מבצע חג".</p>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className={styles.demoSection}>
        <h2>דוגמאות לשאלות שאפשר לשאול</h2>
        <div className={styles.demoGrid}>
          <div className={styles.demoCard}>
            <div className={styles.demoIcon}>📊</div>
            <h3>ניתוח מכירות</h3>
            <div className={styles.demoQuestions}>
              <p>"מה הסניף הכי רווחי החודש ולמה?"</p>
              <p>"השווה לי את מכירות ינואר השנה לשנה שעברה"</p>
              <p>"איזה מוצרים מוכרים טוב ביחד?"</p>
            </div>
          </div>
          <div className={styles.demoCard}>
            <div className={styles.demoIcon}>📦</div>
            <h3>מלאי ואספקה</h3>
            <div className={styles.demoQuestions}>
              <p>"על איזה מוצרים אני עומד להיגמר השבוע?"</p>
              <p>"מה המלאי של ורדים בכל הסניפים?"</p>
              <p>"איזה ספק מאחר הכי הרבה?"</p>
            </div>
          </div>
          <div className={styles.demoCard}>
            <div className={styles.demoIcon}>👥</div>
            <h3>לקוחות</h3>
            <div className={styles.demoQuestions}>
              <p>"מי הלקוחות שהפסיקו לקנות החודש?"</p>
              <p>"כמה לקוחות חדשים הבאנו ברבעון?"</p>
              <p>"מי הלקוח הכי גדול שלי ומה הוא קונה?"</p>
            </div>
          </div>
          <div className={styles.demoCard}>
            <div className={styles.demoIcon}>💡</div>
            <h3>תובנות עסקיות</h3>
            <div className={styles.demoQuestions}>
              <p>"יש משהו חריג בנתונים של השבוע?"</p>
              <p>"מה הייתי צריך לעשות אחרת ברבעון האחרון?"</p>
              <p>"תן לי 3 דברים שכדאי לשים לב אליהם"</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="compare" className={styles.compareSection}>
        <div className={styles.compareSectionInner}>
          <h2>למה AI של אספקט ולא AI מובנה של ספק התוכנה?</h2>
          <p className={styles.compareSubtitle}>
            כל ספקי ה-BI מוסיפים AI למערכות שלהם. זה נהדר.
            <br />
            אבל יש הבדל גדול בין AI שלהם לבין AI שלכם.
          </p>

          <div className={styles.advantagesGrid}>
            <div className={styles.advantageCard}>
              <div className={styles.advantageIcon}>🎯</div>
              <h3>מותאם לעסק שלכם</h3>
              <p>ה-AI שלנו מכיר את המונחים, הסניפים, המוצרים והתהליכים <strong>שלכם</strong>. AI גנרי לא יודע שכש"מוטי" אומר "הסחורה מהמחסן" הוא מתכוון למשהו מאוד ספציפי.</p>
            </div>
            <div className={styles.advantageCard}>
              <div className={styles.advantageIcon}>🔗</div>
              <h3>מחובר לכל המערכות</h3>
              <p>AI של ספק עובד רק עם הנתונים שלו. שלנו מושך מכל מקור - ERP, CRM, אקסלים, מה שיש. תמונה מלאה, לא חצי תמונה.</p>
            </div>
            <div className={styles.advantageCard}>
              <div className={styles.advantageIcon}>🚀</div>
              <h3>מתפתח לפי הצרכים שלכם</h3>
              <p>צריכים משהו חדש? אנחנו מוסיפים תוך ימים. לא ממתינים לגרסה הבאה של הספק או עוברים ועדות אישור.</p>
            </div>
            <div className={styles.advantageCard}>
              <div className={styles.advantageIcon}>🛡️</div>
              <h3>עצמאות מלאה</h3>
              <p>הספק מחליט להעלות מחירים? לשנות כיוון? לבטל פיצ'ר? אתם לא תלויים בו. ה-AI שלכם הוא שלכם.</p>
            </div>
            <div className={styles.advantageCard}>
              <div className={styles.advantageIcon}>🤝</div>
              <h3>תמיכה אישית בעברית</h3>
              <p>מכירים אתכם בשם. עונים מיד. מבינים את ההקשר העסקי הישראלי. לא טיקט שנפתח בהודו.</p>
            </div>
            <div className={styles.advantageCard}>
              <div className={styles.advantageIcon}>💰</div>
              <h3>שליטה בעלויות</h3>
              <p>מודל תמחור שקוף וגמיש. אתם יודעים בדיוק על מה אתם משלמים ויכולים לתכנן קדימה.</p>
            </div>
          </div>

          <div className={styles.bottomLine}>
            <h3>השורה התחתונה</h3>
            <p>
              ספקי התוכנה מוסיפים AI כי כולם מוסיפים AI. זה AI <strong>שלהם</strong>, לא <strong>שלכם</strong>.
            </p>
            <p>
              ה-AI של אספקט נבנה במיוחד עבורכם. הוא מכיר את העסק. ומשתפר לפי מה שאתם צריכים.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <h2>מוכנים לדבר עם הנתונים שלכם?</h2>
        <p>בואו נראה לכם איך זה עובד - על הנתונים האמיתיים שלכם</p>
        <div className={styles.ctaButtons}>
          <button onClick={() => setChatOpen(true)} className={styles.primaryButton}>
            נסו עכשיו
          </button>
          <a href="mailto:info@aspect.co.il" className={styles.secondaryButton}>
            לתאם הדגמה
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>
            <img src="/img/aspect-logo-regular.png" alt="Aspect" />
          </div>
          <div className={styles.footerLinks}>
            <a href="mailto:info@aspect.co.il">צרו קשר</a>
            <Link to="/aspect">כניסה למערכת</Link>
          </div>
          <p className={styles.footerCopyright}>
            © {new Date().getFullYear()} אספקט מערכות. כל הזכויות שמורות.
          </p>
        </div>
      </footer>

      {/* Floating Chat Button */}
      {!chatOpen && (
        <button
          className={styles.floatingChatButton}
          onClick={() => setChatOpen(true)}
          aria-label="פתח צ'אט"
        >
          <span className={styles.floatingChatIcon}>💬</span>
          <span className={styles.floatingChatText}>נסו עכשיו</span>
        </button>
      )}

      {/* Chat Widget Overlay */}
      {chatOpen && (
        <div className={styles.chatOverlay}>
          <div className={styles.chatWidget}>
            <div className={styles.chatWidgetHeader}>
              <div className={styles.chatWidgetTitle}>
                <div className={styles.chatLogoWrapper}>
                  <img src="/img/aspect-logo-regular.png" alt="Aspect" />
                </div>
                <span>Aspect AI</span>
              </div>
              <button
                className={styles.chatCloseButton}
                onClick={() => setChatOpen(false)}
                aria-label="סגור צ'אט"
              >
                ✕
              </button>
            </div>
            <iframe
              src="/aspect?embed=true"
              className={styles.chatIframe}
              title="Aspect AI Chat"
            />
          </div>
        </div>
      )}
    </div>
  );
}
