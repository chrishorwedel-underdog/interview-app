import { Mic, MonitorSpeaker, Square, Radio } from "lucide-react";
import { LevelMeter } from "./LevelMeter";

const Source = ({ icon: Icon, label, on, level, color, testId, onClick }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition-colors duration-200 ${
      on ? "border-white/20 bg-white/5 text-slate-100" : "border-white/10 text-slate-500 hover:text-slate-200 hover:border-white/25"
    }`}
  >
    <Icon size={14} style={{ color: on ? color : undefined }} />
    {label}
    <LevelMeter level={level} color={color} active={on} />
  </button>
);

export const TopBar = ({ host, guest, live, onStart, onStop, onToggleHost, onToggleGuest, elapsed }) => (
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 md:px-6 py-3 bg-[#090d16]/90 backdrop-blur-xl sticky top-0 z-20">
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-emerald-500/15 border border-emerald-400/30 grid place-items-center">
        <Radio size={16} className="text-emerald-400" />
      </div>
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight leading-none">Follow-Up</h1>
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500">interview co-pilot</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Source icon={Mic} label="You" on={host.active} level={host.active ? 0.6 : 0} color="#38bdf8" testId="toggle-host-mic" onClick={onToggleHost} />
      <Source icon={MonitorSpeaker} label="Guest" on={guest.active} level={guest.level} color="#10b981" testId="toggle-guest-audio" onClick={onToggleGuest} />
      {live && (
        <span className="flex items-center gap-2 font-mono text-xs text-slate-300 px-2" data-testid="live-timer">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> {elapsed}
        </span>
      )}
      {live ? (
        <button onClick={onStop} data-testid="stop-listening-button" className="flex items-center gap-2 rounded-full bg-red-500/90 hover:bg-red-500 px-4 py-2 text-sm font-semibold transition-colors">
          <Square size={14} /> Stop
        </button>
      ) : (
        <button onClick={onStart} data-testid="start-listening-button" className="flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#04110b] px-4 py-2 text-sm font-semibold transition-colors">
          <Mic size={14} /> Start listening
        </button>
      )}
    </div>
  </header>
);
