import { useState, useEffect, useCallback } from "react";

const API = "https://api.openf1.org/v1";

const TEAM_COLORS = {
  "Red Bull Racing": "#3671C6", "McLaren": "#FF8000", "Ferrari": "#E8002D",
  "Mercedes": "#27F4D2", "Aston Martin": "#229971", "Alpine": "#0093CC",
  "Williams": "#64C4FF", "RB": "#6692FF", "Racing Bulls": "#6692FF",
  "Kick Sauber": "#52E252", "Sauber": "#52E252", "Haas F1 Team": "#B6BABD",
  "Cadillac": "#1f1f27", "Audi": "#990000",
};

const TIRE_COLORS = { SOFT: "#FF3333", MEDIUM: "#FFC906", HARD: "#EEEEEE", INTERMEDIATE: "#39B54A", WET: "#0067FF" };
const TIRE_LABELS = { SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W" };

// 2026 F1 Fantasy prices ($M) — from official pricing
const FANTASY_PRICES = {
  1: { name: "Max Verstappen", price: 30.0, team: "Red Bull Racing" },
  4: { name: "Lando Norris", price: 30.0, team: "McLaren" },
  81: { name: "Oscar Piastri", price: 25.0, team: "McLaren" },
  16: { name: "Charles Leclerc", price: 28.0, team: "Ferrari" },
  44: { name: "Lewis Hamilton", price: 22.0, team: "Ferrari" },
  63: { name: "George Russell", price: 20.0, team: "Mercedes" },
  12: { name: "Andrea Kimi Antonelli", price: 14.0, team: "Mercedes" },
  14: { name: "Fernando Alonso", price: 10.0, team: "Aston Martin" },
  18: { name: "Lance Stroll", price: 8.0, team: "Aston Martin" },
  10: { name: "Pierre Gasly", price: 10.0, team: "Alpine" },
  7: { name: "Jack Doohan", price: 6.0, team: "Alpine" },
  23: { name: "Alex Albon", price: 11.0, team: "Williams" },
  55: { name: "Carlos Sainz", price: 11.0, team: "Williams" },
  22: { name: "Yuki Tsunoda", price: 10.0, team: "Racing Bulls" },
  30: { name: "Liam Lawson", price: 7.0, team: "Racing Bulls" },
  87: { name: "Ollie Bearman", price: 7.4, team: "Haas F1 Team" },
  31: { name: "Esteban Ocon", price: 8.0, team: "Haas F1 Team" },
  27: { name: "Nico Hulkenberg", price: 7.0, team: "Kick Sauber" },
  5: { name: "Gabriel Bortoleto", price: 6.0, team: "Kick Sauber" },
  20: { name: "Isack Hadjar", price: 9.0, team: "Racing Bulls" },
};

const CONSTRUCTOR_PRICES = {
  "McLaren": 30.0, "Ferrari": 28.0, "Red Bull Racing": 25.0, "Mercedes": 20.0,
  "Aston Martin": 10.0, "Alpine": 7.0, "Williams": 11.0, "Racing Bulls": 6.3,
  "Haas F1 Team": 8.0, "Kick Sauber": 6.0, "Cadillac": 6.0,
};

const RACE_POINTS = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };

