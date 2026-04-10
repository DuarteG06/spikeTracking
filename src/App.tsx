import { useEffect, useRef, useState } from 'react';
import './App.css';
import type { Landmarks, View } from './types';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Upload,
} from 'lucide-react';

const landmarkSteps: Array<{ key: keyof Landmarks; label: string; hint: string }> = [
  { key: 'takeoff', label: 'Takeoff', hint: 'First frame with both feet off the floor' },
  { key: 'hit', label: 'Contact', hint: 'Frame where the hand meets the ball' },
  { key: 'landing', label: 'Landing', hint: 'First frame back on the floor' },
];

const uploadTips = [
  'Keep the full approach, jump, and landing in view.',
  'A side or slight diagonal angle makes the jump arc easier to read.',
  'Use a stable clip with minimal camera shake.',
];

const homeStats = [
  { title: '3 landmarks', detail: 'Takeoff, contact, landing' },
  { title: 'Frame-by-frame', detail: 'Precise clip control' },
  { title: 'Vertical jump', detail: 'Dual-unit jump height: cm + inches' },
];

const formatTime = (time: number | null) => (time === null ? '--' : `${time.toFixed(3)}s`);
const formatJumpHeight = (cm: number, inches: number) => `${cm.toFixed(1)} cm / ${inches.toFixed(1)} in`;

