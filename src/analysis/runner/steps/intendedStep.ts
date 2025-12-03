/* eslint-disable no-restricted-syntax */
import { buildIntendedMap } from '../../../facts/intendedMap';
import { logInfo, logWarn } from '../../../utils/logger';
import { HotspotDetectorV2 } from '../../hotspotDetector';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createIntendedStep(): PipelineStep {
  return {
    id: 'intended',
    label: 'Build intended state map',
    deps: ['index_commits'],

    async run(state: PipelineState) {
      const intended = await buildIntendedMap(state.selectedCommitShas);
      state.intended = intended;

      if (intended.size === 0) {
        logWarn(
          `WARNING: Intended map is empty. No symbols found in ${state.selectedCommitShas.length} commits.`
        );
        logWarn(`Attempting fallback: seeding from hotspots...`);

        try {
          const hotspotDetector = new HotspotDetectorV2();
          const hotspots = await hotspotDetector.getTopSymbolHotspots(50);

          for (const hotspot of hotspots) {
            if (hotspot.hotspotScore > 60) {
              intended.set(hotspot.symbolId, {
                expect: 'present',
                lastName: hotspot.symbolName,
                lastPath: hotspot.filePath,
                lastSig: '',
                lastSha: hotspot.lastChangedSha || '',
                isRenamed: false,
              });
            }
          }

          if (intended.size > 0) {
            logInfo(`Fallback: Seeded ${intended.size} symbols from hotspots (score >60)`);
            state.intended = intended;
          } else {
            logWarn(`Fallback failed: No hotspots with score >60 found.`);
          }
        } catch (error) {
          logWarn(`Fallback error: ${error}`);
        }
      }

      if (intended.size > 0) {
        const presentCount = Array.from(intended.values()).filter(
          s => s.expect === 'present'
        ).length;
        const absentCount = Array.from(intended.values()).filter(s => s.expect === 'absent').length;
        const renamedCount = Array.from(intended.values()).filter(s => s.isRenamed).length;
        logInfo(
          `Intended map: ${intended.size} total (${presentCount} present, ${absentCount} absent, ${renamedCount} renamed)`
        );
      }
    },
  };
}
