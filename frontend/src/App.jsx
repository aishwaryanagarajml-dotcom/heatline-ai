import { useState } from "react";
import "./App.css";

const LOCATIONS = {
  Bengaluru: {
    latitude: 12.9716,
    longitude: 77.5946,
  },
  Shivamogga: {
    latitude: 13.9299,
    longitude: 75.5681,
  },
  Mysuru: {
    latitude: 12.2958,
    longitude: 76.6394,
  },
  Hyderabad: {
    latitude: 17.385,
    longitude: 78.4867,
  },
  Chennai: {
    latitude: 13.0827,
    longitude: 80.2707,
  },
};

function formatInlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

function formatBriefingText(text) {
  if (!text) {
    return (
      <p>
        No AI briefing was returned. Continue normal heat-safety
        practices and use the HeatLine risk forecast to plan work.
      </p>
    );
  }

  let normalized = text
    .replace(/\r/g, " ")
    .replace(/\\\*/g, "*")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Put each numbered Gemini section on its own line.
  normalized = normalized.replace(
    /\s+(?=(?:\*\*)?\s*[123]\.\s*(?:Riskiest hours|Recommended shift actions|Heat-safety actions))/gi,
    "\n"
  );

  const sections = normalized
    .split("\n")
    .map((section) => section.trim())
    .filter(Boolean);

  const elements = [];

  sections.forEach((section, sectionIndex) => {
    const sectionMatch = section.match(
      /^(?:\*\*)?\s*(\d+)\.\s*(Riskiest hours|Recommended shift actions|Heat-safety actions)(?:\*\*)?\s*(.*)$/i
    );

    if (!sectionMatch) {
      elements.push(
        <p key={`paragraph-${sectionIndex}`}>
          {formatInlineMarkdown(section)}
        </p>
      );

      return;
    }

    const number = sectionMatch[1];
    const title = sectionMatch[2].trim();

    let content = sectionMatch[3]
      .replace(/\*\*/g, "")
      .replace(/\\\*/g, "*")
      .trim();

    /*
      Gemini may return recommendations like:

      * Route Planning: ...
      * Rest Breaks: ...
      * Buddy System: ...

      Convert these into proper separate bullet items.
    */

    const bulletItems = content
      .split(/\s*(?:\*|•|-)\s+(?=[A-Za-z])/)
      .map((item) => item.trim())
      .filter(Boolean);

    elements.push(
      <div
        className="briefing-section"
        key={`section-${sectionIndex}`}
      >
        <h3>
          {number}. {title}
        </h3>

        {bulletItems.length > 1 ? (
          <ul>
            {bulletItems.map((item, index) => (
              <li key={index}>
                {formatInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {formatInlineMarkdown(content)}
          </p>
        )}
      </div>
    );
  });

  return elements;
}

function App() {
  const [location, setLocation] = useState("Bengaluru");
  const [jobType, setJobType] = useState("delivery partner");
  const [shiftStart, setShiftStart] = useState("10:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const analyzeHeat = async () => {
    setError("");
    setResult(null);

    if (shiftStart >= shiftEnd) {
      setError(
        "Shift end time must be later than shift start time."
      );
      return;
    }

    setLoading(true);

    try {
      const selectedLocation = LOCATIONS[location];

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            location: location,
            job_type: jobType,
            shift_start: shiftStart,
            shift_end: shiftEnd,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Heat analysis failed."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the HeatLine AI backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const shiftResults = result
    ? result.hourly_results.filter((item) => {
        const firstDate =
          result.hourly_results[0].time.slice(0, 10);

        const itemDate =
          item.time.slice(0, 10);

        const hour = Number(
          item.time.slice(11, 13)
        );

        const start = Number(
          shiftStart.slice(0, 2)
        );

        const end = Number(
          shiftEnd.slice(0, 2)
        );

        return (
          itemDate === firstDate &&
          hour >= start &&
          hour <= end
        );
      })
    : [];

  const highRiskCount = shiftResults.filter(
    (item) => item.risk === "HIGH"
  ).length;

  const mediumRiskCount = shiftResults.filter(
    (item) => item.risk === "MEDIUM"
  ).length;

  const lowRiskCount = shiftResults.filter(
    (item) => item.risk === "LOW"
  ).length;

  const averageHsi =
    shiftResults.length > 0
      ? (
          shiftResults.reduce(
            (sum, item) => sum + item.hsi,
            0
          ) / shiftResults.length
        ).toFixed(1)
      : "0.0";

  const peakResult =
    shiftResults.length > 0
      ? shiftResults.reduce((highest, item) =>
          item.hsi > highest.hsi ? item : highest
        )
      : null;

  let overallRisk = "LOW";

  if (highRiskCount > 0) {
    overallRisk = "HIGH";
  } else if (mediumRiskCount > 0) {
    overallRisk = "MEDIUM";
  }

  const getRecommendation = () => {
    if (highRiskCount > 0) {
      return {
        title: "Reduce exposure during peak heat",
        text:
          "Move strenuous outdoor work away from the highest-risk hours where practical. Use cooler periods for heavy tasks and provide shaded or cool recovery areas.",
      };
    }

    if (mediumRiskCount > 0) {
      return {
        title: "Shift demanding work earlier or later",
        text:
          "Consider placing the most physically demanding work outside the medium-risk window where practical, while maintaining access to water, shade or cool recovery areas, and appropriate rest.",
      };
    }

    return {
      title: "Current shift is mostly low risk",
      text:
        "No HIGH or MEDIUM heat-risk hours were identified during this shift by the HeatLine screening model. Continue normal heat-safety practices.",
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-inner">
          <div className="brand-row">
            <div className="logo-mark">H</div>

            <p className="eyebrow">
              HEATLINE AI
            </p>
          </div>

          <h1>
            Plan safer outdoor work.
          </h1>

          <p className="subtitle">
            Hyperlocal heat-risk intelligence for workers and supervisors.
          </p>

          <div className="hero-pills">
            <span>Live weather</span>
            <span>HSI screening</span>
            <span>AI briefing</span>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="card input-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">
                WORK SHIFT
              </p>

              <h2>
                Analyze a work window
              </h2>
            </div>

            <span className="step-label">
              STEP 1
            </span>
          </div>

          <div className="form-grid">
            <label>
              Location

              <select
                value={location}
                onChange={(e) =>
                  setLocation(e.target.value)
                }
              >
                {Object.keys(LOCATIONS).map(
                  (city) => (
                    <option
                      key={city}
                      value={city}
                    >
                      {city}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Job type

              <select
                value={jobType}
                onChange={(e) =>
                  setJobType(e.target.value)
                }
              >
                <option value="delivery partner">
                  Delivery partner
                </option>

                <option value="construction">
                  Construction
                </option>

                <option value="street vendor">
                  Street vendor
                </option>
              </select>
            </label>

            <label>
              Shift starts

              <input
                type="time"
                value={shiftStart}
                onChange={(e) =>
                  setShiftStart(e.target.value)
                }
              />
            </label>

            <label>
              Shift ends

              <input
                type="time"
                value={shiftEnd}
                onChange={(e) =>
                  setShiftEnd(e.target.value)
                }
              />
            </label>
          </div>

          <button
            onClick={analyzeHeat}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Analyzing weather...
              </>
            ) : (
              "Analyze heat risk →"
            )}
          </button>
        </section>

        {error && (
          <section className="card error">
            <p className="eyebrow dark">
              CHECK INPUT
            </p>

            <h2>
              Unable to complete analysis
            </h2>

            <p>{error}</p>

            <button
              className="secondary-button"
              onClick={analyzeHeat}
            >
              Try again
            </button>
          </section>
        )}

        {result && (
          <>
            <section className="result-hero">
              <div>
                <p className="eyebrow">
                  ANALYSIS RESULT
                </p>

                <h2>
                  {result.location}
                </h2>

                <p className="result-meta">
                  {result.job_type} ·{" "}
                  {result.shift.start}–
                  {result.shift.end}
                </p>
              </div>

              <div
                className={
                  "overall-risk " +
                  overallRisk.toLowerCase()
                }
              >
                <span>
                  OVERALL SHIFT RISK
                </span>

                <strong>
                  {overallRisk}
                </strong>

                <small>
                  {highRiskCount > 0
                    ? "Peak exposure detected"
                    : mediumRiskCount > 0
                    ? "Moderate exposure detected"
                    : "No elevated hours detected"}
                </small>
              </div>
            </section>

            <section className="stats-grid">
              <div className="stat-card high">
                <span>HIGH</span>
                <strong>{highRiskCount}</strong>
                <small>hours</small>
              </div>

              <div className="stat-card medium">
                <span>MEDIUM</span>
                <strong>{mediumRiskCount}</strong>
                <small>hours</small>
              </div>

              <div className="stat-card low">
                <span>LOW</span>
                <strong>{lowRiskCount}</strong>
                <small>hours</small>
              </div>

              <div className="stat-card neutral">
                <span>AVG HSI</span>
                <strong>{averageHsi}</strong>
                <small>shift average</small>
              </div>
            </section>

            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow dark">
                    FORECAST
                  </p>

                  <h2>
                    Hourly heat risk
                  </h2>
                </div>

                {peakResult && (
                  <div className="peak-info">
                    <span>Peak</span>

                    <strong>
                      {peakResult.time.slice(11, 16)}
                      {" · "}
                      {peakResult.hsi}
                    </strong>
                  </div>
                )}
              </div>

              <div className="risk-legend">
                <span>
                  <i className="legend-dot low"></i>
                  Low
                </span>

                <span>
                  <i className="legend-dot medium"></i>
                  Medium
                </span>

                <span>
                  <i className="legend-dot high"></i>
                  High
                </span>
              </div>

              <div className="hourly-list">
                {shiftResults.length > 0 ? (
                  shiftResults.map((item) => (
                    <div
                      className="hour-row"
                      key={item.time}
                    >
                      <span className="hour-time">
                        {item.time.slice(11, 16)}
                      </span>

                      <div className="bar">
                        <div
                          className={
                            "bar-fill " +
                            item.risk.toLowerCase()
                          }
                          style={{
                            width:
                              item.hsi + "%",
                          }}
                        />
                      </div>

                      <strong className="hsi-value">
                        {item.hsi}
                      </strong>

                      <span
                        className={
                          "badge " +
                          item.risk.toLowerCase()
                        }
                      >
                        {item.risk}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="empty-state">
                    No hourly results were available
                    for this shift.
                  </p>
                )}
              </div>
            </section>

            <section className="recommendation-card">
              <div className="recommendation-icon">
                ↗
              </div>

              <div className="recommendation-content">
                <p className="eyebrow dark">
                  SHIFT PLANNING
                </p>

                <h2>
                  {recommendation.title}
                </h2>

                <p>
                  {recommendation.text}
                </p>

                <div className="action-tags">
                  <span>
                    Reduce heat exposure
                  </span>

                  <span>
                    Rest & recovery
                  </span>

                  <span>
                    Shade / cool area
                  </span>
                </div>
              </div>
            </section>

            <section className="card briefing">
              <div className="briefing-header">
                <div>
                  <p className="eyebrow dark">
                    AI BRIEFING
                  </p>

                  <h2>
                    Recommended actions
                  </h2>
                </div>

                <span className="ai-badge">
                  GEMINI
                </span>
              </div>

              <div className="briefing-intro">
                HeatLine converts the forecast into
                a short operational briefing for this
                work shift.
              </div>

              <div className="briefing-text">
                {formatBriefingText(
                  result.briefing
                )}
              </div>
            </section>

            <section className="info-card">
              <div>
                <p className="eyebrow dark">
                  ABOUT THE SCORE
                </p>

                <h2>
                  What does HSI mean?
                </h2>

                <p>
                  HeatLine HSI is an MVP screening
                  score based on temperature, humidity,
                  UV exposure, and job-related workload
                  adjustment.
                </p>

                <p className="info-note">
                  It is a proxy indicator for planning
                  and is not a medical diagnosis.
                </p>
              </div>

              <div className="risk-scale">
                <div>
                  <strong>0–39</strong>
                  <span>LOW</span>
                </div>

                <div>
                  <strong>40–69</strong>
                  <span>MEDIUM</span>
                </div>

                <div>
                  <strong>70–100</strong>
                  <span>HIGH</span>
                </div>
              </div>
            </section>

            <section className="disclaimer">
              <strong>Important:</strong>{" "}
              HeatLine HSI is an MVP screening/proxy
              indicator and is not a medical diagnosis
              or a substitute for workplace heat-safety
              guidance.
            </section>
          </>
        )}
      </main>

      <footer>
        <p>
          HeatLine AI · Hyperlocal heat-risk planning
          prototype
        </p>
      </footer>
    </div>
  );
}

export default App;