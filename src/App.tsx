import { useState, useRef, useEffect } from 'react';
import './App.css';
import type { Landmarks, View } from './types';
import { 
  ChevronLeft, ChevronRight, 
  FastForward, Rewind, 
  Upload, Play, Pause, 
  RotateCcw, Activity
} from 'lucide-react';

const landmarkSteps: Array<{ key: keyof Landmarks; label: string; hint: string }> = [
  { key: 'takeoff', label: 'Off the Ground', hint: 'First frame with no floor contact' },
  { key: 'hit', label: 'Hit', hint: 'Ball contact at peak extension' },
  { key: 'landing', label: 'On the Ground', hint: 'First frame back on the floor' },
];

const homeHighlights = [
  {
    title: 'Focused review flow',
    description: 'A simple three-mark workflow keeps every clip readable and consistent.',
  },
  {
    title: 'Frame-level control',
    description: 'Use coarse and fine scrubbing to land exactly on takeoff, contact, and landing.',
  },
  {
    title: 'Instant timing feedback',
    description: 'See airtime, strike timing, and overall accuracy as soon as the clip is marked.',
  },
];

const uploadTips = [
  'Keep the full approach, jump, and landing inside the frame.',
  'Use a side or slight diagonal angle so the jump arc is easy to read.',
  'Avoid shaky clips and slow pans during the jump.',
];

const formatTime = (time: number | null) => (time === null ? '--' : `${time.toFixed(3)}s`);