async function f1Fetch(endpoint, params = {}) {
  const url = new URL(`${API}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.append(k, v);
  });
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function formatTime(seconds) {
  if (!seconds || seconds === "null") return "—";
  const s = parseFloat(seconds);
  if (isNaN(s)) return typeof seconds === "string" ? seconds : "—";
  const mins = Math.floor(s / 60);
  const secs = (s % 60).toFixed(3);
  return mins > 0 ? `${mins}:${secs.padStart(6, "0")}` : `${parseFloat(secs).toFixed(3)}`;
}

function formatGap(val) {
  if (val === null || val === undefined) return "LEADER";
  if (typeof val === "string" && val.includes("LAP")) return val;
  const n = parseFloat(val);
  return isNaN(n) ? String(val) : `+${n.toFixed(3)}`;
}

function calcWinProb(position, gapToLeader, tireAge, totalLaps, currentLap) {
  if (position === 1) {
    let base = 65;
    if (tireAge > 15) base -= 8;
    if (totalLaps - currentLap < 10) base += 15;
    return Math.min(95, Math.max(5, base));
  }
  const gap = parseFloat(gapToLeader) || 0;
  if (typeof gapToLeader === "string" && gapToLeader.includes("LAP")) return 0.5;
  const lapsRemaining = Math.max(1, totalLaps - currentLap);
  const timeRecoverable = lapsRemaining * 0.4;
  let prob = Math.max(0, ((timeRecoverable - gap) / timeRecoverable) * 40);
  prob *= Math.max(0.1, 1 - (position - 2) * 0.15);
  if (tireAge < 5) prob *= 1.2;
  if (tireAge > 20) prob *= 0.7;
  return Math.min(40, Math.max(0.5, prob));
}

// ---- Shared Components ----

function TireBadge({ compound }) {
  if (!compound) return <span style={{ color: "#666", fontSize: 11 }}>?</span>;
  const c = compound.toUpperCase();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: "50%",
      background: TIRE_COLORS[c] || "#666",
      color: c === "HARD" || c === "MEDIUM" ? "#111" : "#fff",
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>{TIRE_LABELS[c] || "?"}</span>
  );
}

function WinBar({ pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 90 }}>
      <div style={{ width: 54, height: 6, borderRadius: 3, background: "#2a2a2e", overflow: "hidden" }}>
        <div style={{
          width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 3,
          background: pct > 40 ? "#22c55e" : pct > 15 ? "#eab308" : pct > 5 ? "#f97316" : "#ef4444",
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, color: "#aaa", minWidth: 32, textAlign: "right" }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

function Tab({ label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 20px", background: active ? "#e8002d" : "transparent",
      color: active ? "#fff" : "#999", border: "none", borderRadius: 6, cursor: "pointer",
      fontSize: 13, fontWeight: active ? 700 : 500, letterSpacing: 0.5, transition: "all 0.2s",
      textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6,
    }}>
      {label}
      {badge && <span style={{
        background: active ? "#fff3" : "#e8002d", color: "#fff", fontSize: 9,
        padding: "1px 5px", borderRadius: 8, fontWeight: 700,
      }}>{badge}</span>}
    </button>
  );
}

function LoadingPulse({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, flexDirection: "column", gap: 16 }}>
      <div style={{
        width: 32, height: 32, border: "3px solid #333", borderTop: "3px solid #e8002d",
        borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ color: "#888", fontSize: 13 }}>{text || "Loading data..."}</span>
    </div>
  );
}

function Card({ title, children, style: s, action }) {
  return (
    <div style={{ background: "#18181b", borderRadius: 10, border: "1px solid #27272a", overflow: "hidden", ...s }}>
      {title && (
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #27272a", display: "flex",
          justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "#a1a1aa" }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function TeamBar({ color }) {
  return <div style={{ width: 3, height: 24, borderRadius: 2, background: color, flexShrink: 0 }} />;
}

// ---- Live Session ----

function LiveSession({ sessionKey, drivers }) {
  const [positions, setPositions] = useState([]);
  const [intervals, setIntervals] = useState([]);
  const [stints, setStints] = useState([]);
  const [laps, setLaps] = useState([]);
  const [pits, setPits] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!sessionKey) return;
    const [pos, intv, st, lap, pit, weath] = await Promise.all([
      f1Fetch("position", { session_key: sessionKey }),
      f1Fetch("intervals", { session_key: sessionKey }),
      f1Fetch("stints", { session_key: sessionKey }),
      f1Fetch("laps", { session_key: sessionKey }),
      f1Fetch("pit", { session_key: sessionKey }),
      f1Fetch("weather", { session_key: sessionKey }),
    ]);
    setPositions(pos); setIntervals(intv); setStints(st); setLaps(lap); setPits(pit);
    if (weath.length) setWeather(weath[weath.length - 1]);
    setLoading(false); setLastUpdate(new Date());
  }, [sessionKey]);

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 15000); return () => clearInterval(id); }, [fetchAll]);

  if (loading) return <LoadingPulse text="Fetching session data..." />;

  const latestPos = {}, latestInt = {}, latestStint = {}, latestLap = {};
  positions.forEach(p => { if (!latestPos[p.driver_number] || new Date(p.date) > new Date(latestPos[p.driver_number].date)) latestPos[p.driver_number] = p; });
  intervals.forEach(i => { if (!latestInt[i.driver_number] || new Date(i.date) > new Date(latestInt[i.driver_number].date)) latestInt[i.driver_number] = i; });
  stints.forEach(s => { if (!latestStint[s.driver_number] || s.stint_number > latestStint[s.driver_number].stint_number) latestStint[s.driver_number] = s; });
  laps.forEach(l => { if (!latestLap[l.driver_number] || l.lap_number > latestLap[l.driver_number].lap_number) latestLap[l.driver_number] = l; });

  const allLapNums = laps.map(l => l.lap_number).filter(Boolean);
  const currentLap = allLapNums.length ? Math.max(...allLapNums) : 0;
  const totalLaps = 57;
  const sorted = Object.values(latestPos).sort((a, b) => (a.position || 99) - (b.position || 99));

  const pitsByDriver = {};
  pits.forEach(p => { if (!pitsByDriver[p.driver_number]) pitsByDriver[p.driver_number] = []; pitsByDriver[p.driver_number].push(p); });

  const driverMap = {};
  drivers.forEach(d => driverMap[d.driver_number] = d);

  const winProbs = {};
  sorted.forEach(p => {
    const stintData = latestStint[p.driver_number];
    const tireAge = stintData ? currentLap - (stintData.lap_start || 0) : currentLap;
    winProbs[p.driver_number] = calcWinProb(p.position, latestInt[p.driver_number]?.gap_to_leader, tireAge, totalLaps, currentLap);
  });
  const totalProb = Object.values(winProbs).reduce((a, b) => a + b, 0);
  if (totalProb > 0) Object.keys(winProbs).forEach(k => winProbs[k] = (winProbs[k] / totalProb) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#888" }}>LAP {currentLap}/{totalLaps}</span>
          {weather && <span style={{ fontSize: 11, color: "#888" }}>{weather.air_temperature}°C · Track {weather.track_temperature}°C · {weather.rainfall ? "🌧 Rain" : "☀ Dry"} · 💨 {weather.wind_speed}km/h</span>}
        </div>
        <div style={{ fontSize: 10, color: "#555" }}>
          {lastUpdate && `Updated ${lastUpdate.toLocaleTimeString()}`}
          <span style={{ marginLeft: 8, color: "#e8002d", cursor: "pointer" }} onClick={fetchAll}>↻ Refresh</span>
        </div>
      </div>

      <Card title="Race Leaderboard">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#71717a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                <th style={{ textAlign: "left", padding: "6px 8px", width: 30 }}>P</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Driver</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>Tire</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Interval</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Gap to Leader</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Last Lap</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>Stops</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Win %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const d = driverMap[p.driver_number] || {};
                const intData = latestInt[p.driver_number];
                const stintData = latestStint[p.driver_number];
                const lapData = latestLap[p.driver_number];
                const driverPits = pitsByDriver[p.driver_number] || [];
                const teamColor = TEAM_COLORS[d.team_name] || `#${d.team_colour || "888"}`;
                return (
                  <tr key={p.driver_number} style={{ borderTop: i > 0 ? "1px solid #27272a" : "none", background: i % 2 === 0 ? "transparent" : "#1c1c1f" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 800, fontSize: 15, color: i < 3 ? "#fff" : "#888" }}>{p.position}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <TeamBar color={teamColor} />
                        <div>
                          <span style={{ fontWeight: 700, color: "#f4f4f5" }}>{d.name_acronym || `#${p.driver_number}`}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: "#71717a" }}>{d.first_name} {d.last_name}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <TireBadge compound={stintData?.compound} />
                        {stintData && <span style={{ fontSize: 10, color: "#666" }}>L{currentLap - (stintData.lap_start || 0)}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: intData?.interval === null ? "#22c55e" : "#d4d4d8" }}>{formatGap(intData?.interval)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#a1a1aa" }}>{formatGap(intData?.gap_to_leader)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#d4d4d8" }}>{formatTime(lapData?.lap_duration)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", color: "#a1a1aa" }}>{driverPits.length}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}><WinBar pct={winProbs[p.driver_number] || 0} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {pits.length > 0 && (
        <Card title="Pit Stops">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#71717a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Driver</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>Lap</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Stop Time</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Pit Duration</th>
                </tr>
              </thead>
              <tbody>
                {[...pits].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20).map((p, i) => {
                  const d = driverMap[p.driver_number] || {};
                  return (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid #27272a" : "none" }}>
                      <td style={{ padding: "8px", fontWeight: 600 }}>{d.name_acronym || `#${p.driver_number}`}</td>
                      <td style={{ padding: "8px", textAlign: "center", color: "#a1a1aa" }}>{p.lap_number}</td>
                      <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: p.stop_duration < 3 ? "#22c55e" : p.stop_duration < 4 ? "#eab308" : "#ef4444" }}>{p.stop_duration?.toFixed(1)}s</td>
                      <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: "#a1a1aa" }}>{p.pit_duration?.toFixed(1)}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---- Standings (always available — searches recent races) ----