function App() {
  const [view, setView] = useState<View>('home');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmarks>({
    takeoff: null,
    hit: null,
    landing: null,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(30);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.load();
    }

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const resetLandmarks = () => {
    setLandmarks({ takeoff: null, hit: null, landing: null });
    setIsPlaying(false);
  };

  const undoLastLandmark = () => {
    setLandmarks((prev) => {
      if (prev.landing !== null) return { ...prev, landing: null };
      if (prev.hit !== null) return { ...prev, hit: null };
      if (prev.takeoff !== null) return { ...prev, takeoff: null };
      return prev;
    });
  };

  const detectFrameRate = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) return;

    const originalTime = video.currentTime;

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      const diff = video.currentTime - originalTime;

      if (diff > 0 && diff < 0.15) {
        const detectedFps = 1 / diff;
        const commonRates = [24, 25, 30, 50, 60, 120, 240];
        const snappedFps = commonRates.reduce((prev, curr) =>
          Math.abs(curr - detectedFps) < Math.abs(prev - detectedFps) ? curr : prev,
        );

        if (snappedFps >= 24 && snappedFps <= 240) {
          setFps(snappedFps);
        }
      }

      video.currentTime = originalTime;
    };

    video.addEventListener('seeked', onSeeked);
    video.currentTime += 0.1;
  };

  const handleVideoMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime === 0) {
      video.currentTime = 0.001;
    }

    detectFrameRate();
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setFps(30);
    resetLandmarks();
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    const duration = video.duration;
    let newTime = current + seconds;

    if (!Number.isNaN(duration) && duration !== Infinity) {
      newTime = Math.max(0, Math.min(duration, newTime));
    } else {
      newTime = Math.max(0, newTime);
    }

    video.currentTime = newTime;
  };

  const skipFrame = (direction: number) => {
    const video = videoRef.current;
    if (!video) return;

    const frameDuration = (1 / fps) * 1.1;
    const current = video.currentTime;
    const duration = video.duration;
    let newTime = current + direction * frameDuration;

    if (!Number.isNaN(duration) && duration !== Infinity) {
      newTime = Math.max(0, Math.min(duration, newTime));
    } else {
      newTime = Math.max(0, newTime);
    }

    video.currentTime = newTime;
  };

  const markLandmark = (type: keyof Landmarks) => {
    if (!videoRef.current) return;

    const currentTime = videoRef.current.currentTime;
    const times = Object.values(landmarks).filter((time): time is number => time !== null);

    if (times.includes(currentTime)) {
      alert('Please move to a different frame to mark the next landmark.');
      return;
    }

    setLandmarks((prev) => ({ ...prev, [type]: currentTime }));
  };

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Ignore autoplay prevention errors and leave playback paused.
        });
      }
    }
  };

  const calculateResults = () => {
    if (landmarks.takeoff === null || landmarks.hit === null || landmarks.landing === null) return null;

    const airtime = landmarks.landing - landmarks.takeoff;
    if (airtime <= 0) return null;

    const jumpHeightMeters = (9.81 * airtime * airtime) / 8;
    const jumpHeightCm = jumpHeightMeters * 100;
    const jumpHeightInches = jumpHeightCm / 2.54;

    const idealRelativeHit = airtime / 2;
    const actualRelativeHit = landmarks.hit - landmarks.takeoff;
    const diff = actualRelativeHit - idealRelativeHit;
    const maxError = airtime / 2;
    const errorRatio = maxError === 0 ? 1 : Math.abs(diff) / maxError;
    const accuracy = Math.max(0, 100 * (1 - errorRatio));

    let grade = 'Needs Work';
    let gradeClass = 'needs-practice';

    if (accuracy >= 95) {
      grade = 'Excellent';
      gradeClass = 'perfect';
    } else if (accuracy >= 85) {
      grade = 'Strong';
      gradeClass = 'great';
    } else if (accuracy >= 75) {
      grade = 'Solid';
      gradeClass = 'good';
    }

    return {
      accuracy,
      actualRelativeHit,
      airtime,
      diff,
      grade,
      gradeClass,
      idealRelativeHit,
      jumpHeightCm,
      jumpHeightInches,
    };
  };

  const results = calculateResults();
  const completedLandmarks = landmarkSteps.filter(({ key }) => landmarks[key] !== null).length;
  const allLandmarksMarked = completedLandmarks === landmarkSteps.length;

  const statusMessage =
    landmarks.takeoff === null
      ? 'Step 1: find the first frame where both feet are off the floor.'
      : landmarks.hit === null
        ? 'Step 2: mark the frame where the hand contacts the ball.'
        : landmarks.landing === null
          ? 'Step 3: mark the first frame back on the floor.'
          : 'All three landmarks are captured.';

  const timingSummary = results
    ? results.diff === 0
      ? 'Contact was right on the ideal midpoint.'
      : `Contact was ${results.diff > 0 ? `${results.diff.toFixed(3)}s late` : `${Math.abs(results.diff).toFixed(3)}s early`} relative to the ideal midpoint.`
    : '';

  const resultMetrics = results
    ? [
        {
          label: 'Airtime',
          value: `${results.airtime.toFixed(3)}s`,
          hint: 'Time from takeoff to landing',
        },
        {
          label: 'Vertical Jump',
          value: formatJumpHeight(results.jumpHeightCm, results.jumpHeightInches),
          hint: 'Estimated from total airtime',
        },
        {
          label: 'Ideal Contact',
          value: `${results.idealRelativeHit.toFixed(3)}s`,
          hint: 'Midpoint after takeoff',
        },
        {
          label: 'Actual Contact',
          value: `${results.actualRelativeHit.toFixed(3)}s`,
          hint: 'Measured from takeoff',
        },
      ]
    : [];

  if (view === 'home') {
    return (
      <div className="app-shell">
        <section className="card home-card">
          <p className="eyebrow">Volleyball spike tracking</p>
          <h1>Review each jump with a calmer workflow.</h1>
          <div className="hero-actions">
            <button className="primary-button hero-button" onClick={() => setView('tracking')}>
              Start Review
            </button>
          </div>
          <div className="hero-stats">
            {homeStats.map((stat) => (
              <div key={stat.title} className="hero-stat">
                <strong>{stat.title}</strong>
                <span>{stat.detail}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (view === 'tracking') {
    return (
      <div className="app-shell">
        <div className="card card--tracking">
          <div className="section-heading">
            <p className="eyebrow">Clip review</p>
            <h2>Mark the jump in three steps</h2>
            <p className="section-description">
              Upload a clean spike clip, then capture takeoff, contact, and landing in order for a simple timing report.
            </p>
          </div>

          {!videoUrl ? (
            <div className="empty-grid">
              <section className="panel panel--upload">
                <p className="panel-kicker">Step 1</p>
                <h3>Upload a spike clip</h3>
                <p className="panel-copy">
                  Choose a video that shows the whole movement from the final step through landing.
                </p>
                <div className="upload-section">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    id="video-upload"
                    className="visually-hidden"
                  />
                  <label htmlFor="video-upload" className="upload-trigger">
                    <Upload size={20} /> Choose Video
                  </label>
                </div>
              </section>

              <section className="panel">
                <p className="panel-kicker">Clip tips</p>
                <h3>Make the jump easy to read</h3>
                <ul className="tip-list">
                  {uploadTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="tracking-workspace">
              <section className="panel stage-panel">
                <div className="panel-header panel-header--spread">
                  <div>
                    <h3>Playback</h3>
                  </div>
                  <span className={`live-pill ${isPlaying ? 'live-pill--active' : ''}`}>
                    {isPlaying ? 'Playing' : 'Paused'}
                  </span>
                </div>

                <div className="video-container">
                  <video
                    className="tracking-video"
                    ref={videoRef}
                    src={videoUrl}
                    onLoadedMetadata={handleVideoMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    playsInline
                    preload="auto"
                    muted
                    disablePictureInPicture
                    disableRemotePlayback
                  />
                </div>

                <div className="stage-footer">
                  <div className="fps-indicator">
                    <Activity size={14} />
                    <span>{fps} FPS</span>
                  </div>
                  <span>{allLandmarksMarked ? 'Ready to analyze' : `${completedLandmarks}/3 landmarks captured`}</span>
                </div>
              </section>

              <aside className="tracking-sidebar">
                <section className="panel">
                  <div className="panel-header panel-header--spread">
                    <div>
                      <h3>Frame Selection</h3>
                    </div>
                    <select
                      className="fps-select"
                      value={fps}
                      onChange={(e) => setFps(Number(e.target.value))}
                      title="Set the frame rate used for frame-by-frame stepping"
                    >
                      <option value={24}>24 FPS</option>
                      <option value={30}>30 FPS</option>
                      <option value={60}>60 FPS</option>
                      <option value={120}>120 FPS</option>
                      <option value={240}>240 FPS</option>
                    </select>
                  </div>

                  <div className="button-group transport-controls">
                    <button onClick={() => skipTime(-0.2)} title="Back 0.2 seconds">
                      <Rewind size={18} /> -0.2s
                    </button>
                    <button onClick={() => skipFrame(-1)} title="Back 1 frame">
                      <ChevronLeft size={18} /> -1 frame
                    </button>
                    <button onClick={togglePlay} className="accent-button" title="Play or pause">
                      {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button onClick={() => skipFrame(1)} title="Forward 1 frame">
                      <ChevronRight size={18} /> +1 frame
                    </button>
                    <button onClick={() => skipTime(0.2)} title="Forward 0.2 seconds">
                      <FastForward size={18} /> +0.2s
                    </button>
                  </div>
                </section>

                <section className="panel panel--compact">
                  <div className="status-message">{statusMessage}</div>

                  <div className="button-group mark-controls">
                    <button
                      className="tap-button"
                      onClick={() => {
                        if (landmarks.takeoff === null) markLandmark('takeoff');
                        else if (landmarks.hit === null) markLandmark('hit');
                        else if (landmarks.landing === null) markLandmark('landing');
                      }}
                      disabled={allLandmarksMarked}
                    >
                      Mark Current Frame
                    </button>
                    <button
                      className="secondary-button undo-button"
                      onClick={undoLastLandmark}
                      disabled={completedLandmarks === 0}
                    >
                      <RotateCcw size={18} /> Undo Last Mark
                    </button>
                  </div>

                  <div className="landmark-list">
                    {landmarkSteps.map((step) => (
                      <div
                        key={step.key}
                        className={`landmark-row ${landmarks[step.key] !== null ? 'landmark-row--filled' : ''}`}
                      >
                        <div className="landmark-copy">
                          <span className="landmark-label">{step.label}</span>
                          <span className="landmark-hint">{step.hint}</span>
                        </div>
                        <strong>{formatTime(landmarks[step.key])}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="button-group action-controls">
                  <button
                    className="primary-button"
                    onClick={() => setView('results')}
                    disabled={!allLandmarksMarked}
                  >
                    Analyze Jump
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setVideoUrl(null);
                      resetLandmarks();
                    }}
                  >
                    Upload Another Video
                  </button>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'results' && results) {
    return (
      <div className="app-shell">
        <div className="card card--results">
          <div className="results-header">
            <div className="results-summary">
              <p className="eyebrow">Jump report</p>
              <h2 className={`results-grade ${results.gradeClass}`}>{results.grade}</h2>
              <p className="results-subtitle">{timingSummary}</p>
            </div>

            <div className="accuracy-orb">
              <span>Accuracy</span>
              <strong>{results.accuracy.toFixed(1)}%</strong>
            </div>
          </div>

          <div className="results-view">
            <div className="results-metric-grid">
              {resultMetrics.map((metric) => (
                <div key={metric.label} className="metric-card">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.hint}</p>
                </div>
              ))}
            </div>

            <div className="results-note">
              The ideal contact point sits halfway between takeoff and landing. Smaller timing offsets usually mean cleaner spike timing.
            </div>
          </div>

          <div className="button-group action-controls">
            <button
              className="secondary-button"
              onClick={() => {
                resetLandmarks();
                setView('tracking');
              }}
            >
              <RotateCcw size={20} /> Mark Again
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setView('tracking');
                setVideoUrl(null);
                resetLandmarks();
              }}
            >
              <Upload size={20} /> New Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
