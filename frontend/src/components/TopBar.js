import { Mic, MonitorSpeaker, Square, Radio, Save, Library, PanelRightClose, PanelRightOpen, ALargeSmall } from "lucide-react";
import { LevelMeter } from "./LevelMeter";

const Source = ({ icon: Icon, label, on, level, color, testId, onClick, compact }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    title={label}
    className={`flex items-center gap-2 rounded-full border ${compact ? "px-2.5" : "px-3"} py-1.5 text-xs font-mono uppercase tracking-widest transition-colors duration-200 ${
      on ? "border-white/25 bg-white/10 text-white" : "border-white/15 text-white hover:text-white hover:border-white/30"
    }`}
  >
    <Icon size={14} style={{ color: on ? color : undefined }} />
    {!compact && label}
    <LevelMeter level={level} color={color} active={on} />
  </button>
);

const Tool = ({ icon: Icon, label, onClick, testId, compact }) => (
  <button onClick={onClick} data-testid={testId} title={label}
    className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-white hover:text-white hover:bg-white/10 transition-colors">
    <Icon size={15} /> {!compact && <span className="hidden xl:inline">{label}</span>}
  </button>
);

export const TopBar = ({ host, guest, live, onStart, onStop, onToggleHost, onToggleGuest, elapsed, compact, onToggleCompact, onSave, onLibrary, saving, textScale, onCycleText }) => (
  <header className={`flex items-center justify-between ${compact ? "flex-nowrap gap-1 px-2 py-2" : "flex-wrap gap-2 px-4 md:px-6 py-3"} border-b border-white/10 bg-[#090d16]/95 backdrop-blur-xl sticky top-0 z-20`}>
    <div className="flex items-center gap-3">
      {!compact && (
        <div className="h-8 w-8 rounded-md bg-emerald-500/15 border border-emerald-400/30 grid place-items-center">
          <Radio size={16} className="text-emerald-400" />
        </div>
      )}
      {!compact && (
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight leading-none">Follow-Up</h1>
          <p className="text-[0.72rem] font-mono uppercase tracking-[0.25em] text-white">interview co-pilot</p>
        </div>
      )}
      <div className="flex items-center">
        <Tool icon={Save} label={saving ? "Saving..." : "Save"} onClick={onSave} testId="save-interview-button" compact={compact} />
        <Tool icon={Library} label="Saved" onClick={onLibrary} testId="open-library-button" compact={compact} />
        <Tool icon={compact ? PanelRightOpen : PanelRightClose} label={compact ? "Full layout" : "Side window"} onClick={onToggleCompact} testId="compact-toggle-button" compact={compact} />
        <Tool icon={ALargeSmall} label={`Text ${({ 1: "L", 1.12: "XL", 0.9: "M" })[textScale] || "L"}`} onClick={onCycleText} testId="text-size-button" compact={compact} />
      </div>
    </div>
    <div className={`flex items-center ${compact ? "gap-1" : "flex-wrap gap-2"}`}>
      <Source icon={Mic} label="You" on={host.active} level={host.active ? 0.6 : 0} color="#38bdf8" testId="toggle-host-mic" onClick={onToggleHost} compact={compact} />
      <Source icon={MonitorSpeaker} label="Guest" on={guest.active} level={guest.level} color="#10b981" testId="toggle-guest-audio" onClick={onToggleGuest} compact={compact} />
      {live && (
        <span className="flex items-center gap-2 font-mono text-xs text-white px-2" data-testid="live-timer">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> {elapsed}
        </span>
      )}
      {live ? (
        <button onClick={onStop} data-testid="stop-listening-button" className={`flex items-center gap-2 rounded-full bg-red-500/90 hover:bg-red-500 ${compact ? "px-3" : "px-4"} py-2 text-sm font-semibold transition-colors`}>
          <Square size={14} /> Stop
        </button>
      ) : (
        <button onClick={onStart} data-testid="start-listening-button" className={`flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#04110b] ${compact ? "px-3" : "px-4"} py-2 text-sm font-semibold transition-colors`}>
          <Mic size={14} /> {compact ? <span className="hidden min-[460px]:inline">Start</span> : <><span className="hidden sm:inline">Start listening</span><span className="sm:hidden">Start</span></>}
        </button>
      )}
    </div>
  </header>
);