function Standings() {
  const [driverStandings, setDriverStandings] = useState([]);
  const [teamStandings, setTeamStandings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("drivers");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      let ds = [], ts = [];
      let foundSessionKey = null;

      // Helper: try championship endpoints for a given session key
      async function tryChampionship(sk) {
        const [d, t] = await Promise.all([
          f1Fetch("championship_drivers", { session_key: sk }),
          f1Fetch("championship_teams", { session_key: sk }),
        ]);
        return { drivers: d, teams: t };
      }

      // Helper: check if a session is a race
      function isRaceSession(s) {
        const name = (s.session_name || "").toLowerCase();
        return name === "race" || name === "sprint" || name.includes("race");
      }

      try {
        // Strategy 1: Try "latest" session directly
        const latestResult = await tryChampionship("latest");
        if (latestResult.drivers.length) {
          ds = latestResult.drivers;
          ts = latestResult.teams;
          foundSessionKey = ds[0]?.session_key;
          setSource("Latest session");
        }

        // Strategy 2: Get all 2026 sessions and find race sessions
        if (!ds.length) {
          const allSessions2026 = await f1Fetch("sessions", { year: 2026 });
          // Sort by date descending, filter to race sessions
          const raceSessions = allSessions2026
            .filter(isRaceSession)
            .sort((a, b) => new Date(b.date_start || b.date_end || 0) - new Date(a.date_start || a.date_end || 0));

          for (const race of raceSessions) {
            if (ds.length) break;
            const result = await tryChampionship(race.session_key);
            if (result.drivers.length) {
              ds = result.drivers;
              ts = result.teams;
              foundSessionKey = race.session_key;
              const meetingName = race.country_name || race.circuit_short_name || "";
              setSource(`${race.session_name} — ${meetingName} 2026`);
            }
          }

          // If no championship data, try session_result endpoint for race results
          if (!ds.length && raceSessions.length) {
            const lastRace = raceSessions[0];
            const results = await f1Fetch("session_result", { session_key: lastRace.session_key });
            if (results.length) {
              // Build pseudo-standings from session_result
              ds = results.map(r => ({
                driver_number: r.driver_number,
                position_current: r.position,
                points_current: r.points || RACE_POINTS[r.position] || 0,
                position_start: r.grid_position || r.position,
                session_key: lastRace.session_key,
              })).sort((a, b) => a.position_current - b.position_current);
              foundSessionKey = lastRace.session_key;
              setSource(`${lastRace.session_name} — ${lastRace.country_name || ""} 2026 (race result)`);
            }
          }
        }

        // Strategy 3: Fallback to 2025 season
        if (!ds.length) {
          const allSessions2025 = await f1Fetch("sessions", { year: 2025 });
          const raceSessions2025 = allSessions2025
            .filter(isRaceSession)
            .sort((a, b) => new Date(b.date_start || b.date_end || 0) - new Date(a.date_start || a.date_end || 0));

          for (const race of raceSessions2025.slice(0, 5)) {
            if (ds.length) break;
            const result = await tryChampionship(race.session_key);
            if (result.drivers.length) {
              ds = result.drivers;
              ts = result.teams;
              foundSessionKey = race.session_key;
              setSource(`${race.session_name} — ${race.country_name || ""} 2025`);
            }
          }
        }

        // Strategy 4: If still nothing, try fetching sessions by meeting
        if (!ds.length) {
          const meetings = await f1Fetch("meetings", { year: 2026 });
          if (!meetings.length) {
            const m2025 = await f1Fetch("meetings", { year: 2025 });
            meetings.push(...m2025);
          }
          for (let i = meetings.length - 1; i >= Math.max(0, meetings.length - 5) && !ds.length; i--) {
            const sessions = await f1Fetch("sessions", { meeting_key: meetings[i].meeting_key });
            const races = sessions.filter(isRaceSession);
            for (const race of races.reverse()) {
              if (ds.length) break;
              const result = await tryChampionship(race.session_key);
              if (result.drivers.length) {
                ds = result.drivers;
                ts = result.teams;
                foundSessionKey = race.session_key;
                setSource(meetings[i].meeting_name || meetings[i].country_name || "Recent race");
              }
            }
          }
        }

        // Load driver details
        if (foundSessionKey) {
          const drv = await f1Fetch("drivers", { session_key: foundSessionKey });
          if (drv.length) setDrivers(drv);
        }

        if (!ds.length) {
          setError("Could not find championship data. The API may not have published standings yet for the latest race.");
        }
      } catch (e) {
        setError("Error loading standings: " + e.message);
      }

      setDriverStandings([...ds].sort((a, b) => (a.position_current || 99) - (b.position_current || 99)));
      setTeamStandings([...ts].sort((a, b) => (a.position_current || 99) - (b.position_current || 99)));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingPulse text="Searching for championship data..." />;

  const driverMap = {};
  drivers.forEach(d => driverMap[d.driver_number] = d);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Tab label="Drivers" active={view === "drivers"} onClick={() => setView("drivers")} />
          <Tab label="Constructors" active={view === "teams"} onClick={() => setView("teams")} />
        </div>
        {source && <span style={{ fontSize: 10, color: "#52525b" }}>Data from: {source}</span>}
      </div>

      {view === "drivers" ? (
        <Card title="Driver Championship">
          {driverStandings.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <p style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>{error || "Searching for championship data..."}</p>
              <p style={{ color: "#52525b", fontSize: 11 }}>
                The championship endpoint requires completed race sessions. If the season just started,
                data may take a short time to be published after a race finishes.
              </p>
            </div>
          ) : driverStandings.map((d, i) => {
            const maxPts = driverStandings[0]?.points_current || 1;
            const drv = driverMap[d.driver_number] || {};
            const teamColor = TEAM_COLORS[drv.team_name] || `#${drv.team_colour || "555"}`;
            const posChange = (d.position_start || d.position_current) - d.position_current;
            return (
              <div key={d.driver_number} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: i < driverStandings.length - 1 ? "1px solid #27272a" : "none",
              }}>
                <span style={{ width: 28, fontWeight: 800, fontSize: 15, color: i < 3 ? "#fff" : "#888", textAlign: "right" }}>{d.position_current}</span>
                <TeamBar color={teamColor} />
                <div style={{ width: 100 }}>
                  <div style={{ fontWeight: 700, color: "#f4f4f5", fontSize: 13 }}>{drv.name_acronym || `#${d.driver_number}`}</div>
                  <div style={{ fontSize: 10, color: "#52525b" }}>{drv.team_name || ""}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 6, borderRadius: 3, background: "#2a2a2e", overflow: "hidden" }}>
                    <div style={{ width: `${(d.points_current / maxPts) * 100}%`, height: "100%", borderRadius: 3, background: teamColor, transition: "width 0.5s" }} />
                  </div>
                </div>
                <span style={{ width: 50, textAlign: "right", fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{d.points_current}</span>
                <span style={{ fontSize: 10, color: "#555", width: 24 }}>pts</span>
                {posChange !== 0 && <span style={{ fontSize: 10, color: posChange > 0 ? "#22c55e" : "#ef4444", width: 20 }}>{posChange > 0 ? `▲${posChange}` : `▼${Math.abs(posChange)}`}</span>}
              </div>
            );
          })}
        </Card>
      ) : (
        <Card title="Constructor Championship">
          {teamStandings.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center" }}>
              <p style={{ color: "#888", fontSize: 13 }}>{error || "No constructor championship data found."}</p>
              <p style={{ color: "#52525b", fontSize: 11 }}>Constructor standings require completed race sessions.</p>
            </div>
          ) : teamStandings.map((t, i) => {
            const maxPts = teamStandings[0]?.points_current || 1;
            const color = TEAM_COLORS[t.team_name] || "#888";
            const posChange = (t.position_start || t.position_current) - t.position_current;
            return (
              <div key={t.team_name} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                borderBottom: i < teamStandings.length - 1 ? "1px solid #27272a" : "none",
              }}>
                <span style={{ width: 28, fontWeight: 800, fontSize: 15, color: i < 3 ? "#fff" : "#888", textAlign: "right" }}>{t.position_current}</span>
                <TeamBar color={color} />
                <span style={{ width: 120, fontWeight: 600, color: "#f4f4f5", fontSize: 13 }}>{t.team_name}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 6, borderRadius: 3, background: "#2a2a2e", overflow: "hidden" }}>
                    <div style={{ width: `${(t.points_current / maxPts) * 100}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.5s" }} />
                  </div>
                </div>
                <span style={{ width: 50, textAlign: "right", fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{t.points_current}</span>
                <span style={{ fontSize: 10, color: "#555", width: 24 }}>pts</span>
                {posChange !== 0 && <span style={{ fontSize: 10, color: posChange > 0 ? "#22c55e" : "#ef4444", width: 20 }}>{posChange > 0 ? `▲${posChange}` : `▼${Math.abs(posChange)}`}</span>}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ---- Fantasy Predictor ----

function FantasyPredictor() {
  const [sessionResults, setSessionResults] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState(100);
  const [tab, setTab] = useState("picks");

  useEffect(() => {
    async function load() {
      const meetings2026 = await f1Fetch("meetings", { year: 2026 });
      const meetings2025 = await f1Fetch("meetings", { year: 2025 });
      // Prefer 2026, fallback to 2025
      const allMeetings = [...(meetings2026.length ? meetings2026 : []), ...(meetings2025.length ? meetings2025 : [])];
      const recentMeetings = allMeetings.slice(-8);

      let allResults = [];
      let latestDrivers = [];

      // Helper: case-insensitive race detection
      const isRace = (s) => {
        const name = (s.session_name || "").toLowerCase();
        return name === "race" || name.includes("race");
      };

      for (const m of recentMeetings.reverse()) {
        const sessions = await f1Fetch("sessions", { meeting_key: m.meeting_key });
        const race = sessions.find(isRace);
        if (race) {
          // Try position data first
          const positions = await f1Fetch("position", { session_key: race.session_key });
          const drvs = await f1Fetch("drivers", { session_key: race.session_key });
          if (!latestDrivers.length && drvs.length) latestDrivers = drvs;

          let results = [];
          if (positions.length) {
            const finalPos = {};
            positions.forEach(p => {
              if (!finalPos[p.driver_number] || new Date(p.date) > new Date(finalPos[p.driver_number].date))
                finalPos[p.driver_number] = p;
            });
            results = Object.values(finalPos).sort((a, b) => (a.position || 99) - (b.position || 99));
          } else {
            // Fallback: try session_result
            const sr = await f1Fetch("session_result", { session_key: race.session_key });
            results = sr.map(r => ({ driver_number: r.driver_number, position: r.position, date: r.date }));
          }

          if (results.length) {
            allResults.push({ meeting: m, session: race, results });
          }
        }
        if (allResults.length >= 5) break;
      }

      // If still no data, try year-based session query
      if (!allResults.length) {
        const sessions2026 = await f1Fetch("sessions", { year: 2026 });
        const races = sessions2026.filter(isRace).sort((a, b) => new Date(b.date_start || 0) - new Date(a.date_start || 0));
        for (const race of races.slice(0, 5)) {
          const positions = await f1Fetch("position", { session_key: race.session_key });
          const drvs = await f1Fetch("drivers", { session_key: race.session_key });
          if (!latestDrivers.length && drvs.length) latestDrivers = drvs;
          if (positions.length) {
            const finalPos = {};
            positions.forEach(p => { if (!finalPos[p.driver_number] || new Date(p.date) > new Date(finalPos[p.driver_number].date)) finalPos[p.driver_number] = p; });
            allResults.push({ meeting: { meeting_name: race.country_name }, session: race, results: Object.values(finalPos).sort((a, b) => (a.position || 99) - (b.position || 99)) });
          }
          if (allResults.length >= 5) break;
        }
      }

      setSessionResults(allResults);
      setDrivers(latestDrivers);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingPulse text="Analyzing race data for fantasy predictions..." />;

  const driverMap = {};
  drivers.forEach(d => driverMap[d.driver_number] = d);

  const fantasyScores = {};
  const raceCount = {};
  const posHistory = {};

  sessionResults.forEach(sr => {
    sr.results.forEach(r => {
      const dn = r.driver_number;
      if (!fantasyScores[dn]) { fantasyScores[dn] = 0; raceCount[dn] = 0; posHistory[dn] = []; }
      raceCount[dn]++;
      posHistory[dn].push(r.position);
      fantasyScores[dn] += RACE_POINTS[r.position] || 0;
    });
  });

  const analysis = Object.keys(fantasyScores).map(dn => {
    const num = parseInt(dn);
    const d = driverMap[num] || {};
    const fp = FANTASY_PRICES[num];
    const price = fp?.price || 10;
    const avgPos = posHistory[num].length ? posHistory[num].reduce((a, b) => a + b, 0) / posHistory[num].length : 20;
    const avgFantasyPts = raceCount[num] ? fantasyScores[num] / raceCount[num] : 0;
    const ppm = price > 0 ? avgFantasyPts / price : 0;
    const consistency = posHistory[num].length > 1
      ? 1 - (Math.sqrt(posHistory[num].reduce((sum, p) => sum + Math.pow(p - avgPos, 2), 0) / posHistory[num].length) / 10)
      : 0.5;
    const bestFinish = posHistory[num].length ? Math.min(...posHistory[num]) : 20;
    const trend = posHistory[num].length >= 2
      ? posHistory[num][posHistory[num].length - 1] < posHistory[num][0] ? "up" : posHistory[num][posHistory[num].length - 1] > posHistory[num][0] ? "down" : "flat"
      : "flat";

    const valueScore = Math.min(100, ppm * 30);
    const performanceScore = Math.max(0, 100 - avgPos * 5);
    const consistencyScore = consistency * 100;
    const overallScore = valueScore * 0.35 + performanceScore * 0.4 + consistencyScore * 0.25;

    return {
      driver_number: num, name: fp?.name || d.full_name || d.name_acronym || `#${num}`,
      acronym: d.name_acronym || fp?.name?.split(" ").pop()?.substring(0, 3).toUpperCase() || `#${num}`,
      team: fp?.team || d.team_name || "Unknown", price, avgPos: avgPos.toFixed(1),
      avgFantasyPts: avgFantasyPts.toFixed(1), ppm: ppm.toFixed(2),
      consistency: (consistency * 100).toFixed(0), bestFinish, trend,
      overallScore: overallScore.toFixed(1), races: raceCount[num] || 0,
      posHistory: posHistory[num] || [],
      teamColor: TEAM_COLORS[fp?.team || d.team_name] || `#${d.team_colour || "888"}`,
    };
  }).filter(a => a.races > 0).sort((a, b) => b.overallScore - a.overallScore);

  function autoPick(maxBudget) {
    const sorted = [...analysis].sort((a, b) => b.overallScore - a.overallScore);
    const picked = []; let spent = 0; const teams = {};
    for (const d of sorted) {
      if (picked.length >= 5) break;
      if (spent + d.price <= maxBudget - 12) {
        if ((teams[d.team] || 0) < 2) { picked.push(d); spent += d.price; teams[d.team] = (teams[d.team] || 0) + 1; }
      }
    }
    const remaining = maxBudget - spent;
    const constructorScores = {};
    analysis.forEach(d => {
      if (!constructorScores[d.team]) constructorScores[d.team] = { total: 0, count: 0, price: CONSTRUCTOR_PRICES[d.team] || 10 };
      constructorScores[d.team].total += parseFloat(d.avgFantasyPts);
      constructorScores[d.team].count++;
    });
    const sortedC = Object.entries(constructorScores).map(([name, data]) => ({ name, avgPts: data.total, price: data.price, ppm: data.total / data.price })).sort((a, b) => b.ppm - a.ppm);
    const pickedC = []; let cSpent = 0;
    for (const c of sortedC) { if (pickedC.length >= 2) break; if (cSpent + c.price <= remaining) { pickedC.push(c); cSpent += c.price; } }
    return { drivers: picked, constructors: pickedC, totalCost: spent + cSpent };
  }

  const bestTeam = autoPick(budget);
  const boostPick = bestTeam.drivers.length ? bestTeam.drivers.reduce((best, d) => parseFloat(d.avgFantasyPts) > parseFloat(best.avgFantasyPts) ? d : best, bestTeam.drivers[0]) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Tab label="Best Picks" active={tab === "picks"} onClick={() => setTab("picks")} badge="AI" />
        <Tab label="All Drivers" active={tab === "all"} onClick={() => setTab("all")} />
        <Tab label="Value Picks" active={tab === "value"} onClick={() => setTab("value")} />
      </div>

      {tab === "picks" && (
        <>
          <Card title="Your Fantasy Team">
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#a1a1aa" }}>Budget Cap</span>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#22c55e" }}>${budget}M</span>
              </div>
              <input type="range" min={50} max={100} value={budget} onChange={e => setBudget(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#e8002d" }} />
            </div>

            <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Recommended Drivers (5)</div>
            {bestTeam.drivers.map((d, i) => (
              <div key={d.driver_number} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < bestTeam.drivers.length - 1 ? "1px solid #27272a" : "none" }}>
                <TeamBar color={d.teamColor} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#f4f4f5" }}>{d.acronym}</span>
                    <span style={{ fontSize: 11, color: "#71717a" }}>{d.name}</span>
                    {boostPick && boostPick.driver_number === d.driver_number && (
                      <span style={{ background: "#e8002d", color: "#fff", fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>2X BOOST</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "#52525b" }}>{d.team}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>${d.price}M</div>
                  <div style={{ fontSize: 10, color: "#22c55e" }}>~{d.avgFantasyPts} pts/race</div>
                </div>
              </div>
            ))}

            <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 16, marginBottom: 10 }}>Recommended Constructors (2)</div>
            {bestTeam.constructors.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < bestTeam.constructors.length - 1 ? "1px solid #27272a" : "none" }}>
                <TeamBar color={TEAM_COLORS[c.name] || "#888"} />
                <span style={{ flex: 1, fontWeight: 600, color: "#f4f4f5" }}>{c.name}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>${c.price}M</div>
                  <div style={{ fontSize: 10, color: "#22c55e" }}>~{c.avgPts.toFixed(1)} pts/race</div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, padding: "10px 0", borderTop: "1px solid #27272a" }}>
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>Total Cost</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: bestTeam.totalCost <= budget ? "#22c55e" : "#ef4444" }}>${bestTeam.totalCost.toFixed(1)}M / ${budget}M</span>
            </div>
          </Card>

          <Card title="Strategy Tips">
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#d4d4d8" }}>
              <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#e8002d", fontWeight: 700, flexShrink: 0 }}>💡</span><span>Use your <strong style={{ color: "#fff" }}>2X Boost</strong> on {boostPick?.name || "your best performer"} — highest avg fantasy points per race.</span></div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#e8002d", fontWeight: 700, flexShrink: 0 }}>📈</span><span>Focus on <strong style={{ color: "#fff" }}>Points Per Million (PPM)</strong> — midfield drivers who overperform their price are the key to winning.</span></div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#e8002d", fontWeight: 700, flexShrink: 0 }}>⚡</span><span>Save <strong style={{ color: "#fff" }}>No Negative</strong> chip for street circuits (Monaco, Singapore, Jeddah) where DNF risk is highest.</span></div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#e8002d", fontWeight: 700, flexShrink: 0 }}>🎯</span><span>Use <strong style={{ color: "#fff" }}>Limitless</strong> during Sprint weekends for double the scoring opportunity.</span></div>
              <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#e8002d", fontWeight: 700, flexShrink: 0 }}>🔄</span><span>Transfers are now <strong style={{ color: "#fff" }}>net-based</strong> in 2026 — experiment freely and only your final changes count.</span></div>
            </div>
          </Card>
        </>
      )}

      {tab === "all" && (
        <Card title="Driver Rankings — Fantasy Score">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#71717a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Driver</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Avg Pos</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Avg Pts</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>PPM</th>
                  <th style={{ textAlign: "center", padding: "6px 8px" }}>Trend</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {analysis.map((d, i) => (
                  <tr key={d.driver_number} style={{ borderTop: i > 0 ? "1px solid #27272a" : "none", background: i % 2 === 0 ? "transparent" : "#1c1c1f" }}>
                    <td style={{ padding: "8px", fontWeight: 700, color: i < 3 ? "#fff" : "#888" }}>{i + 1}</td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <TeamBar color={d.teamColor} />
                        <div><span style={{ fontWeight: 700, color: "#f4f4f5" }}>{d.acronym}</span><span style={{ marginLeft: 6, fontSize: 10, color: "#52525b" }}>{d.team}</span></div>
                      </div>
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace" }}>${d.price}M</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: parseFloat(d.avgPos) <= 5 ? "#22c55e" : "#a1a1aa" }}>{d.avgPos}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{d.avgFantasyPts}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: parseFloat(d.ppm) > 1.5 ? "#22c55e" : "#a1a1aa" }}>{d.ppm}</td>
                    <td style={{ padding: "8px", textAlign: "center", fontSize: 14 }}>{d.trend === "up" ? "📈" : d.trend === "down" ? "📉" : "➡️"}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: parseFloat(d.overallScore) > 60 ? "#22c55e" : parseFloat(d.overallScore) > 40 ? "#eab308" : "#ef4444" }}>{d.overallScore}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "value" && (
        <Card title="Best Value Picks — Points Per Million">
          <p style={{ fontSize: 12, color: "#71717a", marginBottom: 16 }}>Highest scoring drivers relative to their price — the hidden gems for your fantasy team.</p>
          {[...analysis].sort((a, b) => parseFloat(b.ppm) - parseFloat(a.ppm)).slice(0, 10).map((d, i) => (
            <div key={d.driver_number} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
              borderBottom: i < 9 ? "1px solid #27272a" : "none",
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: i < 3 ? "#e8002d" : "#27272a", color: "#fff", fontSize: 12, fontWeight: 800,
              }}>{i + 1}</span>
              <TeamBar color={d.teamColor} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#f4f4f5" }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "#52525b" }}>{d.team} · ${d.price}M</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "monospace", fontWeight: 800, color: "#22c55e", fontSize: 16 }}>{d.ppm}</div>
                <div style={{ fontSize: 9, color: "#71717a" }}>pts/$M</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {analysis.length === 0 && (
        <Card><p style={{ color: "#888", fontSize: 13, textAlign: "center", padding: 20 }}>No race data available yet. Predictions will appear once the season starts and race results are in.</p></Card>
      )}
    </div>
  );
}

// ---- Schedule ----

function Schedule() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const m2026 = await f1Fetch("meetings", { year: 2026 });
      const m2025 = await f1Fetch("meetings", { year: 2025 });
      setMeetings((m2026.length ? m2026 : m2025).sort((a, b) => new Date(a.date_start) - new Date(b.date_start)));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingPulse text="Loading schedule..." />;
  const now = new Date();
  const nextRace = meetings.find(m => new Date(m.date_start) > now);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {nextRace && <CountdownCard meeting={nextRace} />}
      <Card title={`${meetings[0]?.year || "2026"} Calendar`}>
        {meetings.map((m, i) => {
          const start = new Date(m.date_start);
          const isPast = start < now;
          const isNext = nextRace && m.meeting_key === nextRace.meeting_key;
          return (
            <div key={m.meeting_key} style={{
              display: "flex", alignItems: "center", gap: 16, padding: "12px 0",
              borderBottom: i < meetings.length - 1 ? "1px solid #27272a" : "none", opacity: isPast ? 0.4 : 1,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: isNext ? "#e8002d" : isPast ? "#52525b" : "#3f3f46", boxShadow: isNext ? "0 0 8px #e8002d88" : "none" }} />
              <div style={{ width: 100, fontSize: 11, color: "#71717a" }}>{start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: "#f4f4f5", fontSize: 13 }}>{m.meeting_name || m.meeting_official_name}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: "#71717a" }}>{m.country_name}</span>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function CountdownCard({ meeting }) {
  const [tl, setTl] = useState({});
  useEffect(() => {
    const calc = () => { const d = new Date(meeting.date_start) - new Date(); return d <= 0 ? { days: 0, hours: 0, mins: 0, secs: 0 } : { days: Math.floor(d / 86400000), hours: Math.floor((d % 86400000) / 3600000), mins: Math.floor((d % 3600000) / 60000), secs: Math.floor((d % 60000) / 1000) }; };
    setTl(calc()); const id = setInterval(() => setTl(calc()), 1000); return () => clearInterval(id);
  }, [meeting]);
  return (
    <Card>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Next Race</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5", marginBottom: 4 }}>{meeting.meeting_name || meeting.meeting_official_name}</div>
        <div style={{ fontSize: 12, color: "#71717a", marginBottom: 20 }}>{meeting.country_name} · {new Date(meeting.date_start).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
          {[["days", tl.days], ["hrs", tl.hours], ["min", tl.mins], ["sec", tl.secs]].map(([l, v]) => (
            <div key={l}><div style={{ fontSize: 32, fontWeight: 800, color: "#e8002d", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{String(v || 0).padStart(2, "0")}</div><div style={{ fontSize: 9, color: "#71717a", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 4 }}>{l}</div></div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---- Lap Times ----

function LapTimes({ sessionKey, drivers }) {
  const [laps, setLaps] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { if (!sessionKey) { setLoading(false); return; } setLaps(await f1Fetch("laps", { session_key: sessionKey })); setLoading(false); })(); }, [sessionKey]);

  if (loading) return <LoadingPulse text="Loading lap times..." />;
  const driverMap = {}; drivers.forEach(d => driverMap[d.driver_number] = d);
  const driverNums = [...new Set(laps.map(l => l.driver_number))];
  const active = selectedDriver || driverNums[0];
  const driverLaps = laps.filter(l => l.driver_number === active).sort((a, b) => a.lap_number - b.lap_number);
  const fastest = driverLaps.reduce((best, l) => l.lap_duration && (!best || l.lap_duration < best.lap_duration) ? l : best, null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {driverNums.map(dn => {
          const d = driverMap[dn] || {}; const isA = dn === active;
          return <button key={dn} onClick={() => setSelectedDriver(dn)} style={{ padding: "4px 10px", borderRadius: 4, border: `1px solid ${isA ? `#${d.team_colour || "e8002d"}` : "#333"}`, background: isA ? `#${d.team_colour || "e8002d"}22` : "transparent", color: isA ? "#fff" : "#888", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{d.name_acronym || `#${dn}`}</button>;
        })}
      </div>
      <Card title={`Lap Times — ${driverMap[active]?.full_name || `#${active}`}`}>
        {driverLaps.length === 0 ? <p style={{ color: "#888", fontSize: 13 }}>No lap data available.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ color: "#71717a", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>Lap</th><th style={{ textAlign: "right", padding: "6px 8px" }}>Time</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>S1</th><th style={{ textAlign: "right", padding: "6px 8px" }}>S2</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>S3</th><th style={{ textAlign: "right", padding: "6px 8px" }}>Speed</th>
              </tr></thead>
              <tbody>{driverLaps.map((l, i) => {
                const isF = fastest && l.lap_number === fastest.lap_number;
                return (
                  <tr key={l.lap_number} style={{ borderTop: i > 0 ? "1px solid #27272a" : "none", background: isF ? "#e8002d11" : "transparent" }}>
                    <td style={{ padding: "8px", textAlign: "center", fontWeight: 600, color: isF ? "#e8002d" : "#a1a1aa" }}>{l.lap_number}{isF && <span style={{ marginLeft: 4, fontSize: 9 }}>⚡</span>}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", fontWeight: isF ? 700 : 400, color: isF ? "#a855f7" : "#d4d4d8" }}>{formatTime(l.lap_duration)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: "#a1a1aa" }}>{formatTime(l.duration_sector_1)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: "#a1a1aa" }}>{formatTime(l.duration_sector_2)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: "#a1a1aa" }}>{formatTime(l.duration_sector_3)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace", color: "#a1a1aa" }}>{l.st_speed ? `${l.st_speed}` : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- Main App ----

export default function F1Dashboard() {
  const [tab, setTab] = useState("live");
  const [sessionKey, setSessionKey] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Get latest session info
      const sess = await f1Fetch("sessions", { session_key: "latest" });
      const latestSK = sess.length ? sess[0].session_key : null;

      // Try to get all sessions for the latest 2026 meeting
      const meetings = await f1Fetch("meetings", { year: 2026 });
      let allSessions = [];

      if (meetings.length) {
        // Get sessions from the most recent meeting
        const latestMeeting = meetings[meetings.length - 1];
        allSessions = await f1Fetch("sessions", { meeting_key: latestMeeting.meeting_key });

        // If current meeting has no sessions yet, try the previous meeting
        if (!allSessions.length && meetings.length > 1) {
          const prevMeeting = meetings[meetings.length - 2];
          allSessions = await f1Fetch("sessions", { meeting_key: prevMeeting.meeting_key });
        }
      }

      // Fallback: if no meetings/sessions found, try year-based session query
      if (!allSessions.length) {
        allSessions = await f1Fetch("sessions", { year: 2026 });
        // Take last few sessions
        if (allSessions.length > 10) allSessions = allSessions.slice(-10);
      }

      // Final fallback to latest
      if (!allSessions.length && latestSK) allSessions = sess;

      setSessions(allSessions);
      const sk = latestSK || (allSessions.length ? allSessions[allSessions.length - 1].session_key : null);
      setSessionKey(sk); setSelectedSession(sk);
      if (sk) setDrivers(await f1Fetch("drivers", { session_key: sk }));
      setInitLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (selectedSession) { setSessionKey(selectedSession); const drv = await f1Fetch("drivers", { session_key: selectedSession }); if (drv.length) setDrivers(drv); }
    })();
  }, [selectedSession]);

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Capture the PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show banner if not already installed
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  // Detect if running as standalone PWA
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#f4f4f5", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", paddingTop: isStandalone ? 'env(safe-area-inset-top)' : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #18181b; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        body { background: #09090b; overscroll-behavior: none; }
        input[type="range"] { height: 4px; }
        @media (max-width: 640px) {
          nav { gap: 2px !important; padding: 6px 12px !important; }
          nav button { padding: 6px 12px !important; font-size: 11px !important; }
          main { padding: 12px !important; }
          header { padding: 12px 16px !important; }
        }
      `}</style>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{
          background: "linear-gradient(135deg, #e8002d 0%, #b80024 100%)",
          padding: "10px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
            📱 Install F1 LIVE as an app for the best experience
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleInstall} style={{
              background: "#fff", color: "#e8002d", border: "none", borderRadius: 6,
              padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>Install</button>
            <button onClick={() => setShowInstallBanner(false)} style={{
              background: "transparent", color: "#fff9", border: "1px solid #fff3",
              borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer",
            }}>Later</button>
          </div>
        </div>
      )}

      {/* iOS install hint (iOS doesn't support beforeinstallprompt) */}
      {!showInstallBanner && !isStandalone && /iPhone|iPad/.test(navigator.userAgent) && !sessionStorage.getItem('ios-dismissed') && (
        <div style={{
          background: "#18181b", padding: "10px 24px", borderBottom: "1px solid #27272a",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 11, color: "#a1a1aa" }}>
            Tap <strong style={{ color: "#fff" }}>Share</strong> → <strong style={{ color: "#fff" }}>Add to Home Screen</strong> to install this app
          </span>
          <button onClick={() => { sessionStorage.setItem('ios-dismissed', '1'); window.location.reload(); }} style={{
            background: "transparent", color: "#52525b", border: "none", fontSize: 16, cursor: "pointer", padding: 4,
          }}>✕</button>
        </div>
      )}

      <header style={{ borderBottom: "1px solid #27272a", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 28, background: "#e8002d", borderRadius: 2 }} />
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#fff" }}>F1 LIVE</h1>
          <span style={{ fontSize: 10, color: "#71717a", letterSpacing: 1, textTransform: "uppercase" }}>Data Dashboard</span>
        </div>
        {sessions.length > 0 && (
          <select value={selectedSession || ""} onChange={e => setSelectedSession(e.target.value)}
            style={{ background: "#18181b", color: "#a1a1aa", border: "1px solid #27272a", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", outline: "none" }}>
            {sessions.map(s => <option key={s.session_key} value={s.session_key}>{s.session_name} — {s.country_name || ""}</option>)}
          </select>
        )}
      </header>

      <nav style={{ display: "flex", gap: 4, padding: "8px 24px", borderBottom: "1px solid #1a1a1e", overflowX: "auto" }}>
        <Tab label="Live Session" active={tab === "live"} onClick={() => setTab("live")} />
        <Tab label="Standings" active={tab === "standings"} onClick={() => setTab("standings")} />
        <Tab label="Fantasy" active={tab === "fantasy"} onClick={() => setTab("fantasy")} badge="NEW" />
        <Tab label="Schedule" active={tab === "schedule"} onClick={() => setTab("schedule")} />
        <Tab label="Lap Times" active={tab === "laps"} onClick={() => setTab("laps")} />
      </nav>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px" }}>
        {initLoading ? <LoadingPulse text="Connecting to OpenF1 API..." /> : (
          <>
            {tab === "live" && <LiveSession sessionKey={sessionKey} drivers={drivers} />}
            {tab === "standings" && <Standings />}
            {tab === "fantasy" && <FantasyPredictor />}
            {tab === "schedule" && <Schedule />}
            {tab === "laps" && <LapTimes sessionKey={sessionKey} drivers={drivers} />}
          </>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: "24px", fontSize: 10, color: "#3f3f46", borderTop: "1px solid #18181b" }}>
        Powered by <a href="https://openf1.org" target="_blank" rel="noreferrer" style={{ color: "#52525b" }}>OpenF1 API</a> · Not affiliated with Formula 1 · Fantasy data estimated from historical results
      </footer>
    </div>
  );
}