function App() {
  const [view, setView] = useState<View>('home');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmarks>({
    takeoff: null,
    hit: null,
    landing: null,
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(30);

  // Effect to ensure video element is properly initialized when URL changes
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.load();
    }
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
          Math.abs(curr - detectedFps) < Math.abs(prev - detectedFps) ? curr : prev
        );
        if (snappedFps >= 24 && snappedFps <= 240) {
          setFps(snappedFps);
        }
      }
      video.currentTime = originalTime;
    };

    video.addEventListener('seeked', onSeeked);
    // Seek 100ms - if the browser snaps, it will land on a frame boundary
    video.currentTime += 0.1;
  };

  const handleVideoMetadata = () => {
    const video = videoRef.current;
    if (video) {
      // Force seek to a tiny value to render the first frame on mobile
      if (video.currentTime === 0) {
        video.currentTime = 0.001;
      }
      detectFrameRate();
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setFps(30); 
      resetLandmarks();
    }
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (video) {
      // iOS sometimes reports readyState 0 if it hasn't buffered yet, 
      // but we can still try to seek if the metadata is loaded
      const current = video.currentTime;
      const duration = video.duration;
      let newTime = current + seconds;
      
      if (!isNaN(duration) && duration !== Infinity) {
        newTime = Math.max(0, Math.min(duration, newTime));
      } else {
        newTime = Math.max(0, newTime);
      }
      
      video.currentTime = newTime;
    }
  };

  const skipFrame = (direction: number) => {
    const video = videoRef.current;
    if (video) {
      const frameDuration = (1 / fps) * 1.1; // 1.1x multiplier ensures we cross the frame threshold
      const current = video.currentTime;
      const duration = video.duration;
      let newTime = current + (direction * frameDuration);
      
      if (!isNaN(duration) && duration !== Infinity) {
        newTime = Math.max(0, Math.min(duration, newTime));
      } else {
        newTime = Math.max(0, newTime);
      }
      
      video.currentTime = newTime;
    }
  };

  const markLandmark = (type: keyof Landmarks) => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const times = Object.values(landmarks).filter(t => t !== null);
      if (times.includes(currentTime)) {
        alert("Please move to a different frame to mark the next landmark.");
        return;
      }
      setLandmarks(prev => ({ ...prev, [type]: currentTime }));
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else {
        // iOS requires user interaction to play, this is handled by the click
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Handle auto-play prevention if needed
          });
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const calculateResults = () => {
    if (landmarks.takeoff === null || landmarks.hit === null || landmarks.landing === null) return null;
    
    const airtime = landmarks.landing - landmarks.takeoff;
    const jumpHeight = (9.81 * Math.pow(airtime, 2)) / 8; // Height in meters
    const jumpHeightCm = jumpHeight * 100; // Height in cm

    const idealRelativeHit = airtime / 2;
    const actualRelativeHit = landmarks.hit - landmarks.takeoff;
    const diff = actualRelativeHit - idealRelativeHit;
    
    const maxError = airtime / 2;
    const errorRatio = Math.abs(diff) / maxError;
    const accuracy = Math.max(0, 100 * (1 - errorRatio));
    
    let grade = "Needs Practice";
    let gradeClass = "needs-practice";
    if (accuracy >= 95) { grade = "Perfect"; gradeClass = "perfect"; }
    else if (accuracy >= 85) { grade = "Great"; gradeClass = "great"; }
    else if (accuracy >= 75) { grade = "Good"; gradeClass = "good"; }

    return { airtime, jumpHeightCm, idealRelativeHit, actualRelativeHit, diff, accuracy, grade, gradeClass };
  };

  const results = calculateResults();
  const completedLandmarks = landmarkSteps.filter(({ key }) => landmarks[key] !== null).length;
  const allLandmarksMarked = completedLandmarks === landmarkSteps.length;
  const statusMessage =
    !landmarks.takeoff
      ? 'Step 1: mark the instant your feet leave the ground.'
      : !landmarks.hit
        ? 'Step 2: mark the exact frame where the ball is contacted.'
        : !landmarks.landing
          ? 'Step 3: mark the first frame back on the ground.'
          : 'All landmarks captured. Your report is ready.';
  const resultMetrics = results
    ? [
        {
          label: 'Total Airtime',
          value: `${results.airtime.toFixed(3)}s`,
          hint: 'Time between takeoff and landing',
        },
        {
          label: 'Jump Height',
          value: `${results.jumpHeightCm.toFixed(1)}cm`,
          hint: 'Estimated vertical leap',
        },
        {
          label: 'Ideal Contact Point',
          value: `${results.idealRelativeHit.toFixed(3)}s`,
          hint: 'Midpoint after takeoff',
        },
        {
          label: 'Actual Contact Point',
          value: `${results.actualRelativeHit.toFixed(3)}s`,
          hint: 'Measured from takeoff',
        },
      ]
    : [];

  if (view === 'home') {
    return (
      <div className="app-shell">
        <div className="home-grid">
          <section className="card card--home hero-panel">
            <p className="eyebrow">Spike timing analysis</p>
            <h1>Professional jump timing review for every rep.</h1>
            <p className="intro-text">
              Upload one clip, move frame by frame, and mark the exact moments that define an explosive, well-timed spike.
            </p>

            <div className="hero-actions">
              <button className="primary-button hero-button" onClick={() => setView('tracking')}>
                Start Tracking
              </button>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <strong>3 landmarks</strong>
                <span>Takeoff, contact, landing</span>
              </div>
              <div className="hero-stat">
                <strong>Frame control</strong>
                <span>Fine and coarse clip navigation</span>
              </div>
              <div className="hero-stat">
                <strong>Instant report</strong>
                <span>Accuracy, jump height, and timing</span>
              </div>
            </div>
          </section>

          <aside className="card card--side">
            <p className="eyebrow eyebrow--subtle">What you get</p>
            <div className="feature-list">
              {homeHighlights.map((feature, index) => (
                <div key={feature.title} className="feature-card">
                  <span className="feature-index">{`0${index + 1}`}</span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (view === 'tracking') {
    return (
      <div className="app-shell">
        <div className="card card--tracking">
          <div className="section-heading">
            <p className="eyebrow">Review your jump</p>
            <h2>Tracking Page</h2>
            <p className="section-description">
              Upload a clean clip, then mark takeoff, contact, and landing in sequence for a precise timing report.
            </p>
          </div>
          {!videoUrl ? (
            <div className="empty-grid">
              <section className="panel panel--upload">
                <p className="panel-kicker">Step 1</p>
                <h3>Bring in a clean spike clip</h3>
                <p className="panel-copy">
                  Choose a video that shows the full jump cycle from approach through landing.
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
                    <Upload size={20} /> Upload Video
                  </label>
                </div>
              </section>

              <section className="panel">
                <p className="panel-kicker">Best results</p>
                <h3>Capture a readable angle</h3>
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
                    <p className="panel-kicker">Video review</p>
                    <h3>Playback canvas</h3>
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
                  <span>{allLandmarksMarked ? 'Ready for analysis' : `${completedLandmarks}/3 landmarks captured`}</span>
                </div>
              </section>

              <aside className="tracking-sidebar">
                <section className="panel">
                  <p className="panel-kicker">Playback controls</p>
                  <div className="panel-header--spread">
                    <h3>Navigation</h3>
                    <select 
                      className="fps-select" 
                      value={fps} 
                      onChange={(e) => setFps(Number(e.target.value))}
                      title="Set video framerate for frame-by-frame control"
                    >
                      <option value={24}>24 FPS</option>
                      <option value={30}>30 FPS</option>
                      <option value={60}>60 FPS</option>
                      <option value={120}>120 FPS</option>
                      <option value={240}>240 FPS</option>
                    </select>
                  </div>
                  <div className="button-group transport-controls">
                    <button onClick={() => skipTime(-0.2)} title="-0.2s">
                      <Rewind size={20} /> -0.2s
                    </button>
                    <button onClick={() => skipFrame(-1)} title="-1 frame">
                      <ChevronLeft size={20} /> -1 Frame
                    </button>
                    <button onClick={togglePlay} className="accent-button">
                      {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button onClick={() => skipFrame(1)} title="+1 frame">
                      <ChevronRight size={20} /> +1 Frame
                    </button>
                    <button onClick={() => skipTime(0.2)} title="+0.2s">
                      <FastForward size={20} /> +0.2s
                    </button>
                  </div>
                </section>

                <section className="panel panel--mark">
                  <p className="panel-kicker">Landmark capture</p>
                  <h3>Mark the current frame</h3>
                  <div className="status-message">{statusMessage}</div>

                  <div className="button-group mark-controls">
                    <button
                      className="tap-button"
                      onClick={() => {
                        if (!landmarks.takeoff) markLandmark('takeoff');
                        else if (!landmarks.hit) markLandmark('hit');
                        else if (!landmarks.landing) markLandmark('landing');
                      }}
                      disabled={allLandmarksMarked}
                    >
                      Tap
                    </button>
                    <button
                      className="secondary-button undo-button"
                      onClick={undoLastLandmark}
                      disabled={completedLandmarks === 0}
                    >
                      <RotateCcw size={18} /> Undo Last Mark
                    </button>
                  </div>

                  <p className="panel-note">
                    Use the frame controls until the action matches the prompt above, then capture the moment with one tap.
                  </p>
                </section>

                <section className="panel">
                  <p className="panel-kicker">Captured timeline</p>
                  <h3>Current landmarks</h3>
                  <div className="landmark-grid">
                    {landmarkSteps.map((step) => (
                      <div
                        key={step.key}
                        className={`landmark-card ${landmarks[step.key] !== null ? 'landmark-card--filled' : ''}`}
                      >
                        <span className="landmark-label">{step.label}</span>
                        <strong>{formatTime(landmarks[step.key])}</strong>
                        <span className="landmark-hint">{step.hint}</span>
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
                    Analyze
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setVideoUrl(null);
                      resetLandmarks();
                    }}
                  >
                    Upload New Video
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
              <p className="eyebrow">Timing report</p>
              <div className={`grade-banner ${results.gradeClass}`}>
                {results.grade}
              </div>
              <div className="difference-text">
                {results.diff > 0 ? `+${results.diff.toFixed(3)}s` : `${results.diff.toFixed(3)}s`} from ideal
              </div>
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
              The ideal strike point sits halfway between takeoff and landing. Smaller offsets mean cleaner timing.
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
              <RotateCcw size={20} /> Try Again
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setView('tracking');
                setVideoUrl(null);
                resetLandmarks();
              }}
            >
              <Upload size={20} /> Upload New Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
