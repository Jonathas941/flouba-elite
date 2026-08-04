import React, { useState, useEffect, useCallback } from "react";
import { Bookmark, Trash2, Plus, Check, BookmarkCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function MarketStructurePresetsBar({ settings, onApplyPreset }) {
  const { toast } = useToast();
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePresetId, setActivePresetId] = useState(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newName, setNewName] = useState("");

  const loadPresets = useCallback(async () => {
    try {
      const res = await base44.entities.MarketStructurePreset.list("-created_date", 50);
      setPresets(res || []);
    } catch {
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const handleSave = async () => {
    if (!newName.trim() || !settings) return;
    try {
      const preset = await base44.entities.MarketStructurePreset.create({
        name: newName.trim(),
        description: "",
        config: { ...settings },
      });
      setPresets((prev) => [preset, ...prev]);
      setActivePresetId(preset.id);
      setNewName("");
      setShowSaveInput(false);
      toast({ title: "Preset Saved", description: `"${preset.name}" saved.`, duration: 2000 });
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const handleApply = async (preset) => {
    if (!preset?.config) return;
    try {
      const res = await base44.functions.invoke("marketStructureScanner", {
        action: "settings",
        update: { ...preset.config },
      });
      if (res?.data?.settings) {
        onApplyPreset(res.data.settings);
        setActivePresetId(preset.id);
        toast({ title: "Preset Loaded", description: `"${preset.name}" applied.`, duration: 2000 });
      }
    } catch (e) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (presetId, presetName) => {
    try {
      await base44.entities.MarketStructurePreset.delete(presetId);
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      if (activePresetId === presetId) setActivePresetId(null);
      toast({ title: "Preset Deleted", description: `"${presetName}" removed.`, duration: 2000 });
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1.5 text-[10px] font-mono text-white/25">
        <Bookmark className="w-3 h-3" /> Loading presets…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bookmark className="w-3.5 h-3.5 text-[#00FF41]" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/70">Presets</span>
      </div>

      {presets.length === 0 && !showSaveInput ? (
        <p className="text-[9px] font-mono text-white/30">No saved presets yet — save your current config below.</p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 border transition-all ${
                activePresetId === preset.id
                  ? "border-[#00FF41]/40 bg-[#00FF41]/5"
                  : "border-white/8 bg-white/[0.02]"
              }`}
            >
              <button
                onClick={() => handleApply(preset)}
                className="flex items-center gap-1.5 min-w-0 flex-1"
              >
                {activePresetId === preset.id ? (
                  <BookmarkCheck className="w-3 h-3 text-[#00FF41] flex-shrink-0" />
                ) : (
                  <Bookmark className="w-3 h-3 text-white/40 flex-shrink-0" />
                )}
                <span className={`text-[10px] font-mono truncate ${activePresetId === preset.id ? "text-[#00FF41]" : "text-white/70"}`}>
                  {preset.name}
                </span>
              </button>
              <button
                onClick={() => handleDelete(preset.id, preset.name)}
                className="ml-1 text-white/20 hover:text-[#FF3131] transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showSaveInput ? (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newName}
            autoFocus
            placeholder="Preset name…"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveInput(false); }}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-[#00FF41]/50"
          />
          <button
            onClick={handleSave}
            disabled={!newName.trim()}
            className="px-2 py-1 rounded-md text-[9px] font-mono font-bold bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 disabled:opacity-30"
          >
            <Check className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveInput(true)}
          className="flex items-center gap-1.5 py-1 text-[10px] font-mono text-[#00FF41]/70 hover:text-[#00FF41] transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Save current as preset</span>
        </button>
      )}
    </div>
  );
}