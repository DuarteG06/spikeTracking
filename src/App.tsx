import { useState, useRef } from 'react';
import './App.css';
import type { Landmarks, View } from './types';
import { 
  ChevronLeft, ChevronRight, 
  FastForward, Rewind, 
  Upload, Play, Pause, 
  RotateCcw 
} from 'lucide-react';

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

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setLandmarks({ takeoff: null, hit: null, landing: null });
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const skipFrame = (direction: number) => {
    if (videoRef.current) {
      // Assuming 30fps as default
      const frameDuration = 1 / 30;
      videoRef.current.currentTime += direction * frameDuration;
    }
  };

  const markLandmark = (type: keyof Landmarks) => {
    if (videoRef.current) {
      setLandmarks(prev => ({ ...prev, [type]: videoRef.current!.currentTime }));
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const calculateResults = () => {
    if (landmarks.takeoff === null || landmarks.hit === null || landmarks.landing === null) return null;
    
    const airtime = landmarks.landing - landmarks.takeoff;
    const idealRelativeHit = airtime / 2;
    const actualRelativeHit = landmarks.hit - landmarks.takeoff;
    const diff = actualRelativeHit - idealRelativeHit;
    
    // Accuracy Calculation
    // We normalize error relative to the half-airtime
    const maxError = airtime / 2;
    const errorRatio = Math.abs(diff) / maxError;
    const accuracy = Math.max(0, 100 * (1 - errorRatio));
    
    let grade = "Needs Practice";
    let gradeClass = "needs-practice";
    if (accuracy >= 95) { grade = "Perfect"; gradeClass = "perfect"; }
    else if (accuracy >= 85) { grade = "Great"; gradeClass = "great"; }
    else if (accuracy >= 75) { grade = "Good"; gradeClass = "good"; }

    return { airtime, idealRelativeHit, actualRelativeHit, diff, accuracy, grade, gradeClass };
  };

  const results = calculateResults();

  if (view === 'home') {
    return (
      <div className="card">
        <h1>Volleyball Spiking Tracker</h1>
        <p>Upload a video to track and analyze your spiking timing.</p>
        <button onClick={() => setView('tracking')}>Start Tracking</button>
      </div>
    );
  }

  if (view === 'tracking') {
    return (
      <div className="card">
        <h2>Tracking Page</h2>
        {!videoUrl ? (
          <div className="upload-section">
            <input type="file" accept="video/*" onChange={handleVideoUpload} id="video-upload" style={{ display: 'none' }} />
            <label htmlFor="video-upload" style={{ cursor: 'pointer', padding: '1em 2em', background: '#333', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={20} /> Upload Video
            </label>
          </div>
        ) : (
          <div>
            <div className="video-container">
              <video 
                ref={videoRef} 
                src={videoUrl} 
                onPlay={() => setIsPlaying(true)} 
                onPause={() => setIsPlaying(false)} 
              />
            </div>
            
            <div className="button-group">
              <button onClick={() => skipTime(-0.2)} title="-0.2s"><Rewind size={20} /> -0.2s</button>
              <button onClick={() => skipFrame(-1)} title="-1 frame"><ChevronLeft size={20} /> -1 Frame</button>
              <button onClick={togglePlay}>
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button onClick={() => skipFrame(1)} title="+1 frame"><ChevronRight size={20} /> +1 Frame</button>
              <button onClick={() => skipTime(0.2)} title="+0.2s"><FastForward size={20} /> +0.2s</button>
            </div>

            <div className="button-group">
              <button onClick={() => markLandmark('takeoff')} style={{borderColor: landmarks.takeoff !== null ? '#4caf50' : 'transparent'}}>
                Off the Ground
              </button>
              <button onClick={() => markLandmark('hit')} style={{borderColor: landmarks.hit !== null ? '#4caf50' : 'transparent'}}>
                Hit
              </button>
              <button onClick={() => markLandmark('landing')} style={{borderColor: landmarks.landing !== null ? '#4caf50' : 'transparent'}}>
                On the Ground
              </button>
            </div>

            <table className="landmark-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Time (s)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Off the Ground</td><td>{landmarks.takeoff?.toFixed(3) || '-'}</td></tr>
                <tr><td>Hit</td><td>{landmarks.hit?.toFixed(3) || '-'}</td></tr>
                <tr><td>On the Ground</td><td>{landmarks.landing?.toFixed(3) || '-'}</td></tr>
              </tbody>
            </table>

            <div className="button-group" style={{marginTop: '30px'}}>
              <button 
                onClick={() => setView('results')} 
                disabled={landmarks.takeoff === null || landmarks.hit === null || landmarks.landing === null}
                style={{ background: '#646cff', color: 'white', padding: '1em 2em' }}
              >
                Analyze
              </button>
              <button onClick={() => { setVideoUrl(null); setLandmarks({ takeoff: null, hit: null, landing: null }); }}>
                Upload New Video
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'results' && results) {
    return (
      <div className="card">
        <div className={`grade-banner ${results.gradeClass}`}>
          {results.grade}
        </div>
        <div className="difference-text">
          {results.diff > 0 ? `+${results.diff.toFixed(3)}s` : `${results.diff.toFixed(3)}s`} from ideal
        </div>

        <div className="results-view">
          <div className="accuracy-text">Accuracy: {results.accuracy.toFixed(1)}%</div>
          
          <div style={{ textAlign: 'left', marginTop: '20px' }}>
            <p><strong>Total Airtime:</strong> {results.airtime.toFixed(3)}s</p>
            <p><strong>Ideal Contact Point:</strong> {results.idealRelativeHit.toFixed(3)}s (after takeoff)</p>
            <p><strong>Actual Contact Point:</strong> {results.actualRelativeHit.toFixed(3)}s (after takeoff)</p>
          </div>
        </div>

        <div className="button-group" style={{marginTop: '30px'}}>
          <button onClick={() => setView('tracking')}>
            <RotateCcw size={20} /> Try Again
          </button>
          <button onClick={() => { setView('tracking'); setVideoUrl(null); setLandmarks({ takeoff: null, hit: null, landing: null }); }}>
            <Upload size={20} /> Upload New Video
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
