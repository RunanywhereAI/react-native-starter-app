import { Session, NegotiationMode } from '../types/session';

export interface BehavioralProfile {
    archetype: string[];
    leverageCaptureScore: number;
    objectionHandlingScore: number;
    fillerWordCount: number;
    hesitationMoments: number;
}

/**
 * 🧠 Strategic Outcome Replay™ - Behavioral Pressure Analytics
 * Consumes the entire transcript text to calculate psychological profile markers
 * like hesitation, filler spam, and over-talking ratios.
 */
export const BehavioralAnalyticsEngine = {
    analyzeTranscript(session: Session): BehavioralProfile {
        console.log(`[BehavioralAnalyticsEngine] Profiling Transcript for Session: ${session.id}`);

        if (!session.transcript || session.transcript.length === 0) {
            return this.getEmptyProfile();
        }

        const fullText = session.transcript.map(t => t.text).join(' ').toLowerCase();
        
        // 1. Calculate Filler Words
        const fillerList = ['um ', 'uh ', 'like ', 'you know', 'basically', 'actually'];
        let fillerCount = 0;
        fillerList.forEach(word => {
            const regex = new RegExp(word, 'gi');
            const matches = fullText.match(regex);
            if (matches) fillerCount += matches.length;
        });

        // 2. Calculate Hesitation Markers
        const hesitationList = ['i think maybe', 'if possible', 'sort of', 'kind of'];
        let hesitationCount = 0;
        hesitationList.forEach(word => {
            const regex = new RegExp(word, 'gi');
            const matches = fullText.match(regex);
            if (matches) hesitationCount += matches.length;
        });

        // Generate Archetype
        const archetypes = [];
        if (fillerCount > 5 || hesitationCount > 3) {
            archetypes.push("Defensive Under Pressure");
            archetypes.push("Misses Leverage Signals");
        } else {
            archetypes.push("Strong Frame Control");
            archetypes.push("Direct Communicator");
        }

        if (fullText.includes("budget") && hesitationCount > 2) {
            archetypes.push("Accepts Anchors Quickly");
        }

        return {
            archetype: archetypes,
            leverageCaptureScore: Math.round(100 - (hesitationCount * 15) - (fillerCount * 5)) > 0 ? Math.round(100 - (hesitationCount * 15) - (fillerCount * 5)) : 30,
            objectionHandlingScore: Math.round(100 - (fillerCount * 8)) > 0 ? Math.round(100 - (fillerCount * 8)) : 40,
            fillerWordCount: fillerCount,
            hesitationMoments: hesitationCount
        };
    },

    getEmptyProfile(): BehavioralProfile {
        return {
            archetype: ["Insufficient Data"],
            leverageCaptureScore: 0,
            objectionHandlingScore: 0,
            fillerWordCount: 0,
            hesitationMoments: 0
        };
    }
};
