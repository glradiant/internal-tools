import { useEffect, useRef, useState, useCallback } from 'react';
import debounce from 'lodash.debounce';
import { supabase } from '../lib/supabase';
import useLayoutStore from '../store/useLayoutStore';
import { captureThumbnail } from '../utils/captureThumbnail';
import { uploadThumbnail, saveThumbnailUrl } from '../utils/thumbnailStorage';

export default function useAutosave(layoutId, svgRef) {
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const debouncedSaveRef = useRef(null);
  const debouncedThumbRef = useRef(null);

  // Get state from store
  const projectName = useLayoutStore((s) => s.projectName);
  const customerName = useLayoutStore((s) => s.customerName);
  const customerAddress = useLayoutStore((s) => s.customerAddress);
  const preparedBy = useLayoutStore((s) => s.preparedBy);
  const quoteNumber = useLayoutStore((s) => s.quoteNumber);
  const revision = useLayoutStore((s) => s.revision);
  const gasType = useLayoutStore((s) => s.gasType);
  const date = useLayoutStore((s) => s.date);
  const walls = useLayoutStore((s) => s.walls);
  const doors = useLayoutStore((s) => s.doors);
  const heaters = useLayoutStore((s) => s.heaters);
  const dimensions = useLayoutStore((s) => s.dimensions);
  const customHeaters = useLayoutStore((s) => s.customHeaters);

  // Create the debounced save function
  useEffect(() => {
    if (!layoutId) return;

    debouncedSaveRef.current = debounce(async (layoutData) => {
      setSaveStatus('saving');

      try {
        const { error } = await supabase
          .from('layouts')
          .update({
            project_name: layoutData.projectName,
            customer_name: layoutData.customerName,
            customer_address: layoutData.customerAddress,
            prepared_by: layoutData.preparedBy,
            quote_number: layoutData.quoteNumber,
            date: layoutData.date,
            layout_json: layoutData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', layoutId);

        if (error) {
          console.error('Autosave error:', error);
          setSaveStatus('error');
        } else {
          setSaveStatus('saved');
          // Trigger a debounced thumbnail update after a successful save
          debouncedThumbRef.current?.({ walls: layoutData.walls, heaters: layoutData.heaters });
        }
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('error');
      }
    }, 1500);

    // Thumbnail capture runs 5s after the last change — less aggressive than data save
    debouncedThumbRef.current = debounce(async ({ walls, heaters }) => {
      const svgEl = svgRef?.current;
      if (!svgEl) return;
      try {
        const blob = await captureThumbnail(svgEl, { walls, heaters });
        if (!blob) return;
        const url = await uploadThumbnail(layoutId, blob);
        if (url) await saveThumbnailUrl(layoutId, url);
      } catch (err) {
        console.error('Thumbnail capture error:', err);
      }
    }, 5000);

    return () => {
      debouncedSaveRef.current?.cancel();
      debouncedThumbRef.current?.cancel();
    };
  }, [layoutId]);

  // Trigger save when state changes
  useEffect(() => {
    if (!layoutId || !debouncedSaveRef.current) return;

    const layoutData = {
      projectName,
      customerName,
      customerAddress,
      preparedBy,
      quoteNumber,
      revision,
      gasType,
      date,
      walls,
      doors,
      heaters,
      dimensions,
      customHeaters,
    };

    setSaveStatus('saving');
    debouncedSaveRef.current(layoutData);
  }, [
    layoutId,
    projectName,
    customerName,
    customerAddress,
    preparedBy,
    quoteNumber,
    revision,
    gasType,
    date,
    walls,
    doors,
    heaters,
    dimensions,
    customHeaters,
  ]);

  // Flush function for navigation
  const flush = useCallback(async () => {
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current.flush();
    }
  }, []);

  return { saveStatus, flush };
}
