import { PipelineStep, PipelineState } from '../pipelineTypes';
import { buildIntendedMap } from '../../../facts/intendedMap';
import { HotspotDetector } from '../../hotspotDetector';

export function createIntendedStep(): PipelineStep {
  return {
    id: 'intended',
    label: 'Build intended state map',
    deps: ['index_commits'],

    async run(state: PipelineState) {
      const intended = await buildIntendedMap(state.selectedCommitShas);
      state.intended = intended;
      
      // Log validation for empty results
      if (intended.size === 0) {
        console.warn(`[IntendedStep] WARNING: Intended map is empty. No symbols found in ${state.selectedCommitShas.length} commits.`);
        console.warn(`[IntendedStep] Attempting fallback: seeding from hotspots...`);
        
        // Fallback: seed from hotspots if empty
        try {
          const hotspotDetector = new HotspotDetector();
          const hotspots = await hotspotDetector.getTopSymbolHotspots(50);
          
          for (const hotspot of hotspots) {
            if (hotspot.hotspotScore > 60) {
              intended.set(hotspot.symbolId, {
                expect: 'present',
                lastName: hotspot.symbolName,
                lastPath: hotspot.filePath,
                lastSig: '',
                lastSha: hotspot.lastChangedSha || '',
                isRenamed: false
              });
            }
          }
          
          if (intended.size > 0) {
            console.log(`[IntendedStep] Fallback: Seeded ${intended.size} symbols from hotspots (score >60)`);
            state.intended = intended;
          } else {
            console.warn(`[IntendedStep] Fallback failed: No hotspots with score >60 found.`);
          }
        } catch (error) {
          console.warn(`[IntendedStep] Fallback error: ${error}`);
        }
      }
      
      if (intended.size > 0) {
        const presentCount = Array.from(intended.values()).filter(s => s.expect === 'present').length;
        const absentCount = Array.from(intended.values()).filter(s => s.expect === 'absent').length;
        const renamedCount = Array.from(intended.values()).filter(s => s.isRenamed).length;
        console.log(`[IntendedStep] Intended map: ${intended.size} total (${presentCount} present, ${absentCount} absent, ${renamedCount} renamed)`);
      }
    }
  };
}
