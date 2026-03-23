/**
 * Shared calibration storage via Supabase.
 * Stores builder part anchor data so all users share the same calibration.
 * Falls back to localStorage if Supabase is unavailable.
 *
 * Requires a `calibration` table in Supabase:
 *   CREATE TABLE calibration (
 *     key TEXT PRIMARY KEY,
 *     data JSONB NOT NULL,
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   -- Enable RLS and allow authenticated users to read/write:
 *   ALTER TABLE calibration ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Allow authenticated read" ON calibration FOR SELECT TO authenticated USING (true);
 *   CREATE POLICY "Allow authenticated write" ON calibration FOR ALL TO authenticated USING (true);
 */

import { supabase } from '../lib/supabase';

const CALIBRATION_KEY = 'builderPartAnchors';
const LOCAL_STORAGE_KEY = 'builderPartAnchors';

/**
 * Load calibration data. Tries Supabase first, falls back to localStorage.
 */
export async function loadCalibration() {
  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('calibration')
      .select('data')
      .eq('key', CALIBRATION_KEY)
      .single();

    if (!error && data?.data) {
      // Also sync to localStorage as cache
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.data));
      return data.data;
    }
  } catch {
    // Supabase unavailable, fall through to localStorage
  }

  // Fall back to localStorage
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save calibration data to both Supabase and localStorage.
 */
export async function saveCalibration(calibrationData) {
  // Always save to localStorage immediately
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(calibrationData));

  // Save to Supabase (upsert)
  try {
    const { error } = await supabase
      .from('calibration')
      .upsert({
        key: CALIBRATION_KEY,
        data: calibrationData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.warn('Failed to save calibration to Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Supabase unavailable for calibration save:', err.message);
  }
}

/**
 * Load calibration synchronously from localStorage (for catalog init).
 * The catalog loads at module init time and can't await.
 */
export function loadCalibrationSync() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}
