import { NegotiationMode } from '../types/session';

export type RootStackParamList = {
  Disclaimer: undefined;
  Home: undefined;
  PreSessionForm: {
    mode: NegotiationMode;
  };
  PreSessionStrategy: {
    mode: NegotiationMode;
    inputs: import('../types/session').PreSessionInputs;
    analysis: import('../types/session').StrategicAnalysis;
  };
  LiveSession: {
    mode: NegotiationMode;
    preSessionInputs?: import('../types/session').PreSessionInputs;
    strategicAnalysis?: import('../types/session').StrategicAnalysis;
  };
  OutcomeReplay: {
    sessionId?: string; // Optional: If empty, load latest
  };
  Insights: {
    sessionId: string;
  };
  Settings: undefined;
};
